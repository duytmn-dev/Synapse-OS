import type { AgentBrandId, DAGTaskItem, VisualOfficeEvent } from '../shared/types';
import type { GraphActivity, GraphOperation } from './GraphActivity.ts';

export interface TaskContext {
  signal: AbortSignal;
  taskCode: string;
  /** Only successful, declared prerequisites (groups expand to their leaves). */
  dependencies: ReadonlyMap<string, unknown>;
  withFile<T>(operation: Omit<GraphOperation, 'agent_id' | 'task_code'>, work: () => T | Promise<T>): Promise<T>;
}

/** A task is either a runnable leaf or a group of children, never both.
 * Group prerequisites apply to every descendant; groups consume no worker slots.
 * Handlers must honor signal and must not synchronously block the event loop.
 */
export interface DAGTask {
  code: string;
  title: string;
  agent: AgentBrandId;
  dependsOn?: readonly string[];
  children?: readonly DAGTask[];
  run?: (context: TaskContext) => unknown | Promise<unknown>;
  timeoutMs?: number;
  /** Declared file access is protected for the full lifetime of the task handler. */
  graph?: Omit<GraphOperation, 'agent_id' | 'task_code'>;
}

export interface ExecutionResult {
  tasks: DAGTaskItem[];
  outputs: ReadonlyMap<string, unknown>;
  errors: ReadonlyMap<string, Error>;
}

interface Node {
  task: DAGTask;
  children: Node[];
  leaves: string[];
  inherited: string[];
}
interface Leaf {
  node: Node;
  dependencies: Set<string>;
  status: DAGTaskItem['status'];
}

const roomFor = (agent: AgentBrandId): VisualOfficeEvent['room_id'] => {
  switch (agent.toLowerCase()) {
    case 'codex': return 'CODEX';
    case 'gemini': return 'GEMINI_AGY';
    case 'chatgpt': return 'CHATGPT';
    case 'claude': return 'CLAUDE_EXT';
    default: return 'MANAGER';
  }
};
const asError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error));

export class DAGExecutor {
  private active = false;
  private snapshots: DAGTaskItem[] = [];
  private readonly taskListeners = new Set<(tasks: DAGTaskItem[]) => void>();
  private readonly officeListeners = new Set<(event: VisualOfficeEvent) => void>();
  private readonly concurrency: number;
  private readonly timeoutMs: number;
  private graphActivity?: GraphActivity;

  connectGraphActivity(activity: GraphActivity): void {
    if (this.active) throw new Error('Cannot replace graph activity during execution');
    this.graphActivity = activity;
  }

  constructor(options: { concurrency?: number; timeoutMs?: number } = {}) {
    this.concurrency = options.concurrency ?? 3;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    if (!Number.isSafeInteger(this.concurrency) || this.concurrency < 1) {
      throw new Error('concurrency must be a positive safe integer');
    }
    this.validateTimeout(this.timeoutMs);
  }

  getTasks(): DAGTaskItem[] { return structuredClone(this.snapshots); }

  onTasksUpdated(listener: (tasks: DAGTaskItem[]) => void): () => void {
    this.taskListeners.add(listener);
    return () => { this.taskListeners.delete(listener); };
  }

  onOfficeUpdated(listener: (event: VisualOfficeEvent) => void): () => void {
    this.officeListeners.add(listener);
    return () => { this.officeListeners.delete(listener); };
  }

