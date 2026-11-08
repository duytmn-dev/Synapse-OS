export interface BlackboardEntry<T = unknown> { revision: number; value: T }

/** Process-local shared-state adapter. Synchronous compare-and-set is atomic on
 * the main JS event loop; cloned values prevent mutation across task boundaries.
 * Revisions survive deletion to prevent an ABA update from an old reader.
 */
export class Blackboard {
  private readonly values = new Map<string, BlackboardEntry>();
  private readonly revisions = new Map<string, number>();
  read<T = unknown>(key: string): BlackboardEntry<T> | undefined {
    return structuredClone(this.values.get(key)) as BlackboardEntry<T> | undefined;
  }
  revision(key: string): number { return this.revisions.get(key) ?? 0; }

  write<T>(key: string, value: T, expectedRevision = this.revision(key)): BlackboardEntry<T> {
    if (!key.trim()) throw new Error('Blackboard key is required');
    if (expectedRevision !== this.revision(key)) throw new Error(`Blackboard conflict: ${key}`);
    const revision = expectedRevision + 1;
    if (!Number.isSafeInteger(revision)) throw new Error('Blackboard revision overflow');
    const entry = { revision, value: structuredClone(value) };
    this.values.set(key, entry);
    this.revisions.set(key, revision);
    return structuredClone(entry);
  }

  delete(key: string, expectedRevision: number): boolean {
    if (expectedRevision !== this.revision(key)) throw new Error(`Blackboard conflict: ${key}`);
    if (!this.values.has(key)) return false;
    if (!Number.isSafeInteger(expectedRevision + 1)) throw new Error('Blackboard revision overflow');
    this.revisions.set(key, expectedRevision + 1);
    return this.values.delete(key);
  }
}
