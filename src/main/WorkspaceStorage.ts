import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

/** Measures logical file sizes without following symlinks. Missing paths count as zero;
 * other I/O errors propagate instead of reporting an incorrect total. */
export async function sizeOf(target: string): Promise<number> {
  let info;
  try { info = await lstat(target); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
  if (info.isSymbolicLink()) return 0;
  if (info.isFile()) return info.size;
  if (!info.isDirectory()) return 0;
  let total = 0;
  for (const entry of await readdir(target)) total += await sizeOf(path.join(target, entry));
  return total;
}

/** Core is the app installation; temp is the app's own temp directory.
 * Workspace total counts user data plus installation when they do not overlap. */
export async function getWorkspaceStorageInfo(userData: string, appPath: string) {
  const data = path.resolve(userData);
  const core = path.resolve(appPath);
  const [dataBytes, coreBytes, tempBytes, shadowBytes] = await Promise.all([
    sizeOf(data), sizeOf(core), sizeOf(path.join(data, 'temp')), sizeOf(path.join(data, 'projects')),
  ]);
  const relative = path.relative(data, core);
  const coreInsideData = relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
  const mb = (bytes: number) => bytes / (1024 * 1024);
  return { total_used_mb: mb(dataBytes + (coreInsideData ? 0 : coreBytes)), core_app_mb: mb(coreBytes), temp_files_mb: mb(tempBytes), shadow_workspaces_mb: mb(shadowBytes) };
}
