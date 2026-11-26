// Loaded feeds. They are kept for the browser session, so that reloading the page doesn't load them again.

import { create } from 'zustand';
import { parseFeed, type Feed } from '../lib/feed';
import { fetchXmlThroughClient } from '../lib/proxy';
import { load, save } from '../lib/storage';

export interface FeedState {
  url: string;
  /** The last successful load */
  feed: Feed | null;
  /** When it was loaded (milliseconds) */
  loadedAt: number;
  /** When loading was last tried */
  triedAt: number;
  loading: boolean;
  error: string;
}

export const useFeeds = create<Record<string, FeedState>>(() => ({}));

const empty = (url: string): FeedState => ({ url, feed: null, loadedAt: 0, triedAt: 0, loading: false, error: '' });
const cacheKey = (id: string) => `feed.${id}`;

export const feedState = (id: string, url: string): FeedState => {
  const current = useFeeds.getState()[id];
  if (current?.url === url) {
    return current;
  }

  const stored = load<{ url: string; feed: Feed; loadedAt: number } | null>(cacheKey(id), null, 'session');
  return stored?.url === url ? { ...empty(url), ...stored, triedAt: stored.loadedAt } : empty(url);
};

const put = (id: string, state: FeedState) => useFeeds.setState({ [id]: state });

export const loadFeed = async (id: string, url: string) => {
  const previous = feedState(id, url);
  if (previous.loading) {
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    put(id, { ...previous, triedAt: Date.now(), error: 'Invalid address: it must start with http:// or https://' });
    return;
  }

  const started: FeedState = { ...previous, loading: true, triedAt: Date.now(), error: '' };
  put(id, started);
  let result: Partial<FeedState>;
  try {
    const feed = parseFeed(await fetchXmlThroughClient(url), url);
    result = { feed, loadedAt: Date.now() };
    save(cacheKey(id), { url, feed, loadedAt: result.loadedAt }, 'session');
  } catch (e) {
    result = { error: (e as Error).message };
  }

  // The address may have been changed meanwhile
  if (useFeeds.getState()[id]?.url === url) {
    put(id, { ...started, ...result, loading: false });
  }
};

/** Loads the feed if it hasn't been tried within the interval */
export const loadFeedIfDue = (id: string, url: string, minutes: number) => {
  const state = feedState(id, url);
  if (Date.now() - state.triedAt >= minutes * 60_000) {
    return loadFeed(id, url);
  }

  if (useFeeds.getState()[id] !== state) {
    put(id, state);
  }

  return Promise.resolve();
};
