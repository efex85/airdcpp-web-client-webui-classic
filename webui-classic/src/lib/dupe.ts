import type { Dupe } from '../api/types';

/** CSS class for items that are already shared, queued or downloaded */
export const dupeClass = (dupe: Dupe | null | undefined): string | undefined => {
  if (!dupe) {
    return undefined;
  }

  const kind = dupe.id.startsWith('queue') ? 'queued' : dupe.id.startsWith('finished') ? 'finished' : 'shared';
  return `dupe ${kind}${dupe.id.endsWith('partial') ? ' partial' : ''}`;
};

const DUPE_LABELS: Record<string, string> = {
  share_partial: 'Share (partial)',
  share_full: 'Share (full)',
  queue_partial: 'Queue (partial)',
  queue_full: 'Queue (full)',
  finished_partial: 'Finished (partial)',
  finished_full: 'Finished (full)',
  share_queue: 'Share and queue',
  share_finished: 'Share and finished',
  queue_finished: 'Queue and finished',
  share_queue_finished: 'Share, queue and finished',
};

export const dupeLabel = (dupe: Dupe): string => DUPE_LABELS[dupe.id] ?? dupe.id;
