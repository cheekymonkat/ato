import { parseWorkspace } from './workspace.ts';
import type { Workspace } from './workspace.ts';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>;
  runExclusive?: (task: () => Promise<void>) => Promise<void>;
}
export const CURRENT_KEY = '@ato/workspace/v1';
export const PREVIOUS_KEY = '@ato/workspace/previous';
export type LoadResult = { kind: 'empty' } | { kind: 'ready'; workspace: Workspace } | { kind: 'recovery'; message: string; previous: Workspace | null };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/** One ordered writer. Capture each snapshot before awaiting anything, and reject another session's changes. */
export class SnapshotStore {
  private expected: string | null = null;
  private loaded = false;
  private currentValid = false;
  private tail: Promise<void> = Promise.resolve();
  private readonly storage: StorageAdapter;
  constructor(storage: StorageAdapter) { this.storage = storage; }

  async load(): Promise<LoadResult> {
    this.loaded = false;
    try {
      this.expected = await this.storage.getItem(CURRENT_KEY);
      this.loaded = true;
      this.currentValid = false;
      if (this.expected !== null) {
        try {
          const workspace = parseWorkspace(JSON.parse(this.expected));
          this.currentValid = true;
          return { kind: 'ready', workspace };
        } catch (error) {
          return { kind: 'recovery', message: `The current save could not be read: ${errorMessage(error)}`, previous: await this.previous() };
        }
      }
      const previous = await this.previous();
      return previous ? { kind: 'recovery', message: 'The current save is missing. A previous snapshot is available.', previous } : { kind: 'empty' };
    } catch (error) {
      return { kind: 'recovery', message: `Local storage could not be read: ${errorMessage(error)}`, previous: null };
    }
  }

  async previous(): Promise<Workspace | null> {
    const raw = await this.storage.getItem(PREVIOUS_KEY);
    if (raw === null) return null;
    try { return parseWorkspace(JSON.parse(raw)); }
    catch (error) { throw new Error(`The previous snapshot could not be read: ${errorMessage(error)}`); }
  }

  save(workspace: Workspace): Promise<void> {
    const raw = JSON.stringify(parseWorkspace(workspace));
    const write = async () => {
      if (!this.loaded) throw new Error('Read local storage successfully before saving. Retry loading first.');
      const actual = await this.storage.getItem(CURRENT_KEY);
      // A write can complete even if its acknowledgement fails; retrying the same snapshot is safe.
      if (actual === raw) { this.expected = raw; this.currentValid = true; return; }
      if (actual !== this.expected) throw new Error('Another tab or session changed the save. Export your party, then reload to use the latest save.');
      if (this.currentValid && this.expected !== null) await this.storage.setItem(PREVIOUS_KEY, this.expected);
      await this.storage.setItem(CURRENT_KEY, raw);
      this.expected = raw;
      this.currentValid = true;
    };
    const exclusiveWrite = () => this.storage.runExclusive ? this.storage.runExclusive(write) : write();
    const result = this.tail.then(exclusiveWrite, exclusiveWrite);
    this.tail = result.catch(() => {});
    return result;
  }
}
