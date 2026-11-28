// The data of this UI that is the same on all devices of a user

import { useSyncExternalStore } from 'react';
import { EMOJI_DEFAULTS, sanitizeEmoji, type EmojiSettings } from '../lib/emoji';
import { merge, mergeText } from '../lib/merge';
import { sanitizeShortcuts, SHORTCUT_DEFAULTS, type ShortcutSettings } from '../lib/shortcuts';
import { sanitizeStartup, STARTUP_DEFAULTS, type StartupSettings } from '../lib/startup';
import { SyncedDoc, type Cache, type SyncStatus, type Transport } from '../lib/syncedDoc';
import { DEFAULT_COLORS, sanitizeColors, type ColorSettings } from '../lib/theme';
import { DEFAULT_WIDGETS, MAX_NOTE_LENGTH, sanitizeWidgets, type HomeWidgets } from '../lib/widgets';
import { load, save } from '../lib/storage';

export const startupDoc = new SyncedDoc<StartupSettings>({
  key: 'classic_startup',
  defaults: STARTUP_DEFAULTS,
  sanitize: sanitizeStartup,
  merge,
});

export const colorsDoc = new SyncedDoc<ColorSettings>({
  key: 'classic_colors',
  defaults: DEFAULT_COLORS,
  sanitize: sanitizeColors,
  merge,
});

export const widgetsDoc = new SyncedDoc<HomeWidgets>({
  key: 'classic_widgets',
  defaults: DEFAULT_WIDGETS,
  sanitize: sanitizeWidgets,
  merge,
});

export const emojiDoc = new SyncedDoc<EmojiSettings>({
  key: 'classic_emoji',
  defaults: EMOJI_DEFAULTS,
  sanitize: sanitizeEmoji,
  merge,
});

export const shortcutsDoc = new SyncedDoc<ShortcutSettings>({
  key: 'classic_shortcuts',
  defaults: SHORTCUT_DEFAULTS,
  sanitize: sanitizeShortcuts,
  merge,
});

const noteDocs = new Map<string, SyncedDoc<string>>();

interface Connection {
  transport: Transport;
  cache: Cache;
}

let connection: Connection | null = null;
let errorHandler: ((error: Error) => void) | null = null;

const fixed = [startupDoc, colorsDoc, widgetsDoc, emojiDoc, shortcutsDoc] as SyncedDoc<any>[];
const allDocs = (): SyncedDoc<any>[] => [...fixed, ...noteDocs.values()];

/** The text of a notes widget */
export const noteDoc = (widgetId: string): SyncedDoc<string> => {
  let doc = noteDocs.get(widgetId);
  if (!doc) {
    doc = new SyncedDoc<string>({
      key: `classic_note_${widgetId}`,
      defaults: '',
      sanitize: (value) => (typeof value === 'string' ? value : ''),
      merge: mergeText,
    });
    doc.onError = errorHandler;
    noteDocs.set(widgetId, doc);
    if (connection) {
      doc.attach(connection.transport, connection.cache);
      void doc.sync();
    }
  }

  return doc;
};

const noteWidgets = () => widgetsDoc.value.list.filter((w) => w.type === 'notes').map((w) => w.id);

const syncNotes = () =>
  Promise.all(
    noteWidgets().map((id) => {
      const existing = noteDocs.get(id);
      // A new document syncs itself
      return existing ? existing.sync() : noteDoc(id).flush();
    }),
  );

export const syncAll = async () => {
  if (!connection) {
    return;
  }

  await Promise.all([startupDoc.sync(), colorsDoc.sync(), emojiDoc.sync(), shortcutsDoc.sync()]);
  // The widgets first, so that the text of removed notes isn't restored
  await widgetsDoc.sync();
  await syncNotes();
};

/** Copies of the values in the browser, separately for every client and user */
export const browserCache = (owner: string): Cache => ({
  read: (key) => load<unknown>(`sync.${owner}.${key}`, null),
  write: (key, record) => save(`sync.${owner}.${key}`, record),
});

export const connectDocs = (next: Connection, onError: (error: Error) => void) => {
  connection = next;
  errorHandler = onError;
  for (const doc of allDocs()) {
    doc.onError = onError;
    doc.attach(next.transport, next.cache);
  }
};

export const isConnected = () => !!connection;

/** Saves what is unsaved; used before logging out and when the page is hidden */
export const flushDocs = () => Promise.all(allDocs().map((doc) => doc.flush()));

export const disconnectDocs = () => {
  connection = null;
  for (const doc of allDocs()) {
    doc.detach();
  }

  noteDocs.clear();
};

/** A change reported by the client (made on another device) */
export const remoteChange = async (key: string, revision: number) => {
  const doc = allDocs().find((d) => d.options.key === key);
  await doc?.remoteChanged(revision);
  if (doc === widgetsDoc) {
    await syncNotes();
  }
};

/** Removes a widget and, for notes, its text */
export const removeWidget = async (id: string) => {
  const widget = widgetsDoc.value.list.find((w) => w.id === id);
  if (!widget) {
    return;
  }

  const note = widget.type === 'notes' ? noteDoc(id) : null;
  widgetsDoc.set({ ...widgetsDoc.value, list: widgetsDoc.value.list.filter((w) => w.id !== id) });
  // The list is saved first: other devices must not bring the text back
  await widgetsDoc.flush();
  if (note) {
    noteDocs.delete(id);
    await note.discard();
  }
};

export const setNote = (widgetId: string, text: string) => noteDoc(widgetId).set(text.slice(0, MAX_NOTE_LENGTH));

export const useDoc = <T>(doc: SyncedDoc<T>): T => useSyncExternalStore(doc.subscribe, doc.getSnapshot).value;

export const useDocStatus = <T>(doc: SyncedDoc<T>): SyncStatus =>
  useSyncExternalStore(doc.subscribe, doc.getSnapshot).status;

/** False until the client has answered: until then the value may be an old copy, or the default */
export const useDocLoaded = <T>(doc: SyncedDoc<T>): boolean =>
  useSyncExternalStore(doc.subscribe, doc.getSnapshot).loaded;
