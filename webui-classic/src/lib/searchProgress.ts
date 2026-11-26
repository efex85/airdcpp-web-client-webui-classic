// What an empty result list says while a search is on its way. The daemon queues searches, as hubs
// limit how often one may search, so it can take a while before a search is sent.

export type SearchProgress =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'queued'; startsAt: number }
  | { phase: 'sent'; sentAt: number }
  | { phase: 'failed' };

/** How long results are expected after a search has been sent (ms) */
export const RESULT_WAIT = 5000;

/** Whether the text may change merely because time passes */
export const progressIsTimed = (progress: SearchProgress, now: number): boolean =>
  progress.phase === 'queued' ? progress.startsAt > now : progress.phase === 'sent' && now - progress.sentAt < RESULT_WAIT;

export const emptyResultText = (progress: SearchProgress, now: number): string => {
  switch (progress.phase) {
    case 'idle':
      return 'Enter a search term';
    case 'sending':
      return 'Searching…';
    case 'queued': {
      const seconds = Math.ceil((progress.startsAt - now) / 1000);
      return seconds > 0 ? `Waiting for the hubs: the search starts in about ${seconds} s` : 'Searching…';
    }
    case 'sent':
      return now - progress.sentAt < RESULT_WAIT ? 'Waiting for results…' : 'No results';
    case 'failed':
      return 'The search failed';
  }
};
