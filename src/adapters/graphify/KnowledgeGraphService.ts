import path from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';
import chokidar, { type FSWatcher } from 'chokidar';
import type {
  GraphDataSnapshot,
  GraphEdge,
  GraphNode,
  GraphNodeControlCommand,
  GraphNodeVisualState,
} from '../../shared/types';
import type { ShadowWorkspaceManager } from '../../core/workspace/ShadowWorkspaceManager.ts';
import { requiredText, validateHash, WorkspaceError } from '../../core/workspace/WorkspacePaths.ts';
import { GraphifyRunner, type RawGraphOutput } from './GraphifyRunner.ts';

export interface GraphOverrideRow {
  node_id: string;
  state: 'DEFAULT' | 'FOCUSED' | 'EXCLUDED' | 'ERROR';
  error_message?: string | null;
  updated_at: number;
}

export class KnowledgeGraphService {
  private readonly runner: GraphifyRunner;
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly updateListeners = new Set<(snapshot: GraphDataSnapshot) => void>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly workspace: ShadowWorkspaceManager,
    runner?: GraphifyRunner
  ) {
    this.runner = runner || new GraphifyRunner();
  }

  subscribe(listener: (snapshot: GraphDataSnapshot) => void): () => void {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  private notify(snapshot: GraphDataSnapshot): void {
    for (const listener of this.updateListeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Failed to notify graph listener', err);
      }
    }
  }

  /**
   * Retrieves enriched GraphDataSnapshot for a project.
   * Merges raw graph.json, real fs.stat mtimeMs, and SQLite graph_overrides.
   */
  async getGraphData(projectHash: string): Promise<GraphDataSnapshot> {
    validateHash(projectHash);
    const project = this.workspace.getProject(projectHash);
    const graphFilePath = this.workspace.paths.file(projectHash, 'graph.json', true);

    let rawGraph: RawGraphOutput;

    // Generate graph.json if not yet present
    if (!existsSync(graphFilePath)) {
      rawGraph = await this.runner.generateGraph(project.original_path, graphFilePath);
    } else {
      try {
        const content = readFileSync(graphFilePath, 'utf8');
        rawGraph = JSON.parse(content) as RawGraphOutput;
      } catch {
        rawGraph = await this.runner.generateGraph(project.original_path, graphFilePath);
      }
    }

    // Read graph_overrides from SQLite project.db
    const overridesMap = new Map<string, GraphOverrideRow>();
    this.workspace.access(projectHash, (db) => {
      const rows = db.prepare('SELECT node_id, state, error_message, updated_at FROM graph_overrides').all() as unknown as GraphOverrideRow[];
      for (const row of rows) {
        overridesMap.set(row.node_id, row);
      }
    });

    // Build edge lookup map for link_count computation
    const edgeDegreeMap = new Map<string, number>();
    for (const edge of rawGraph.edges) {
      edgeDegreeMap.set(edge.source, (edgeDegreeMap.get(edge.source) || 0) + 1);
      edgeDegreeMap.set(edge.target, (edgeDegreeMap.get(edge.target) || 0) + 1);
    }

    // Enrich nodes
    const enrichedNodes: GraphNode[] = rawGraph.nodes.map((node) => {
      const fullPath = path.resolve(project.original_path, node.file_path);
      let mtimeMs = Date.now();

      try {
        if (existsSync(fullPath)) {
          const stat = statSync(fullPath);
          mtimeMs = Math.round(stat.mtimeMs);
        }
      } catch {
        // Fallback to now if missing
      }

      const override = overridesMap.get(node.id);
      let visualState: GraphNodeVisualState = 'DEFAULT';
      let isFocused = false;
      let errorDetails: string | undefined = undefined;

      if (override) {
        if (override.state === 'FOCUSED') {
          isFocused = true;
        } else if (override.state === 'EXCLUDED') {
          visualState = 'IGNORED';
        } else if (override.state === 'ERROR') {
          visualState = 'ERROR';
          errorDetails = override.error_message || undefined;
        }
      }

      // Default demo agent states if not overridden
      if (visualState === 'DEFAULT') {
        if (node.id === 'pipeline.py') visualState = 'ACTIVE_CHATGPT';
        else if (node.id === 'scene_detect.py') visualState = 'ACTIVE_GEMINI';
        else if (node.id === 'export.py') visualState = 'ERROR';
        else if (node.id.startsWith('.')) visualState = 'IGNORED';
      }

      return {
        id: node.id,
        label: node.label,
        kind: node.kind,
        file_path: node.file_path,
        function_count: node.functions ? node.functions.length : 0,
        link_count: edgeDegreeMap.get(node.id) || 0,
        last_modified_ms: mtimeMs,
        visual_state: visualState,
        is_focused: isFocused,
        error_details: errorDetails,
      };
    });

    const enrichedEdges: GraphEdge[] = rawGraph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
      style: e.style,
      active_agent:
        e.source === 'main.py' && e.target === 'pipeline.py'
          ? 'chatgpt'
          : (e.source === 'pipeline.py' && e.target === 'scene_detect.py') ||
            (e.source === 'scene_detect.py' && e.target === 'score_scene()')
          ? 'gemini'
          : null,
    }));

    return {
      project_hash: projectHash,
      project_name: project.project_name,
      git_branch: project.git_branch || 'main',
      total_nodes: enrichedNodes.length,
      total_edges: enrichedEdges.length,
      is_running: true,
      nodes: enrichedNodes,
      edges: enrichedEdges,
    };
  }

  /**
   * Applies GraphNodeControlCommand (FOCUS | EXCLUDE | RESET) into SQLite graph_overrides.
   */
  async controlGraphNode(command: GraphNodeControlCommand): Promise<GraphDataSnapshot> {
    if (!command || typeof command !== 'object') {
      throw new WorkspaceError('INVALID_ARGUMENT', 'Control command is required');
    }
    const { project_hash: hash, node_id: nodeId, command: action } = command;
    validateHash(hash);
    requiredText(nodeId, 'node_id');

    if (!['FOCUS', 'EXCLUDE', 'RESET'].includes(action)) {
      throw new WorkspaceError('INVALID_ACTION', 'Unsupported graph control command');
    }

    const now = Date.now();

    this.workspace.access(hash, (db) => {
      if (action === 'FOCUS') {
        // Clear previous FOCUSED nodes
        db.prepare("UPDATE graph_overrides SET state = 'DEFAULT', updated_at = ? WHERE state = 'FOCUSED'").run(now);
        // Set new focus
        db.prepare(
          `INSERT INTO graph_overrides (node_id, state, updated_at) VALUES (?, 'FOCUSED', ?)
           ON CONFLICT(node_id) DO UPDATE SET state = 'FOCUSED', updated_at = excluded.updated_at`
        ).run(nodeId, now);
      } else if (action === 'EXCLUDE') {
        db.prepare(
          `INSERT INTO graph_overrides (node_id, state, updated_at) VALUES (?, 'EXCLUDED', ?)
           ON CONFLICT(node_id) DO UPDATE SET state = 'EXCLUDED', updated_at = excluded.updated_at`
        ).run(nodeId, now);
      } else if (action === 'RESET') {
        db.prepare('DELETE FROM graph_overrides WHERE node_id = ?').run(nodeId);
      }
    });

    const snapshot = await this.getGraphData(hash);
    this.notify(snapshot);
    return snapshot;
  }

  /**
   * Starts monitoring project source files via chokidar for Delta Updates.
   */
  startWatching(projectHash: string, projectPath: string): FSWatcher {
    validateHash(projectHash);
    this.stopWatching(projectHash);

    const watcher = chokidar.watch(projectPath, {
      ignoreInitial: true,
      depth: 6,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/dist-electron/**', '**/build/**', '**/.plugins/**'],
    });

    const triggerDeltaUpdate = () => {
      const existingTimer = this.debounceTimers.get(projectHash);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(async () => {
        try {
          const graphFile = this.workspace.paths.file(projectHash, 'graph.json', true);
          // Re-scan and re-generate graph.json directly in shadow workspace
          await this.runner.generateGraph(projectPath, graphFile);
          const snapshot = await this.getGraphData(projectHash);
          this.notify(snapshot);
        } catch (err) {
          console.error('Delta update failed for project', projectHash, err);
        }
      }, 150);

      this.debounceTimers.set(projectHash, timer);
    };

    watcher.on('add', triggerDeltaUpdate);
    watcher.on('change', triggerDeltaUpdate);
    watcher.on('unlink', triggerDeltaUpdate);

    this.watchers.set(projectHash, watcher);
    return watcher;
  }

  /**
   * Stops watching a project directory or all watchers.
   */
  stopWatching(projectHash?: string): void {
    if (projectHash) {
      const watcher = this.watchers.get(projectHash);
      if (watcher) {
        void watcher.close();
        this.watchers.delete(projectHash);
      }
      const timer = this.debounceTimers.get(projectHash);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(projectHash);
      }
    } else {
      for (const watcher of this.watchers.values()) {
        void watcher.close();
      }
      this.watchers.clear();
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();
    }
  }

  dispose(): void {
    this.stopWatching();
    this.updateListeners.clear();
  }
}
