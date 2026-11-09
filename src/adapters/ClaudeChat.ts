import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';

export async function sendClaudeMessage(key: string | null, message: string, transport: typeof fetch = fetch): Promise<string> {
  if (!key) throw new WorkspaceError('CLAUDE_API_KEY_REQUIRED', 'Lưu API key Anthropic ở thẻ Claude trong Cài đặt để chat.');
  if (!key.trim() || /[\r\n]/.test(key)) throw new WorkspaceError('INVALID_API_KEY', 'API key Anthropic không hợp lệ.');
  try {
    const response = await transport('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: process.env.SYNAPSE_CLAUDE_MODEL?.trim() || 'claude-sonnet-5-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: message }],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        throw new WorkspaceError('CLAUDE_API_KEY_REJECTED', 'Anthropic từ chối API key. Hãy kiểm tra key và quyền truy cập.');
      }
      throw new WorkspaceError('CLAUDE_CHAT_FAILED', `Anthropic trả về HTTP ${response.status}.`);
    }
    const result: { content?: { type?: string; text?: string }[] } | null = await response.json();
    if (!Array.isArray(result?.content)) throw new WorkspaceError('CLAUDE_RESPONSE_INVALID', 'Anthropic trả về định dạng không hợp lệ.');
    return result.content.filter((item) => item?.type === 'text' && typeof item.text === 'string').map((item) => item.text).join('\n');
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError('CLAUDE_CONNECTION_FAILED', 'Không nhận được phản hồi hợp lệ từ Anthropic.');
  }
}
