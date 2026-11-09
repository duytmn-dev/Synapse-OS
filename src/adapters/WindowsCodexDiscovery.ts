import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** Resolve the registered package for this user, including after Store updates. */
export async function findWindowsDesktopCodex(): Promise<string | undefined> {
  const windows = process.env.SystemRoot;
  if (process.platform !== 'win32' || !windows || !path.isAbsolute(windows)) return;
  const powershell = path.join(windows, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const query = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);',
    "(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction Stop |",
    "Where-Object { $_.PackageFamilyName -eq 'OpenAI.Codex_2p2nqsd0c76g0' } |",
    'Sort-Object Version -Descending | Select-Object -First 1).InstallLocation',
  ].join(' ');
  try {
    const { stdout } = await execute(powershell, ['-NoProfile', '-NonInteractive', '-Command', query], {
      windowsHide: true, timeout: 6000, maxBuffer: 16 * 1024,
    });
    const directory = stdout.trim();
    if (!path.isAbsolute(directory) || /[\r\n]/.test(directory)) return;
    const executable = path.join(directory, 'app', 'resources', 'codex.exe');
    if ((await stat(executable)).isFile()) return executable;
  } catch {
    // Package registration may be inaccessible, absent, or changing during an update.
  }
}
