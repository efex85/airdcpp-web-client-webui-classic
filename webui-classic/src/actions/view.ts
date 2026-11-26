// Viewing files and looking up NFO files
import type { Dupe, HintedUser, ItemType, SearchResult, ViewFile } from '../api/types';
import { hasAccess } from '../lib/access';
import { canFindNfo, canViewFrom, VIEW_LABELS, viewKind } from '../lib/viewFile';
import { openTab, reportError, toast, useApp } from '../store/app';
import { socket } from '../store/session';
import type { MenuEntry } from '../store/ui';

export interface ViewableFile {
  name: string;
  tth: string;
  size: number;
}

const showViewedFile = (file: ViewFile) => {
  useApp.setState((s) => ({ files: s.files.some((f) => f.id === file.id) ? s.files : [...s.files, file] }));
  openTab(`file:${file.id}`);
};

/** Opens a file from the own share when no user is given, and otherwise downloads it from the user first */
export const openViewedFile = async (file: ViewableFile, user: HintedUser | undefined, text: boolean) => {
  try {
    const opened = user
      ? await socket.post<ViewFile>('view_files', {
          user: { cid: user.cid, hub_url: user.hub_url },
          tth: file.tth,
          size: file.size,
          name: file.name,
          text,
        })
      : await socket.post<ViewFile>(`view_files/${file.tth}`, { text });
    showViewedFile(opened);
  } catch (e) {
    // The client refuses to open the same file twice: show the open one
    const existing = await socket.get<ViewFile>(`view_files/${file.tth}`).catch(() => null);
    if (existing) {
      showViewedFile(existing);
    } else {
      reportError(`View ${file.name}`)(e);
    }
  }
};

const NFO_ATTEMPTS = 20;
const NFO_INTERVAL = 500;

/** Searches a folder of a user for an NFO file and opens it */
export const findNfo = async (user: HintedUser, path: string, name: string) => {
  toast(`Looking for an NFO file in ${name}…`);
  let instance: number | null = null;
  try {
    instance = (await socket.post<{ id: number }>('search', { expiration_minutes: 1 })).id;
    await socket.post(`search/${instance}/user_search`, {
      user: { cid: user.cid, hub_url: user.hub_url },
      query: { extensions: ['nfo'], max_size: 256 * 1024 },
      options: { path, max_results: 1 },
    });

    let result: SearchResult | undefined;
    for (let i = 0; i < NFO_ATTEMPTS && !result; i++) {
      await new Promise((resolve) => setTimeout(resolve, NFO_INTERVAL));
      [result] = await socket.get<SearchResult[]>(`search/${instance}/results/0/1`);
    }

    if (!result) {
      toast(`No NFO file was found in ${name}`, true);
      return;
    }

    await openViewedFile(result, user, true);
  } catch (e) {
    reportError(`Find NFO in ${name}`)(e);
  } finally {
    if (instance !== null) {
      socket.delete(`search/${instance}`).catch(() => undefined);
    }
  }
};

export interface ViewTarget {
  name: string;
  tth: string;
  size: number;
  type: ItemType | null;
  /** Needed for folders */
  path?: string;
  dupe?: Dupe | null;
}

/** "View" or "Find NFO" entries of an item; empty if neither is possible */
export const viewEntries = (
  item: ViewTarget,
  user: HintedUser | undefined,
  /** Items of the own file list can always be opened */
  ownList = false,
): MenuEntry[] => {
  if (!hasAccess('view_file_edit')) {
    return [];
  }

  if (item.type?.id === 'directory') {
    const path = item.path;
    return user && path && canFindNfo(user) && hasAccess('search')
      ? [{ label: 'Find NFO', onClick: () => void findNfo(user, path, item.name) }]
      : [];
  }

  const kind = item.type && item.tth ? viewKind(item.type.content_type, item.size) : null;
  if (!kind || !(ownList || canViewFrom(user, item.dupe))) {
    return [];
  }

  // The client uses the shared copy by itself, if it has the file
  const unavailable = !user || user.flags.includes('self') || user.flags.includes('offline');
  const source = ownList || unavailable ? undefined : user;
  return [{ label: VIEW_LABELS[kind], onClick: () => void openViewedFile(item, source, kind === 'text') }];
};
