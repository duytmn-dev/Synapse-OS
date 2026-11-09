import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { ShadowWorkspaceManager } from '../../src/core/workspace/ShadowWorkspaceManager.ts';
import { WorkspacePaths } from '../../src/core/workspace/WorkspacePaths.ts';
import { GraphifyRunner } from '../../src/adapters/graphify/GraphifyRunner.ts';
import { KnowledgeGraphService } from '../../src/adapters/graphify/KnowledgeGraphService.ts';
import { createGraphHandlers } from '../../src/main/GraphHandlers.ts';
import { registerPhase0Handlers } from '../../src/main/Phase0Handlers.ts';
import { IPC } from '../../src/main/ipc.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-graph-'));
  const project = path.join(root, 'source');
  const userData = path.join(root, 'AppData', 'SynapseOS');
  mkdirSync(project, { recursive: true });

  // Create real project files
  writeFileSync(
    path.join(project, 'pipeline.py'),
    `import scene_detect\nfrom config import settings\n\ndef process_video():\n    pass\n\ndef extract_frames():\n    pass\n`
  );
  writeFileSync(
    path.join(project, 'scene_detect.py'),
    `def detect_scenes():\n    return []\n`
  );
  writeFileSync(
    path.join(project, 'config.yaml'),
    `version: 1\n`
  );

  const manager = new ShadowWorkspaceManager(userData);
  const runner = new GraphifyRunner();
  const service = new KnowledgeGraphService(manager, runner);

  t.after(() => {
    service.dispose();
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  return { root, project, userData, manager, runner, service };
}

function snapshot(directory: string): unknown[] {
  return readdirSync(directory).sort().map((name) => {
    const file = path.join(directory, name);
    const info = lstatSync(file);
    return [name, info.mtimeMs, info.isDirectory() ? snapshot(file) : createHash('sha256').update(readFileSync(file)).digest('hex')];
  });
}

test('GraphifyRunner generates graph.json strictly inside shadow workspace with zero project pollution', async (t) => {
  const { project, userData, runner, manager } = fixture(t);
  const beforeSnapshot = snapshot(project);

  const p = await manager.openProject(project);
  const hash = p.project_hash;
  const paths = new WorkspacePaths(userData);
  const graphOutputFile = paths.file(hash, 'graph.json', true);

  const rawGraph = await runner.generateGraph(project, graphOutputFile);

  // 1. Verify output file exists in shadow workspace
  assert.ok(existsSync(graphOutputFile), 'graph.json must exist in shadow workspace');

  // 2. Verify graph structure contains nodes and edges
  assert.ok(rawGraph.nodes.length >= 3, 'Must discover pipeline.py, scene_detect.py, config.yaml');
  const pipelineNode = rawGraph.nodes.find((n) => n.id === 'pipeline.py');
  assert.ok(pipelineNode, 'pipeline.py node must be present');
  assert.equal(pipelineNode.functions?.length, 2, 'process_video and extract_frames must be extracted');

  // 3. Verify edges generated for imports
  const importEdge = rawGraph.edges.find((e) => e.source === 'pipeline.py' && e.target === 'scene_detect.py');
  assert.ok(importEdge, 'Import edge between pipeline.py and scene_detect.py must exist');

  // 4. Verify ZERO project pollution on source directory
  const afterSnapshot = snapshot(project);
  assert.deepEqual(afterSnapshot, beforeSnapshot, 'Project directory must remain completely clean and untouched');
});

test('GraphifyRunner rejects output paths that overlap with project source', async (t) => {
  const { project, runner } = fixture(t);
  const illegalOutput = path.join(project, 'graph.json');

  await assert.rejects(
    async () => runner.generateGraph(project, illegalOutput),
    { message: /PROJECT_POLLUTION_BLOCKED/ }
  );
});

test('KnowledgeGraphService enriches GraphDataSnapshot with real mtime, overrides and degree stats', async (t) => {
  const { project, manager, service } = fixture(t);
  const p = await manager.openProject(project);
  const hash = p.project_hash;

  const snapshotData = await service.getGraphData(hash);

  assert.equal(snapshotData.project_hash, hash);
  assert.equal(snapshotData.project_name, path.basename(project));
  assert.ok(snapshotData.total_nodes >= 3);
  assert.ok(snapshotData.total_edges >= 1);
  assert.equal(snapshotData.is_running, true);

  const pipeline = snapshotData.nodes.find((n) => n.id === 'pipeline.py');
  assert.ok(pipeline);
  assert.equal(pipeline.function_count, 2);
  assert.ok(pipeline.link_count >= 1);

  // Verify real file stat mtime
  const realMtime = Math.round(statSync(path.join(project, 'pipeline.py')).mtimeMs);
  assert.equal(pipeline.last_modified_ms, realMtime);
});

test('KnowledgeGraphService handles FOCUS, EXCLUDE and RESET commands via SQLite graph_overrides', async (t) => {
  const { project, manager, service } = fixture(t);
  const p = await manager.openProject(project);
  const hash = p.project_hash;

  // 1. FOCUS pipeline.py
  const focusedSnap = await service.controlGraphNode({
    project_hash: hash,
    node_id: 'pipeline.py',
    command: 'FOCUS',
  });
  const focusedNode = focusedSnap.nodes.find((n) => n.id === 'pipeline.py');
  assert.ok(focusedNode);
  assert.equal(focusedNode.is_focused, true);

  // 2. EXCLUDE scene_detect.py
  const excludedSnap = await service.controlGraphNode({
    project_hash: hash,
    node_id: 'scene_detect.py',
    command: 'EXCLUDE',
  });
  const excludedNode = excludedSnap.nodes.find((n) => n.id === 'scene_detect.py');
  assert.ok(excludedNode);
  assert.equal(excludedNode.visual_state, 'IGNORED');

  // 3. RESET scene_detect.py
  const resetSnap = await service.controlGraphNode({
    project_hash: hash,
    node_id: 'scene_detect.py',
    command: 'RESET',
  });
  const resetNode = resetSnap.nodes.find((n) => n.id === 'scene_detect.py');
  assert.ok(resetNode);
  assert.notEqual(resetNode.visual_state, 'IGNORED');
});

test('chokidar watcher triggers delta updates when files are added or modified', async (t) => {
  const { project, manager, service } = fixture(t);
  const p = await manager.openProject(project);
  const hash = p.project_hash;

  let updateReceived: unknown = null;
  service.subscribe((snap) => {
    updateReceived = snap;
  });

  const watcher = service.startWatching(hash, project);

  // Wait for chokidar watcher to be ready
  await new Promise<void>((resolve) => {
    watcher.on('ready', () => resolve());
  });

  // Write new file into project
  writeFileSync(
    path.join(project, 'exporter.py'),
    `def export_mp4():\n    pass\n`
  );

  // Poll for debounced delta update
  for (let i = 0; i < 30; i++) {
    if (updateReceived) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  assert.ok(updateReceived, 'Delta update listener must receive new snapshot on file addition');
  const snap = updateReceived as { nodes: { id: string }[] };
  const exporter = snap.nodes.find((n) => n.id === 'exporter.py');
  assert.ok(exporter, 'Newly added exporter.py must be discovered in delta update');
});

test('real IPC handlers dispatch getGraphData and controlGraphNode with authorized sender', async (t) => {
  const { project, manager, service } = fixture(t);
  const p = await manager.openProject(project);
  const hash = p.project_hash;

  const fakeFrame = {};
  const fakeContents = {
    isDestroyed: () => false,
    mainFrame: fakeFrame,
    send: (_channel: string, _data: unknown) => {},
  } as unknown as WebContents;

  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const fakeIpc = {
    handle: (channel: string, listener: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, listener);
    },
    removeHandler: (channel: string) => {
      handlers.delete(channel);
    },
  };

  const graphHandlers = createGraphHandlers(service, () => fakeContents);
  const dispose = registerPhase0Handlers(fakeIpc as any, () => fakeContents, graphHandlers);

  const event = {
    sender: fakeContents,
    senderFrame: fakeFrame,
  } as unknown as IpcMainInvokeEvent;

  // 1. Test getGraphData handler
  const getGraphHandler = handlers.get(IPC.getGraphData);
  assert.ok(getGraphHandler);
  const resGraph = (await getGraphHandler(event, hash)) as { project_hash: string };
  assert.equal(resGraph.project_hash, hash);

  // 2. Test controlGraphNode handler
  const controlHandler = handlers.get(IPC.controlGraphNode);
  assert.ok(controlHandler);
  await controlHandler(event, { project_hash: hash, node_id: 'pipeline.py', command: 'FOCUS' });

  // Verify focus state in database
  const afterFocus = await service.getGraphData(hash);
  const pipelineNode = afterFocus.nodes.find((n) => n.id === 'pipeline.py');
  assert.equal(pipelineNode?.is_focused, true);

  // 3. Test untrusted sender rejects
  const untrustedEvent = { sender: {} as any, senderFrame: {} as any } as IpcMainInvokeEvent;
  await assert.rejects(
    async () => getGraphHandler(untrustedEvent, hash),
    { message: /UNTRUSTED_SENDER/ }
  );

  dispose();
});

test('GraphifyRunner runs on real codebase itself: discovers files/functions, accurate mtime, zero repo pollution', async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'synapse-real-graph-'));
  const userData = path.join(root, 'AppData', 'SynapseOS');
  const projectDir = path.resolve('.');

  const manager = new ShadowWorkspaceManager(userData);
  const runner = new GraphifyRunner();
  const service = new KnowledgeGraphService(manager, runner);

  t.after(() => {
    service.dispose();
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  const p = await manager.openProject(projectDir);
  const hash = p.project_hash;

  // Generate enriched snapshot on this actual project
  const snapshotData = await service.getGraphData(hash);

  assert.equal(snapshotData.project_hash, hash);
  assert.ok(snapshotData.total_nodes > 10, 'Must discover project files');
  assert.ok(snapshotData.total_edges > 5, 'Must discover imports and dependencies');

  // Verify real file node exists
  const appNode = snapshotData.nodes.find((n) => n.id === 'App.tsx');
  assert.ok(appNode, 'App.tsx must be present in knowledge graph');
  assert.ok(appNode.last_modified_ms > 0, 'Last modified timestamp must be real');

  // Verify zero pollution: no graph.json or db created in projectDir
  assert.equal(existsSync(path.join(projectDir, 'graph.json')), false, 'graph.json must NEVER be in project root');
  assert.equal(existsSync(path.join(projectDir, 'project.db')), false, 'project.db must NEVER be in project root');
});

