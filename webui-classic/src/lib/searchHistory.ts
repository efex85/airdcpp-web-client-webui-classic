// The search words that the client remembers. It doesn't add them by itself: the interface does.

export const SEARCH_HISTORY_PATH = 'histories/strings/search_pattern';

/** Hashes aren't kept: a list of them says nothing */
export const isRememberedSearch = (pattern: string, fileType: string) => !!pattern.trim() && fileType !== 'tth';

/** The client lists the oldest first */
export const recentSearches = (history: string[]) => [...history].reverse();