  private validateTimeout(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
      throw new Error('timeoutMs must be an integer between 1 and 2147483647');
    }
  }

  private emitOffice(event: VisualOfficeEvent): void {
    for (const listener of [...this.officeListeners]) {
      // Observers must never break scheduling or resource release.
      try { listener({ ...event }); } catch { /* Isolate observer failures. */ }
    }
  }

  async execute(tasks: readonly DAGTask[], options: { signal?: AbortSignal } = {}): Promise<ExecutionResult> {
    if (this.active) throw new Error('This executor already has an active DAG');
    this.active = true;
    try { return await this.executeGraph(tasks, options.signal); }
    finally { this.active = false; }
  }

  private async executeGraph(tasks: readonly DAGTask[], signal?: AbortSignal): Promise<ExecutionResult> {
    const nodes = new Map<string, Node>();
    const leaves = new Map<string, Leaf>();
    const visit = (task: DAGTask, inherited: string[]): Node => {
      if (!task.code?.trim() || nodes.has(task.code)) throw new Error(`Invalid or duplicate task code: ${task.code}`);
      if (!task.title?.trim() || !task.agent?.trim()) throw new Error(`Missing title or agent: ${task.code}`);
      if (task.timeoutMs !== undefined) this.validateTimeout(task.timeoutMs);
      if (task.graph && !this.graphActivity) throw new Error('GRAPH_SERVICE_UNAVAILABLE: Connect GraphActivity before running file tasks');
      const children = task.children ?? [];
      if (children.length ? task.run !== undefined : typeof task.run !== 'function') {
        throw new Error(`Task ${task.code} must have either children or a run handler`);
      }
      const copy = { ...task, dependsOn: [...(task.dependsOn ?? [])] };
      const node: Node = { task: copy, children: [], leaves: [], inherited };
      nodes.set(task.code, node);
      node.children = children.map((child) => visit(child, [...inherited, ...copy.dependsOn]));
      node.leaves = children.length ? node.children.flatMap((child) => child.leaves) : [task.code];
      if (!children.length) leaves.set(task.code, { node, dependencies: new Set(), status: 'WAITING' });
      return node;
    };
    tasks.forEach((task) => visit(task, []));
    for (const leaf of leaves.values()) {
      for (const code of [...leaf.node.inherited, ...(leaf.node.task.dependsOn ?? [])]) {
        const prerequisite = nodes.get(code);
        if (!prerequisite) throw new Error(`Unknown prerequisite ${code} for ${leaf.node.task.code}`);
        for (const dependency of prerequisite.leaves) leaf.dependencies.add(dependency);
      }
    }
    // Validate the expanded graph BEFORE any handler or event runs. This catches
    // ancestor/descendant deadlocks as well as ordinary dependency cycles.
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const check = (code: string): void => {
      if (visiting.has(code)) throw new Error(`DAG cycle involving ${code}`);
      if (visited.has(code)) return;
      visiting.add(code);
      for (const dependency of leaves.get(code)!.dependencies) check(dependency);
      visiting.delete(code);
      visited.add(code);
    };
    for (const code of leaves.keys()) check(code);

    const outputs = new Map<string, unknown>();
    const errors = new Map<string, Error>();
    const running = new Map<string, Promise<void>>();
    const desks = new Set<string>();
    const state = (node: Node): DAGTaskItem['status'] => {
      const statuses = node.leaves.map((code) => leaves.get(code)!.status);
      if (statuses.every((status) => status === 'COMPLETED')) return 'COMPLETED';
      if (statuses.every((status) => status === 'COMPLETED' || status === 'FAILED')) return 'FAILED';
      if (statuses.every((status) => status === 'WAITING')) return 'WAITING';
      return 'RUNNING';
    };
    const publish = (): void => {
      // Include groups at every depth; sub_tasks references their immediate children.
      this.snapshots = [...nodes.values()].map((node) => ({
        step_code: node.task.code, title: node.task.title, assigned_agent: node.task.agent,
        status: state(node),
        ...(node.children.length ? { sub_tasks: node.children.map((child) => ({
          sub_code: child.task.code, title: child.task.title, status: state(child),
        })) } : {}),
      }));
      for (const listener of [...this.taskListeners]) {
        try { listener(this.getTasks()); } catch { /* Isolate observer failures. */ }
      }
    };
    const invoke = async (leaf: Leaf, desk: VisualOfficeEvent['desk_index']): Promise<void> => {
      const task = leaf.node.task;
      const room = roomFor(task.agent);
      const key = `${room}:${desk}`;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: () => void = () => {};
      try {
        const interrupted = new Promise<never>((_resolve, reject) => {
          abort = () => {
            const reason = asError(signal?.reason ?? new Error('DAG cancelled'));
            reject(reason);
            controller.abort(reason);
          };
          signal?.addEventListener('abort', abort, { once: true });
          timer = setTimeout(() => {
            const reason = new Error(`Task ${task.code} timed out`);
            reject(reason);
            controller.abort(reason);
          }, task.timeoutMs ?? this.timeoutMs);
          if (signal?.aborted) abort();
        });
        this.emitOffice({ room_id: room, desk_index: desk, active_task_code: task.code, animation_state: 'THINKING' });
        const work = Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          this.emitOffice({ room_id: room, desk_index: desk, active_task_code: task.code, animation_state: 'TYPING' });
          const run = () => task.run!({ signal: controller.signal, taskCode: task.code,
            dependencies: new Map([...leaf.dependencies].map((code) => [code, outputs.get(code)])),
            withFile: (operation, work) => {
              if (!this.graphActivity) return Promise.reject(new Error('GRAPH_SERVICE_UNAVAILABLE'));
              return this.graphActivity.run({ ...operation, agent_id: task.agent as GraphOperation['agent_id'], task_code: task.code }, work, controller.signal);
            },
          });
          return task.graph ? this.graphActivity!.run({ ...task.graph, agent_id: task.agent as GraphOperation['agent_id'], task_code: task.code }, run, controller.signal) : run();
        });
        outputs.set(task.code, await Promise.race([work, interrupted]));
        leaf.status = 'COMPLETED';
        this.emitOffice({ room_id: room, desk_index: desk, active_task_code: task.code, animation_state: 'DONE' });
      } catch (error) {
        leaf.status = 'FAILED';
        errors.set(task.code, asError(error));
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        desks.delete(key);
        this.emitOffice({ room_id: room, desk_index: desk, active_task_code: null, animation_state: 'IDLE' });
        publish();
      }
    };
    publish();
    while ([...leaves.values()].some((leaf) => leaf.status === 'WAITING') || running.size) {
      let changed = false;
      for (const [code, leaf] of leaves) {
        if (leaf.status !== 'WAITING') continue;
        if (signal?.aborted || [...leaf.dependencies].some((dep) => leaves.get(dep)!.status === 'FAILED')) {
          leaf.status = 'FAILED';
          errors.set(code, asError(signal?.aborted ? signal.reason ?? 'DAG cancelled' : `Prerequisite failed for ${code}`));
          changed = true;
          continue;
        }
        if (running.size >= this.concurrency || [...leaf.dependencies].some((dep) => leaves.get(dep)!.status !== 'COMPLETED')) continue;
        const room = roomFor(leaf.node.task.agent);
        const desk = ([0, 1, 2] as const).find((index) => !desks.has(`${room}:${index}`));
        if (desk === undefined) continue;
        desks.add(`${room}:${desk}`);
        leaf.status = 'RUNNING';
        publish();
        const work = invoke(leaf, desk).finally(() => { running.delete(code); });
        running.set(code, work);
      }
      if (changed) { publish(); continue; }
      if (running.size) await Promise.race(running.values());
      else if ([...leaves.values()].some((leaf) => leaf.status === 'WAITING')) {
        throw new Error('DAG scheduler stalled');
      }
    }
    return { tasks: this.getTasks(), outputs, errors };
  }
}
