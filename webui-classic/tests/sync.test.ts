import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFLICT_MARKER, mergeText } from '../src/lib/merge';
import { SAVE_DELAY, SyncedDoc, type Cache, type Transport } from '../src/lib/syncedDoc';

const failure = (code: number) => Object.assign(new Error(`code ${code}`), { code });

/** The data of the client, shared by all devices */
const server = () => {
  const state = { revision: 0, value: null as unknown, online: true, patched: true, posts: 0 };
  const check = () => {
    if (!state.online) {
      throw failure(0);
    }

    if (!state.patched) {
      throw failure(400);
    }
  };
  const transport: Transport = {
    get: async () => {
      check();
      return { revision: state.revision, value: state.value };
    },
    post: async (_key, value, revision) => {
      check();
      state.posts++;
      if (revision !== state.revision) {
        throw failure(409);
      }

      state.value = value;
      state.revision += 10;
      return { revision: state.revision };
    },
    remove: async () => {
      check();
      state.revision = 0;
      state.value = null;
    },
  };
  return { state, transport };
};

const memory = (): Cache & { data: Record<string, unknown> } => {
  const data: Record<string, unknown> = {};
  return {
    data,
    read: (key) => data[key] ?? null,
    write: (key, record) => {
      if (record === null) {
        delete data[key];
      } else {
        data[key] = JSON.parse(JSON.stringify(record));
      }
    },
  };
};

const device = (transport: Transport, cache = memory()) => {
  const doc = new SyncedDoc<string>({
    key: 'note',
    defaults: '',
    sanitize: (v) => (typeof v === 'string' ? v : ''),
    merge: mergeText,
  });
  const errors: Error[] = [];
  doc.onError = (e) => errors.push(e);
  doc.attach(transport, cache);
  return { doc, cache, errors };
};

describe('synced documents', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tells when the client has answered', async () => {
    const { state, transport } = server();
    const a = device(transport);
    const b = device(transport);
    expect(a.doc.getSnapshot().loaded).toBe(false);
    let told = 0;
    a.doc.subscribe(() => told++);
    await a.doc.sync(); // Nothing stored yet
    expect(a.doc.getSnapshot().loaded).toBe(true);
    expect(told).toBe(1);

    a.doc.set('text');
    await a.doc.flush();
    await b.doc.sync();
    expect(b.doc.getSnapshot()).toMatchObject({ value: 'text', loaded: true });
    b.doc.detach();
    expect(b.doc.getSnapshot().loaded).toBe(false);

    state.patched = false;
    const c = device(transport);
    await c.doc.sync();
    expect(c.doc.getSnapshot()).toMatchObject({ status: 'local', loaded: true });
  });

  it('saves a change after a pause and shows it on another device', async () => {
    const { state, transport } = server();
    const a = device(transport);
    const b = device(transport);
    await a.doc.sync();
    expect(state.posts).toBe(0); // Defaults aren't stored

    a.doc.set('h');
    a.doc.set('hello');
    expect(a.doc.getSnapshot().status).toBe('pending');
    await vi.advanceTimersByTimeAsync(SAVE_DELAY);
    expect(state.value).toBe('hello');
    expect(state.posts).toBe(1);
    expect(a.doc.getSnapshot().status).toBe('synced');

    await b.doc.remoteChanged(state.revision);
    expect(b.doc.value).toBe('hello');
  });

  it('combines changes made at the same time instead of overwriting', async () => {
    const { state, transport } = server();
    const a = device(transport);
    const b = device(transport);
    a.doc.set('base');
    await a.doc.flush();
    await b.doc.sync();

    a.doc.set('from a');
    b.doc.set('from b');
    await a.doc.flush();
    await b.doc.flush(); // Refused as outdated, then combined and saved
    expect(state.value).toBe(`from a\n\n${CONFLICT_MARKER}\nfrom b`);
    expect(b.doc.dirty).toBe(false);
  });

  it('keeps changes made without a connection, also after reloading the page', async () => {
    const { state, transport } = server();
    const cache = memory();
    const first = device(transport, cache);
    state.online = false;
    first.doc.set('offline');
    await first.doc.flush();
    expect(first.errors).toEqual([]);
    expect(first.doc.dirty).toBe(true);

    state.online = true;
    const reloaded = device(transport, cache);
    expect(reloaded.doc.value).toBe('offline');
    await reloaded.doc.sync();
    expect(state.value).toBe('offline');
  });

  it('saves a change that was made while saving', async () => {
    const { state, transport } = server();
    let release = () => {};
    const slow: Transport = {
      ...transport,
      post: async (...args) => {
        await new Promise<void>((resolve) => (release = resolve));
        return transport.post(...args);
      },
    };
    const a = device(slow);
    a.doc.set('one');
    const saving = a.doc.flush();
    await vi.advanceTimersByTimeAsync(0);
    a.doc.set('one two');
    release();
    await saving;
    expect(a.doc.dirty).toBe(true);
    const second = a.doc.flush();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await second;
    expect(state.value).toBe('one two');
    expect(a.doc.dirty).toBe(false);
  });

  it('removes the value, and a device without changes does not bring it back', async () => {
    const { state, transport } = server();
    const a = device(transport);
    const b = device(transport);
    a.doc.set('text');
    await a.doc.flush();
    await b.doc.sync();
    await a.doc.discard();
    expect(state.revision).toBe(0);
    expect(a.cache.data).toEqual({});

    await b.doc.remoteChanged(0);
    expect(state.revision).toBe(0);
  });

  it('restores the data if the client has lost it', async () => {
    const { state, transport } = server();
    const a = device(transport);
    a.doc.set('keep me');
    await a.doc.flush();
    state.revision = 0;
    state.value = null;
    await a.doc.sync();
    expect(state.value).toBe('keep me');
  });

  it('works in the browser only if the client can not store data', async () => {
    const { state, transport } = server();
    state.patched = false;
    const a = device(transport);
    await a.doc.sync();
    expect(a.doc.getSnapshot().status).toBe('local');
    a.doc.set('here');
    await a.doc.flush();
    a.doc.detach();
    expect(a.errors).toEqual([]);
    expect(a.cache.data.note).toMatchObject({ value: 'here' });
  });

  it('removes the copy of the browser when logging out, unless it has unsaved changes', async () => {
    const { state, transport } = server();
    const a = device(transport);
    a.doc.set('saved');
    await a.doc.flush();
    a.doc.detach();
    expect(a.cache.data).toEqual({});
    expect(a.doc.value).toBe('');

    const b = device(transport);
    state.online = false;
    b.doc.set('unsaved');
    b.doc.detach();
    expect(b.cache.data.note).toMatchObject({ value: 'unsaved', dirty: true });
  });

  it('reports refused changes', async () => {
    const { transport } = server();
    const a = device({ ...transport, post: async () => Promise.reject(failure(500)) });
    a.doc.set('x');
    await a.doc.flush();
    expect(a.errors).toHaveLength(1);
    expect(a.doc.dirty).toBe(true);
  });
});
