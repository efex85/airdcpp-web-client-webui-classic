// Search windows keep their state here so that results arrive also while they are hidden
import { ApiError } from '../api/socket';
import type { SearchResult } from '../api/types';
import { useApp } from './app';
import { LiveList } from './live';
import { socket } from './session';

export interface SearchQuery {
  pattern: string;
  fileType: string;
  minSize?: number;
  maxSize?: number;
  excluded: string[];
  hubUrls: string[];
}

const EVENTS = ['search_result_added', 'search_result_updated', 'search_hub_searches_sent'];

export class SearchModel {
  results = new LiveList<SearchResult>(300);
  instanceId: number | null = null;
  status = '';
  /** Set when the initial search of the window has been run */
  started = false;
  private searchId = '';
  /** ID of the last search that the daemon has reported as sent */
  private sentId = '';
  private listeners = new Set<() => void>();
  private generation = -1;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getStatus = () => this.status;

  private setStatus(status: string) {
    this.status = status;
    this.listeners.forEach((l) => l());
  }

  private async createInstance() {
    // 0 = the instance doesn't expire while the window is open
    const instance = await socket.post<{ id: number }>('search', { expiration: 0 });
    const id = instance.id;
    this.instanceId = id;
    this.generation = useApp.getState().generation;

    const onResult = (data: { search_id: string; result: SearchResult }) => {
      // Results of the previous search may still arrive
      if (!this.searchId || String(data.search_id) === this.searchId) {
        this.results.add(data.result);
      }
    };

    await Promise.all([
      socket.listen('search', 'search_result_added', onResult, id),
      socket.listen('search', 'search_result_updated', onResult, id),
      socket.listen(
        'search',
        'search_hub_searches_sent',
        (data: { search_id: string; sent: number }) => {
          this.sentId = String(data.search_id);
          this.setStatus(`Searched ${data.sent} hub(s)`);
        },
        id,
      ),
    ]);
    return id;
  }

  async search(query: SearchQuery): Promise<void> {
    this.searchId = 'pending';
    this.results.clear();
    this.setStatus('Searching…');

    const body = {
      query: {
        pattern: query.pattern,
        file_type: query.fileType === 'any' ? undefined : query.fileType,
        min_size: query.minSize,
        max_size: query.maxSize,
        excluded: query.excluded.length ? query.excluded : undefined,
      },
      hub_urls: query.hubUrls,
      priority: 5, // High: searches started by the user
    };

    try {
      const usable = this.instanceId !== null && this.generation === useApp.getState().generation;
      let id = usable ? this.instanceId! : await this.createInstance();
      let response: { search_id: string; queued_count: number; queue_time: number };
      try {
        response = await socket.post(`search/${id}/hub_search`, body);
      } catch (e) {
        if ((e as ApiError).code !== 404) {
          throw e;
        }

        id = await this.createInstance();
        response = await socket.post(`search/${id}/hub_search`, body);
      }

      this.searchId = String(response.search_id);
      const wait = Math.ceil(response.queue_time / 1000);
      // The search may already have been sent before the response arrived
      if (this.sentId !== this.searchId) {
        this.setStatus(
          wait > 1
            ? `Search queued for ${response.queued_count} hub(s), starting in about ${wait} s`
            : `Searching ${response.queued_count} hub(s)…`,
        );
      }

      // Results that arrived before the response
      const instance = id;
      const existing = await socket.get<SearchResult[]>(`search/${instance}/results/0/1000`);
      existing.forEach(this.results.add);
    } catch (e) {
      this.searchId = '';
      this.setStatus(`Search failed: ${(e as Error).message}`);
    }
  }

  close() {
    if (this.instanceId !== null) {
      const id = this.instanceId;
      void socket.unlisten('search', EVENTS, id).then(() => socket.delete(`search/${id}`).catch(() => undefined));
    }
  }
}

const models = new Map<string, SearchModel>();

export const getSearch = (key: string): SearchModel => {
  let model = models.get(key);
  if (!model) {
    models.set(key, (model = new SearchModel()));
  }

  return model;
};

export const closeSearch = (key: string) => {
  models.get(key)?.close();
  models.delete(key);
};
