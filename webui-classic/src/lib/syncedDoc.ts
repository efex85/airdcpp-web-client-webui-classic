// A value that is stored by the client for the logged in user and kept the same on all of the user's devices.
// A copy is kept in the browser, so that changes made while the connection is down aren't lost.

import { equal } from './merge';

export interface Transport {
  get: (key: string) => Promise<{ revision: number; value: unknown }>;
  /** Fails with code 409 if the revision isn't the current one */
  post: (key: string, value: unknown, revision: number) => Promise<{ revision: number }>;
  remove: (key: string) => Promise<unknown>;
}

export interface DocRecord<T> {
  value: T;
  /** Revision of the client that the value is based on; 0 if nothing has been stored yet */
  revision: number;
  /** The value of that revision, for combining changes of two devices */
  base: T | null;
  /** The value has changes that the client doesn't have */
  dirty: boolean;
}

export interface Cache {
  read: (key: string) => unknown;
  write: (key: string, record: unknown) => void;
}

export interface DocOptions<T> {
  key: string;
  defaults: T;
  /** Turns anything that was stored into a valid value */
  sanitize: (value: unknown) => T;
  merge: (base: T, mine: T, theirs: T) => T;
}

export type SyncStatus =
  /** The client has the shown value */
  | 'synced'
  /** There are changes to be saved */
  | 'pending'
  /** The client can't store data; the value is only kept in this browser */
  | 'local';

export const SAVE_DELAY = 700;

const errorCode = (e: unknown) => (e as { code?: number } | null)?.code;

export class SyncedDoc<T> {
  private record: DocRecord<T>;
  private snapshot: { value: T; status: SyncStatus };
  private transport: Transport | null = null;
  private cache: Cache | null = null;
  private unsupported = false;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  /** Called when saving fails for another reason than a lost connection */
  onError: ((error: Error) => void) | null = null;

  constructor(readonly options: DocOptions<T>) {
    this.record = this.emptyRecord();
    this.snapshot = { value: this.record.value, status: 'synced' };
  }

  get value(): T {
    return this.record.value;
  }

  get dirty(): boolean {
    return this.record.dirty;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  /** Starts using the document for a user: the copy of the browser is shown until the client has answered */
  attach(transport: Transport, cache: Cache) {
    this.stopTimer();
    this.transport = transport;
    this.cache = cache;
    this.unsupported = false;
    this.record = this.readCache();
    this.publish();
  }

  /** Ends the use (logging out). The copy of the browser is removed unless it has unsaved changes. */
  detach() {
    this.stopTimer();
    if (!this.record.dirty && !this.unsupported) {
      this.cache?.write(this.options.key, null);
    }

    this.transport = null;
    this.cache = null;
    this.record = this.emptyRecord();
    this.publish();
  }

  set(value: T) {
    if (equal(value, this.record.value)) {
      return;
    }

    this.update({ ...this.record, value, dirty: true });
    this.stopTimer();
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  /** Saves the unsaved changes now */
  flush(): Promise<void> {
    this.stopTimer();
    return this.queue(async () => {
      if (this.record.dirty) {
        await this.push(0);
      }
    });
  }

  /** Fetches the value of the client and saves local changes */
  sync(): Promise<void> {
    return this.queue(() => this.pull(0));
  }

  /** The client reported a new revision */
  remoteChanged(revision: number): Promise<void> {
    // A removed value (revision 0) is not restored by a device that has no changes of its own
    if (revision === this.record.revision || (revision === 0 && !this.record.dirty)) {
      return Promise.resolve();
    }

    return this.sync();
  }

  /** Removes the value from the client and the browser */
  discard(): Promise<void> {
    this.stopTimer();
    this.record = { ...this.record, dirty: false };
    return this.queue(async () => {
      const { transport, cache } = this;
      cache?.write(this.options.key, null);
      this.record = this.emptyRecord();
      this.publish();
      if (!this.unsupported) {
        await transport?.remove(this.options.key);
      }
    });
  }

  private queue(operation: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(operation).catch((e: Error) => {
      // Code 0: no connection; the change is saved after reconnecting
      if (errorCode(e) !== 0) {
        this.onError?.(e);
      }
    });
    return this.chain;
  }

  private async pull(attempt: number): Promise<void> {
    const transport = this.transport;
    if (!transport) {
      return;
    }

    let server: { revision: number; value: unknown };
    try {
      server = await transport.get(this.options.key);
    } catch (e) {
      // A client without the patch doesn't know the request
      if (errorCode(e) === 400 || errorCode(e) === 404) {
        this.unsupported = true;
        this.publish();
        return;
      }

      throw e;
    }

    if (this.transport !== transport) {
      return; // Logged out meanwhile
    }

    this.unsupported = false;
    const { defaults, sanitize, merge } = this.options;
    if (server.revision === this.record.revision) {
      if (this.record.dirty) {
        await this.push(attempt);
      }
    } else if (server.revision === 0) {
      // The client has lost the data: restore it from this browser
      this.update({ ...this.record, revision: 0, base: null, dirty: true });
      await this.push(attempt);
    } else {
      const theirs = sanitize(server.value);
      if (!this.record.dirty) {
        this.update({ value: theirs, base: theirs, revision: server.revision, dirty: false });
        return;
      }

      const value = merge(this.record.base ?? defaults, this.record.value, theirs);
      const dirty = !equal(value, theirs);
      this.update({ value, base: theirs, revision: server.revision, dirty });
      if (dirty) {
        await this.push(attempt);
      }
    }
  }

  private async push(attempt: number): Promise<void> {
    const transport = this.transport;
    if (!transport || this.unsupported) {
      return;
    }

    const sent = this.record.value;
    let revision: number;
    try {
      ({ revision } = await transport.post(this.options.key, sent, this.record.revision));
    } catch (e) {
      if (errorCode(e) === 409 && attempt < 3) {
        await this.pull(attempt + 1);
        return;
      }

      // An unpatched client rejects the request; find out with a GET
      if (errorCode(e) === 400 && attempt < 3 && this.record.revision === 0) {
        try {
          await transport.get(this.options.key);
        } catch {
          this.unsupported = true;
          this.publish();
          return;
        }
      }

      throw e;
    }

    if (this.transport !== transport) {
      return;
    }

    const dirty = !equal(this.record.value, sent);
    this.update({ ...this.record, revision, base: sent, dirty });
    if (dirty && this.timer === null) {
      this.timer = setTimeout(() => void this.flush(), SAVE_DELAY);
    }
  }

  private emptyRecord(): DocRecord<T> {
    return { value: this.options.defaults, revision: 0, base: null, dirty: false };
  }

  private readCache(): DocRecord<T> {
    const stored = this.cache?.read(this.options.key) as Partial<DocRecord<unknown>> | null | undefined;
    if (!stored || typeof stored !== 'object' || typeof stored.revision !== 'number') {
      return this.emptyRecord();
    }

    const { sanitize } = this.options;
    return {
      value: sanitize(stored.value),
      revision: stored.revision,
      base: stored.base === null || stored.base === undefined ? null : sanitize(stored.base),
      dirty: !!stored.dirty,
    };
  }

  private update(record: DocRecord<T>) {
    this.record = record;
    this.cache?.write(this.options.key, record);
    this.publish();
  }

  private publish() {
    const status: SyncStatus = this.unsupported ? 'local' : this.record.dirty ? 'pending' : 'synced';
    if (this.snapshot.value !== this.record.value || this.snapshot.status !== status) {
      this.snapshot = { value: this.record.value, status };
      for (const listener of this.listeners) {
        listener();
      }
    }
  }

  private stopTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
