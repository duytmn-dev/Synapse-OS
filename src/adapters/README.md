# Backend adapter integration (Phase 2)

## Phase 3: provider configuration and real settings

The Codex card supports ChatGPT OAuth through the installed Codex App Server.
Click **Connect** in Settings and finish authorization in the default browser.
An explicit `SYNAPSE_CODEX_EXECUTABLE` takes priority. Otherwise Synapse OS searches
PATH and, on Windows, falls back to the installed OpenAI Codex Desktop package
registered for the current user.
This connection uses `userData/codex-account` as its Codex home and requires
Codex's OS credential store. Unknown quotas are shown as a dash. A custom
`codex` entry overrides the built-in connection.

The ChatGPT card links to the built-in Codex ChatGPT session and labels the
displayed quota as shared with Codex. Disconnect removes the Synapse OS link.
Claude uses native Claude Code (`claude auth login/status/logout`) with
`CLAUDE_CONFIG_DIR` under Synapse userData. Gemini uses the native Antigravity
CLI (`agy acp`) and its advertised Google browser sign-in. Install the respective
official CLI first. Override native executable discovery with
`SYNAPSE_CLAUDE_EXECUTABLE` or `SYNAPSE_AGY_EXECUTABLE` if needed.
Google authentication uses the CLI's existing cached session and may require
`/logout` in its terminal if the installed ACP version has no logout capability.
ACP supplies the selected model when the provider advertises it. For Gemini
model-group quotas, run `/usage` in Antigravity CLI.

For custom providers, put `agent-providers.json` in Electron `userData`
(`%APPDATA%/SynapseOS` on Windows).
It is a JSON object keyed by provider ID. Account and quota settings recognize the
canonical `codex`, `gemini`, `chatgpt`, and `claude` IDs.
Each entry contains `display_name`, `role_description`, and `commands`. A command
contains an absolute native `executable` path, an optional string-array `args`, and
optional `timeoutMs`. For built-in IDs, `commands.status` is required; `check_cli`,
`connect`, `disconnect`, and `chat` are optional.
This configuration is backend-only; renderer IPC cannot supply executables.

The status executable/wrapper must query its actual provider session and emit one
JSON object with `connection_status` (`CONNECTED`, `DISCONNECTED`, `OUT_OF_QUOTA`),
`auth_method`, numeric `quota_5h_percent` and `quota_week_percent` in 0..100, and an
optional actual `worker_model_name`. Missing quota rejects with `QUOTA_UNAVAILABLE`;
missing configuration rejects with `PROVIDER_NOT_CONFIGURED`. Do not use sample
numbers or infer authentication from a version command's success. A wrapper without
quota access must report failure rather than fabricate a complete status profile.
To add a provider to the `@Agent` menu, use a new ID with `commands.chat`.
The wrapper reads a UTF-8 prompt from stdin, authenticates with its provider,
writes only the reply to stdout and exits with a nonzero status on failure.
Synapse OS runs the wrapper from its own userData subdirectory.

```json
{
  "my-agent": {
    "display_name": "My Agent",
    "role_description": "Text chat",
    "commands": {
      "chat": {
        "executable": "C:/Tools/my-agent-chat.exe",
        "args": []
      }
    }
  }
}
```

Automatic chat tries Gemini first, then ChatGPT. Explicit `@Agent` selection
routes the message only to the selected provider. ChatGPT uses the linked Codex
account. Claude uses the Anthropic key saved in Settings and defaults to
`claude-sonnet-5-5`; set `SYNAPSE_CLAUDE_MODEL` to use another available model.

