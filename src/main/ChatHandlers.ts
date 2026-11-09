import type { ChatProvider, ProviderRegistry } from '../adapters/ProviderRegistry.ts';
import { WorkspaceError } from '../core/workspace/WorkspacePaths.ts';
import type { ChatReply, ChatTurn, SynapseRequests } from './ipc.ts';

const automaticOrder = ['gemini', 'chatgpt'];
const maxMessageLength = 32_000;

export function createChatHandlers(registry: Pick<ProviderRegistry, 'chatProviders'>) {
  async function send(provider: ChatProvider, message: string, history: ChatTurn[]): Promise<ChatReply> {
    const recent = history.filter((turn) => turn.agentId === provider.id).slice(-3);
    const prompt = recent.length ? `Ngữ cảnh gần đây: ${JSON.stringify(recent.map(({ request, reply }) => ({ request, reply })))}\n\nTin nhắn mới: ${message}` : message;
    const text = (await provider.send(prompt.length <= maxMessageLength ? prompt : message)).trim();
    if (!text) throw new WorkspaceError('CHAT_EMPTY_REPLY', `${provider.label} không trả về văn bản.`);
    return { agentId: provider.id, label: provider.label, text };
  }

  return {
    getChatAgents: async () => (await registry.chatProviders()).map(({ id, label }) => ({ id, label })),
    async sendAgentMessage(target, message, history = []) {
      if (typeof target !== 'string' || typeof message !== 'string' || !message.trim() ||
        message.length > maxMessageLength || !Array.isArray(history) || history.length > 24 ||
        history.some((turn) => !turn || typeof turn.agentId !== 'string' || turn.agentId.length > 64 ||
          typeof turn.request !== 'string' || turn.request.length > 1600 || typeof turn.reply !== 'string' || turn.reply.length > 1600)) {
        throw new WorkspaceError('INVALID_CHAT_REQUEST', 'Tin nhắn phải có nội dung và không vượt quá 32.000 ký tự.');
      }
      const providers = await registry.chatProviders();
      if (target !== 'auto') {
        const id = target === 'gemini_antigravity' ? 'gemini' : target;
        const provider = providers.find((entry) => entry.id === id);
        if (!provider) throw new WorkspaceError('CHAT_AGENT_NOT_CONFIGURED', 'Agent này chưa được cấu hình để chat.');
        return send(provider, message, history);
      }

      const failures: string[] = [];
      for (const id of automaticOrder) {
        const provider = providers.find((entry) => entry.id === id);
        if (!provider) continue;
        try { return await send(provider, message, history); }
        catch (error) {
          if (!(error instanceof WorkspaceError)) throw error;
          failures.push(`${provider.label} — ${error.message}`);
        }
      }
      throw new WorkspaceError('CHAT_AGENTS_UNAVAILABLE', failures.join(' · ') ||
        'Hãy kết nối Gemini hoặc ChatGPT trong Cài đặt.');
    },
  } satisfies Pick<SynapseRequests, 'getChatAgents' | 'sendAgentMessage'>;
}
