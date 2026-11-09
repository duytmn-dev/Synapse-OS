import { appendFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { ShadowWorkspaceManager } from '../../src/core/workspace/ShadowWorkspaceManager.ts';
import { FileLockManager } from '../../src/core/concurrency/FileLockManager.ts';
import type { AgentId } from '../../src/shared/types';

const [userData, hash, agent, filename] = process.argv.slice(2);
const manager = new ShadowWorkspaceManager(userData);
const locks = new FileLockManager(manager, hash);
const lease = await locks.acquireLock('shared.txt', agent as AgentId, 'WRITING', { waitMs: 10000 });
try {
  process.send?.({ type: 'acquired', agent });
  await appendFile(filename, `${agent}:start\n`);
  await sleep(120);
  await appendFile(filename, `${agent}:end\n`);
} finally { lease.release(); manager.dispose(); }
process.disconnect?.();
