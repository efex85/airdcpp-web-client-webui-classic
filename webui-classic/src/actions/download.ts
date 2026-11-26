import type { HintedUser } from '../api/types';
import { reportError, toast } from '../store/app';
import { socket } from '../store/session';
import { browsePath } from '../components/FileBrowser';
import { hasAccess } from '../lib/access';
import { load, save } from '../lib/storage';
import { showDialog, type MenuEntry } from '../store/ui';

export interface DownloadTarget {
  /** Daemon-side directory; the default download directory is used when omitted */
  directory?: string;
}

export interface Downloadable {
  name: string;
  run: (target: { target_directory?: string }) => Promise<unknown>;
}

export const downloadAll = async (items: Downloadable[], target: DownloadTarget = {}) => {
  const body = target.directory ? { target_directory: target.directory } : {};
  let failed = 0;
  let lastError: unknown;
  for (const item of items) {
    try {
      await item.run(body);
    } catch (e) {
      failed++;
      lastError = e;
    }
  }

  if (failed) {
    reportError(items.length === 1 ? `Download ${items[0].name}` : `${failed} of ${items.length} downloads failed`)(
      lastError,
    );
  } else {
    toast(items.length === 1 ? `Added to queue: ${items[0].name}` : `${items.length} items added to the queue`);
  }
};

export const fileDownload = (
  user: HintedUser | undefined,
  file: { name: string; tth: string; size: number; time?: number },
): Downloadable => ({
  name: file.name,
  run: (target) =>
    socket.post('queue/bundles/file', {
      ...target,
      user: user && { cid: user.cid, hub_url: user.hub_url },
      tth: file.tth,
      size: file.size,
      time: file.time || undefined,
      target_name: file.name,
    }),
});

export const directoryDownload = (user: HintedUser, listPath: string, name: string): Downloadable => ({
  name,
  run: (target) =>
    socket.post('filelists/directory_downloads', {
      ...target,
      user: { cid: user.cid, hub_url: user.hub_url },
      list_path: listPath,
      target_name: name,
    }),
});

/** Typed in by users who may not browse the files of the server */
const typeDirectory = async (suggestions: string[]) => {
  const result = await showDialog({
    title: 'Download to',
    fields: [
      {
        key: 'directory',
        label: 'Folder (on the server)',
        required: true,
        suggestions,
        placeholder: '/Downloads/',
      },
    ],
    confirmLabel: 'Download',
  });
  if (!result) {
    return null;
  }

  const directory = String(result.directory).trim();
  return /[\\/]$/.test(directory) ? directory : `${directory}/`;
};

/** The folder chosen last time, or the download folder of the client */
const startDirectory = async (): Promise<string> => {
  const last = load('downloadDirectory', '');
  if (last || !hasAccess('settings_view')) {
    return last;
  }

  return socket
    .post<{ download_directory?: string }>('settings/get', { keys: ['download_directory'] })
    .then((values) => values.download_directory ?? '', () => '');
};

const chooseDirectory = async (suggestions: string[]) => {
  if (!hasAccess('filesystem_view')) {
    return typeDirectory(suggestions);
  }

  const directory = await browsePath('directory', await startDirectory(), {
    title: 'Download to',
    confirmLabel: 'Download',
  });
  if (directory) {
    save('downloadDirectory', directory);
  }

  return directory;
};

interface FavoriteDirectory {
  name: string;
  paths: string[];
}

// Kept in memory, so that the menus can be opened without waiting
let favoriteDirectories: FavoriteDirectory[] = [];

export const loadFavoriteDirectories = () =>
  socket.get<FavoriteDirectory[]>('favorite_directories/grouped_paths').then(
    (groups) => {
      favoriteDirectories = groups;
    },
    () => undefined, // Not allowed for this user
  );

/** "Download" and "Download to" entries, with the favorite folders of the daemon */
export const downloadMenu = (items: Downloadable[]): MenuEntry[] => {
  void loadFavoriteDirectories(); // For the next time

  const custom: MenuEntry = {
    label: 'Browse…',
    onClick: () =>
      void chooseDirectory(favoriteDirectories.flatMap((g) => g.paths)).then((directory) => {
        if (directory) {
          void downloadAll(items, { directory });
        }
      }),
  };

  const favorites: MenuEntry[] = favoriteDirectories.map((group) => ({
    label: group.name,
    children: group.paths.map((path) => ({ label: path, onClick: () => void downloadAll(items, { directory: path }) })),
  }));

  return [
    {
      label: items.length > 1 ? `Download (${items.length} items)` : 'Download',
      bold: true,
      disabled: !items.length,
      onClick: () => void downloadAll(items),
    },
    {
      label: 'Download to',
      disabled: !items.length,
      children: favorites.length ? [...favorites, 'separator', custom] : [custom],
    },
  ];
};
