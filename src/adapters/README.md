# Backend adapter integration (Phase 2)

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
