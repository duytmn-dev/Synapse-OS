import type { AgentId } from '../shared/types';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import { validateAgent } from '../core/concurrency/FileLockManager.ts';

/** List-models probes authenticate without generating billable model output.
 * Fixed HTTPS endpoints; redirects never receive credentials. */
export async function checkProviderKey(agent: AgentId, key: string, transport: typeof fetch = fetch): Promise<boolean> {
  validateAgent(agent);
  if (typeof key !== 'string' || !key.trim() || key.length > 16384 || /[\r\n]/.test(key)) throw new WorkspaceError('INVALID_API_KEY', 'Invalid API key');
  const url = agent === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1'
    : agent === 'claude' ? 'https://api.anthropic.com/v1/models?limit=1' : 'https://api.openai.com/v1/models';
  const headers: Record<string, string> = agent === 'gemini' ? { 'x-goog-api-key': key }
    : agent === 'claude' ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${key}` };
  try {
    const response = await transport(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (response.status === 401 || response.status === 403 || (agent === 'gemini' && response.status === 400)) {
      await response.body?.cancel();
      return false;
    }
    if (!response.ok) { await response.body?.cancel(); throw new WorkspaceError('API_CHECK_FAILED', `Provider returned HTTP ${response.status}`); }
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>)[agent === 'gemini' ? 'models' : 'data'])) {
      throw new WorkspaceError('API_RESPONSE_INVALID', 'Provider returned an unexpected models response');
    }
    return true;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    // Never include response bodies, request headers or credential-bearing causes in IPC errors.
    throw new WorkspaceError('API_CONNECTION_FAILED', 'Provider request failed or timed out');
  }
}
