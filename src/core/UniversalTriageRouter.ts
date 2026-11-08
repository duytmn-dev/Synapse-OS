import { DAGExecutor, type DAGTask, type ExecutionResult } from './DAGExecutor.ts';

export interface TriageRequest {
  message: string;
  /** An upstream planner supplies executable tasks; plain chat needs no plan. */
  tasks?: readonly DAGTask[];
  path?: 'FAST' | 'DAG';
}

export type TriageResult<T> =
  | { path: 'FAST'; response: T }
  | { path: 'DAG'; execution: ExecutionResult };

/** Deterministic routing: explicit path wins; an executable plan implies DAG.
 * No keyword guessing that could execute work when the user only asks about it.
 */
export class UniversalTriageRouter<T = string> {
  private readonly executor: DAGExecutor;
  private readonly chat: (message: string, signal?: AbortSignal) => Promise<T> | T;

  constructor(executor: DAGExecutor, chat: (message: string, signal?: AbortSignal) => Promise<T> | T) {
    this.executor = executor;
    this.chat = chat;
  }

  classify(request: TriageRequest): 'FAST' | 'DAG' {
    if (!request.message.trim()) throw new Error('Message must not be empty');
    if (request.path !== undefined && request.path !== 'FAST' && request.path !== 'DAG') throw new Error('Unknown route');
    if (request.path === 'FAST' && request.tasks?.length) throw new Error('FAST requests cannot contain a DAG plan');
    const path = request.path ?? (request.tasks?.length ? 'DAG' : 'FAST');
    if (path === 'DAG' && !request.tasks?.length) throw new Error('DAG route requires a non-empty executable plan');
    return path;
  }

  async route(request: TriageRequest, options: { signal?: AbortSignal } = {}): Promise<TriageResult<T>> {
    const path = this.classify(request);
    options.signal?.throwIfAborted();
    if (path === 'FAST') return { path, response: await this.chat(request.message, options.signal) };
    return { path, execution: await this.executor.execute(request.tasks!, options) };
  }
}
