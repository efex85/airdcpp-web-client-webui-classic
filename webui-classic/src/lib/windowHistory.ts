// The order in which the windows have been used, so that closing one returns to the previous one

const MAX = 100;

/** Moves the window to the end (the most recent) */
export const rememberWindow = (history: string[], key: string): string[] =>
  [...history.filter((k) => k !== key), key].slice(-MAX);

/**
 * The window to show after the shown window has been closed: the one used before it. Without such a window
 * (e.g. it was opened right after logging in) the neighbour of the closed tab is taken.
 */
export const windowAfterClose = (history: string[], tabs: string[], closedIndex: number): string => {
  for (let i = history.length - 1; i >= 0; i--) {
    if (tabs.includes(history[i]!)) {
      return history[i]!;
    }
  }

  return tabs[Math.max(0, closedIndex - 1)] ?? '';
};
