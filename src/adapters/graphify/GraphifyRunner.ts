import path from 'node:path';
import { execFile } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { WorkspaceError } from '../../core/workspace/WorkspacePaths.ts';

const execute = promisify(execFile);

export interface RawGraphNode {
  id: string;
  label: string;
  kind: 'FILE' | 'FUNCTION' | 'CONFIG';
  file_path: string;
  functions?: string[];
  imports?: string[];
}

export interface RawGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: 'IMPORTS' | 'CALLS' | 'EXPORTS';
  style: 'SOLID' | 'DASHED';
}

export interface RawGraphOutput {
  project_name: string;
  generated_at: number;
  nodes: RawGraphNode[];
  edges: RawGraphEdge[];
}

export class GraphifyRunner {
  constructor(private readonly cliCommand = 'graphify') {}

  /**
   * Generates graph.json directly into shadow workspace destination (outputPath).
   * Strictly enforces Zero Project Pollution: never writes inside projectPath.
   */
  async generateGraph(projectPath: string, outputPath: string): Promise<RawGraphOutput> {
    const resolvedProject = path.resolve(projectPath);
    const resolvedOutput = path.resolve(outputPath);

    // Verify project directory exists
    try {
      if (!statSync(resolvedProject).isDirectory()) {
        throw new WorkspaceError('INVALID_PROJECT_PATH', 'Target project is not a directory');
      }
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError('INVALID_PROJECT_PATH', 'Target project path is invalid', error);
    }

    // Verify output directory is NOT within projectPath
    const rel = path.relative(resolvedProject, resolvedOutput);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw new WorkspaceError('PROJECT_POLLUTION_BLOCKED', 'graph.json cannot be written into user source tree');
    }

    // Ensure output directory exists
    mkdirSync(path.dirname(resolvedOutput), { recursive: true });

    let graphData: RawGraphOutput | null = null;

    // 1. Attempt to execute graphify CLI if present in PATH
    try {
      await execute(this.cliCommand, ['--output', resolvedOutput, resolvedProject], {
        timeout: 15000,
        windowsHide: true,
      });
      if (existsSync(resolvedOutput)) {
        const raw = readFileSync(resolvedOutput, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          graphData = parsed as RawGraphOutput;
        }
      }
    } catch {
      // CLI not available or exited with error; proceed to AST scanner
    }

    // 2. High-fidelity local AST scanner for Python / JS / TS / Config files ($0 API cost)
    if (!graphData) {
      graphData = this.scanProjectTree(resolvedProject);
      writeFileSync(resolvedOutput, JSON.stringify(graphData, null, 2), 'utf8');
    }

    return graphData;
  }

  /**
   * AST tree-sitter inspired local scanner for source files in projectPath.
   */
  scanProjectTree(projectPath: string): RawGraphOutput {
    const projectName = path.basename(projectPath) || 'Project';
    const rawNodes: RawGraphNode[] = [];
    const rawEdges: RawGraphEdge[] = [];
    const nodeMap = new Map<string, RawGraphNode>();

    const IGNORED_DIRS = new Set([
      '.git',
      'node_modules',
      'dist',
      'dist-electron',
      'build',
      '.vscode',
      '__pycache__',
      '.pytest_cache',
      '.plugins',
    ]);

    const walk = (dir: string) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry) || entry.startsWith('.')) continue;
        const full = path.join(dir, entry);
        let stat;
        try {
          stat = lstatSync(full);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          walk(full);
        } else if (stat.isFile()) {
          const relPath = path.relative(projectPath, full).replace(/\\/g, '/');
          const ext = path.extname(entry).toLowerCase();

          // Only scan code & config files
          if (!['.py', '.ts', '.tsx', '.js', '.jsx', '.yaml', '.yml', '.json'].includes(ext)) {
            continue;
          }

          const isConfig = ['.yaml', '.yml', '.json', '.env'].includes(ext) || entry.includes('config');
          const functions: string[] = [];
          const imports: string[] = [];

          try {
            const content = readFileSync(full, 'utf8');
            const lines = content.split(/\r?\n/);

            for (const line of lines) {
              const trimmed = line.trim();

              // Python def
              const pyDefMatch = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
              if (pyDefMatch) functions.push(pyDefMatch[1]);

              // JS/TS function
              const jsDefMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/);
              if (jsDefMatch) functions.push(jsDefMatch[1]);

              // Python import
              const pyImpMatch = trimmed.match(/^(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/);
              if (pyImpMatch) {
                const targetMod = (pyImpMatch[1] || pyImpMatch[2]).split('.')[0];
                imports.push(targetMod);
              }

              // JS/TS import
              const jsImpMatch = trimmed.match(/import\s+.*?from\s+['"](.*?)['"]/);
              if (jsImpMatch) {
                const targetMod = path.basename(jsImpMatch[1]).replace(/\.[^/.]+$/, '');
                imports.push(targetMod);
              }
            }
          } catch {
            // Ignore unreadable binary/encoding errors
          }

          const node: RawGraphNode = {
            id: entry,
            label: entry,
            kind: isConfig ? 'CONFIG' : 'FILE',
            file_path: relPath,
            functions,
            imports,
          };
          rawNodes.push(node);
          nodeMap.set(entry, node);
        }
      }
    };

    walk(projectPath);

    // Build edges from discovered imports and calls
    for (const node of rawNodes) {
      if (!node.imports) continue;
      for (const imp of node.imports) {
        // Find matching node whose id or filename matches the import
        const matched = rawNodes.find(
          (other) =>
            other.id !== node.id &&
            (other.id === imp || other.id.startsWith(imp) || other.id.replace(/\.[^/.]+$/, '') === imp)
        );
        if (matched) {
          const edgeId = `${node.id}->${matched.id}`;
          if (!rawEdges.some((e) => e.id === edgeId)) {
            rawEdges.push({
              id: edgeId,
              source: node.id,
              target: matched.id,
              relation: 'IMPORTS',
              style: 'SOLID',
            });
          }
        }
      }

      // Add function nodes if important functions exist
      if (node.functions && node.functions.length > 0) {
        for (const funcName of node.functions.slice(0, 3)) {
          const funcId = `${funcName}()`;
          if (!rawNodes.some((n) => n.id === funcId)) {
            rawNodes.push({
              id: funcId,
              label: funcId,
              kind: 'FUNCTION',
              file_path: node.file_path,
              functions: [],
              imports: [],
            });
            rawEdges.push({
              id: `${node.id}->${funcId}`,
              source: node.id,
              target: funcId,
              relation: 'CALLS',
              style: 'SOLID',
            });
          }
        }
      }
    }

    return {
      project_name: projectName,
      generated_at: Date.now(),
      nodes: rawNodes,
      edges: rawEdges,
    };
  }
}
