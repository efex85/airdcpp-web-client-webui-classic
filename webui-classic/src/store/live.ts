// Keyed collection that is updated by API events. Notifications are batched, as large hubs
// and busy queues can send hundreds of updates per second.

import { useSyncExternalStore } from 'react';

export class LiveList<T extends { id: string | number }> {
  private items = new Map<string, T>();
  private snapshot: T[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private removedWhileLoading: Set<string> | null = null;
  loaded = false;

  constructor(private readonly delay = 150) {}

  /** Live events received during loading are newer than the loaded data */
  async load(fetch: () => Promise<T[]>): Promise<void> {
    this.removedWhileLoading = new Set();
    try {
      const loaded = await fetch();
      for (const item of loaded) {
        const key = String(item.id);
        if (!this.removedWhileLoading.has(key)) {
          this.items.set(key, { ...item, ...this.items.get(key) });
        }
      }

      this.loaded = true;
      this.schedule();
    } finally {
      this.removedWhileLoading = null;
    }
  }

  add = (item: T) => {
    this.removedWhileLoading?.delete(String(item.id));
    this.items.set(String(item.id), item);
    this.schedule();
  };

  /** Partial update; ignored for unknown items unless they are still being loaded */
  update = (partial: Partial<T> & { id: string | number }) => {
    const key = String(partial.id);
    const old = this.items.get(key);
    if (old) {
      this.items.set(key, { ...old, ...partial });
    } else if (this.removedWhileLoading) {
      this.items.set(key, partial as T);
    } else {
      return;
    }

    this.schedule();
  };

  remove = (id: string | number) => {
    this.removedWhileLoading?.add(String(id));
    if (this.items.delete(String(id))) {
      this.schedule();
    }
  };

  clear() {
    this.items.clear();
    this.loaded = false;
    this.schedule();
  }

  get(id: string | number): T | undefined {
    return this.items.get(String(id));
  }

  private schedule() {
    if (this.timer !== null) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.snapshot = [...this.items.values()];
      for (const listener of this.listeners) {
        listener();
      }
    }, this.delay);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;
}

export const useLiveList = <T extends { id: string | number }>(list: LiveList<T>): T[] =>
  useSyncExternalStore(list.subscribe, list.getSnapshot);
