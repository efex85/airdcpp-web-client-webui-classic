// Finding the queued file that a transfer belongs to
import type { QueueBundle } from '../api/types';

/** Bundles that may contain the file with the given target. Folder targets end with the path separator. */
export const bundlesFor = <T extends Pick<QueueBundle, 'target' | 'type'>>(bundles: T[], target: string): T[] =>
  bundles.filter((b) => (b.type.id === 'directory' ? target.startsWith(b.target) : b.target === target));