Keys are saved through `saveAgentKey` and checked through
`agentConnectionAction(agent, 'CHECK_API')`. The fixed, redirect-disabled probes
use [OpenAI models](https://developers.openai.com/api/reference/resources/models/methods/list),
[Gemini models](https://ai.google.dev/api/models), and
[Anthropic models](https://platform.claude.com/docs/en/api/models/list).
Only safeStorage ciphertext is persisted; plaintext reads are main-process only.
IPC returns a fixed mask and verification state. Network/HTTP errors never echo
headers or provider error bodies. Verification is invalidated when the key changes.
No user key or account was configured by the Phase 3 implementation.

`tool-providers.json` optionally configures `graphify` and `python_scripts` with
`directory` (inside userData), `check` and optional `install` commands in the same
native-command format. Without a configuration these managed tools are uninstalled;
install requests fail explicitly. FFmpeg uses the existing pinned SHA-256 installer.
`updates/ready.json` may specify `version`, a basename-only `filename`, and `sha256`;
readiness is true only after the local artifact exists and passes the digest check.
Appearance preferences have to be saved explicitly; there are no simulated defaults.

## Phase 3: cooperative file locks and graph events

All participating agents must acquire the same project's SQLite locks **before**
file access. These are cooperative locks; they do not intercept unrelated editors
or autonomous CLI writes outside the configured wrapper. Use the canonical project
path so path aliases cannot create separate lock databases. The existing `node_id`
primary key is retained: both readers and writers are serialized per file. Migration
to schema version 2 adds an ownership token without removing any existing locks.
Locks do not expire automatically, because a timed-out process might still write.
After a crash, an abandoned lock produces `LOCK_TIMEOUT`; an operator must first
confirm the old process stopped before removing that row. No automatic lock stealing.

Connect `GraphActivity` to `DAGExecutor`. Use `TaskContext.withFile(operation, work)`
for each actual read/write, or declare one `task.graph` operation for the entire
task. `operation` specifies `project_hash`, `worker_model_name`, `file_path`,
`target_node_id`, `mode`, and optional `source_node_id`. A source produces
`FLOW_TRANSITION` followed by `READING`/`WRITING`; completion produces `IDLE`, and
failure produces `ERROR` then `IDLE`. Task codes and agents are supplied by the DAG.
The source/target IDs and model must come from verified execution metadata, never
guessed from arbitrary CLI output. Lock the file path even for a FUNCTION node.

CLI adapters accept `options.graph` and a `GraphActivity` constructor dependency;
the main-process `createAgentCLIAdapter` factory supplies it. The lock spans the
actual child lifetime, including cancellation. Do not wrap the same file twice
(for example both `task.graph` and the adapter's `options.graph`), since locks are
intentionally non-reentrant across tasks of the same agent.

Run all tests including external smoke checks in PowerShell:

```powershell
$env:SYNAPSE_MEDIA_SMOKE='1'
$env:SYNAPSE_PROVIDER_SMOKE='1'
node --experimental-transform-types --experimental-vm-modules --test "src/**/*.test.ts" "tests/**/*.test.ts"
```

The provider smoke tests use deliberately invalid keys; they verify real rejection,
not successful login to a user's account. Unit fixtures and provider protocol
fixtures exist only under tests. Electron smoke tests use hidden windows, isolated
temporary appData and real OS safeStorage; all temporary data is removed afterward.

These modules are backend-only. Do not expose executable paths, arbitrary arguments,
or tool installation URLs directly through a renderer IPC request.

## External CLI streams

`CLIAdapter` accepts an installed native executable and an argument array; prompts
are written to stdin. `JSONLinesCLIAdapter` handles CLIs configured to output NDJSON.
Configure the command/flags for the installed provider CLI and reuse its own login.
No account sessions, provider flags or API credentials are invented by these adapters.
On Windows, use `node.exe` plus a CLI's actual `.js` entry instead of a `.cmd` shim.
For a packaged Electron app, configure an external Node executable explicitly;
`process.execPath` points to the app executable, not a normal Node CLI.

```ts
const adapter = new CLIAdapter({ executable: nativeCliPath, args: configuredArgs });
const task = {
  code: 'B1', title: 'External CLI task', agent: 'codex',
  run: ({ signal }: TaskContext) => adapter.run(prompt, { signal }),
};
```

`runCLI` bounds runtime and combined output, streams UTF-8 stdout/stderr separately,
and terminates the process tree on timeout/cancellation. Nonzero exits reject with
`CLIError`, whose `result` contains diagnostics. A successful exit is not a claim
that the provider completed a business operation: parse that provider's response.

## Quotas

`QuotaTracker` counts supplied integer usage units in rolling `(now - 5h, now]` and
`(now - 7d, now]` windows. Configure positive limits per agent in the same unit as
usage. Event IDs deduplicate retries; conflicting duplicates are rejected. Display
percentages are clamped to 100, and summation uses BigInt to avoid integer overflow.

This is an in-memory accounting adapter, not a provider quota scraper. Restore
known history on startup and feed actual usage from provider results. Providers
using fixed reset windows or changing hidden limits need a provider-specific
normalizer; do not label a rolling estimate as the provider's authoritative quota.
Invoke `refresh()` on the application's refresh timer so expired usage updates the
UI even without new events. `getStats()` and `onUpdated()` match `AgentQuotaStat[]`;
Phase 2 should wire these to the existing quota read/update IPC channels.

## Blackboard

`Blackboard` is a process-local shared state adapter. Reads/writes return clones;
`write(key, value, expectedRevision)` and `delete(key, expectedRevision)` reject stale
updates. Revisions survive deletion. Pass a captured revision when doing an
asynchronous read-modify-write operation. Persistence and cross-process sharing are
not provided. Phase 2 can share one instance among task handlers.

## Verification

```powershell
node --test tests/unit/adapters.test.ts tests/unit/media.test.ts
```
