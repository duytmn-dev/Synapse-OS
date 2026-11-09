import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sendClaudeMessage } from '../../src/adapters/ClaudeChat.ts';
import { ProviderRegistry, type ChatProvider } from '../../src/adapters/ProviderRegistry.ts';
import { WorkspaceError } from '../../src/core/workspace/WorkspacePaths.ts';
import { createChatHandlers } from '../../src/main/ChatHandlers.ts';

test('automatic chat prefers Gemini and falls back to ChatGPT; explicit agents only run themselves', async () => {
  const calls: { id: string; message: string }[] = [];
  let geminiAvailable = true;
  let chatGPTAvailable = true;
  const providers: ChatProvider[] = ['claude', 'codex', 'chatgpt', 'gemini'].map((id) => ({
    id, label: id,
    async send(message) {
      calls.push({ id, message });
      if (id === 'gemini' && !geminiAvailable) throw new WorkspaceError('AGY_AUTH_REQUIRED', 'Connect Gemini');
      if (id === 'chatgpt' && !chatGPTAvailable) throw new WorkspaceError('CHATGPT_NOT_LINKED', 'Connect ChatGPT');
      return 'response';
    },
  }));
  const handlers = createChatHandlers({ chatProviders: async () => providers });
  const history = [
    { agentId: 'gemini', request: 'prior Gemini user', reply: 'prior Gemini response' },
    { agentId: 'chatgpt', request: 'prior ChatGPT user', reply: 'prior ChatGPT response' },
  ];
  assert.equal((await handlers.sendAgentMessage('auto', 'hello', history)).agentId, 'gemini');
  assert.deepEqual(calls.splice(0).map(({ id }) => id), ['gemini']);
  geminiAvailable = false;
  assert.equal((await handlers.sendAgentMessage('auto', 'hello', history)).agentId, 'chatgpt');
  assert.deepEqual(calls.map(({ id }) => id), ['gemini', 'chatgpt']);
  assert.match(calls[1].message, /prior ChatGPT response/);
  assert.doesNotMatch(calls[1].message, /prior Gemini/);
  calls.length = 0;
  await assert.rejects(handlers.sendAgentMessage('gemini', 'hello'), /AGY_AUTH_REQUIRED/);
  assert.equal((await handlers.sendAgentMessage('claude', 'hello')).agentId, 'claude');
  assert.equal((await handlers.sendAgentMessage('codex', 'hello')).agentId, 'codex');
  assert.deepEqual(calls.map(({ id }) => id), ['gemini', 'claude', 'codex']);
  chatGPTAvailable = false;
  await assert.rejects(handlers.sendAgentMessage('auto', 'hello'), /CHAT_AGENTS_UNAVAILABLE:.*Connect Gemini.*Connect ChatGPT/);
  await assert.rejects(handlers.sendAgentMessage('other', 'hello'), /CHAT_AGENT_NOT_CONFIGURED/);
});

test('a configured provider can be discovered and execute through the same chat IPC handler', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'synapse-chat-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('synapse-chat-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const handlers = createChatHandlers(new ProviderRegistry(root));
  assert.deepEqual(await handlers.getChatAgents(), []);
  await writeFile(path.join(root, 'agent-providers.json'), JSON.stringify({
    'my-agent': {
      display_name: 'My Agent', role_description: 'Configured chat wrapper',
      commands: { chat: { executable: process.execPath, args: ['-p', 'require("node:fs").readFileSync(0, "utf8")'] } },
    },
  }));
  assert.deepEqual(await handlers.getChatAgents(), [{ id: 'my-agent', label: 'My Agent' }]);
  const prompt = 'Tin nhắn "\'$(echo never execute)';
  assert.deepEqual(await handlers.sendAgentMessage('my-agent', prompt), { agentId: 'my-agent', label: 'My Agent', text: prompt });
});

test('Claude chat uses the Anthropic Messages endpoint and returns only text blocks', async () => {
  const key = 'fixture-claude-key';
  const reply = await sendClaudeMessage(key, 'hello', async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('x-api-key'), key);
    assert.deepEqual(JSON.parse(String(init?.body)).messages, [{ role: 'user', content: 'hello' }]);
    return Response.json({ content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: 'Xin chào' }] });
  });
  assert.equal(reply, 'Xin chào');
  await assert.rejects(sendClaudeMessage(null, 'hello'), /CLAUDE_API_KEY_REQUIRED/);
  await assert.rejects(sendClaudeMessage(key, 'hello', async () => new Response(key, { status: 401 })), (error: Error) => {
    assert.match(error.message, /CLAUDE_API_KEY_REJECTED/);
    assert.doesNotMatch(error.message, /fixture-claude-key/);
    return true;
  });
});
