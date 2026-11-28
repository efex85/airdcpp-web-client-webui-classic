import { ApiError } from '../api/socket';
import type { FilelistSession, HintedUser, HubSession, PrivateChatSession } from '../api/types';
import { openTab, removeTab, reportError, toast, useApp, windowType, activate, windowId, type SearchTab } from '../store/app';
import { releaseHubUsers, socket } from '../store/session';
import { confirm, showDialog, type MenuEntry } from '../store/ui';
import { closeSearch } from '../store/search';
import { confirmDiscard, useSettingsNav } from '../store/settingsNav';
import { remoteMenu } from './menus';
import { lastSegment } from '../lib/path';

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // The clipboard API requires HTTPS or localhost
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) {
      await showDialog({ title: 'Copy', fields: [{ key: 'text', label: 'Text', value: text }], cancelLabel: null });
    }
  }
};

/* Hubs */

export const connectHub = async (hubUrl: string) => {
  const url = hubUrl.trim();
  if (!url) {
    return;
  }

  try {
    const hub = await socket.post<HubSession>('hubs', { hub_url: url });
    useApp.setState((s) => ({ hubs: s.hubs.some((h) => h.id === hub.id) ? s.hubs : [...s.hubs, hub] }));
    openTab(`hub:${hub.id}`);
  } catch (e) {
    if ((e as ApiError).code === 409) {
      const hub = await socket.post<HubSession>('hubs/find_by_url', { hub_url: url }).catch(() => null);
      if (hub) {
        openTab(`hub:${hub.id}`);
        return;
      }
    }

    reportError('Connect')(e);
  }
};

export const quickConnect = async () => {
  const result = await showDialog({
    title: 'Quick connect',
    fields: [{ key: 'url', label: 'Hub address', required: true, placeholder: 'adcs://hub.example.org:1511' }],
    confirmLabel: 'Connect',
  });
  if (result) {
    await connectHub(result.url);
  }
};

export const reconnectHub = (hubId: number) => socket.post(`hubs/${hubId}/reconnect`).catch(reportError('Reconnect'));

export const addHubFavorite = (hubId: number) =>
  socket.post(`hubs/${hubId}/favorite`).then(
    () => toast('Added to favorite hubs'),
    reportError('Add favorite'),
  );

/** A setting of the open hub (also stored in its favorite hub entry by the client) */
const hubSetting = (hub: HubSession, key: 'use_main_chat_notify' | 'show_joins', label: string): MenuEntry => ({
  label,
  checked: !!hub.settings?.[key],
  onClick: () => void socket.patch(`hubs/${hub.id}`, { [key]: !hub.settings?.[key] }).catch(reportError(label)),
});

export const hubMenu = (hub: HubSession): { entries: MenuEntry[]; more: () => Promise<MenuEntry[]> } => ({
  entries: [
    { label: 'Reconnect', onClick: () => void reconnectHub(hub.id) },
    { label: 'Add to favorites', disabled: !!hub.favorite_hub, onClick: () => void addHubFavorite(hub.id) },
    { label: 'Copy address', onClick: () => void copyText(hub.hub_url) },
    'separator',
    hubSetting(hub, 'use_main_chat_notify', 'Chat notifications'),
    hubSetting(hub, 'show_joins', 'Show joins/parts'),
    'separator',
    { label: 'Close', onClick: () => void closeWindow(`hub:${hub.id}`) },
  ],
  // The user commands of the hub
  more: () => remoteMenu('hub', [hub.id]),
});

/* Users */

export const openPrivateChat = async (user: HintedUser) => {
  try {
    const chat = await socket.post<PrivateChatSession>('private_chat', {
      user: { cid: user.cid, hub_url: user.hub_url },
    });
    useApp.setState((s) => ({ chats: s.chats.some((c) => c.id === chat.id) ? s.chats : [...s.chats, chat] }));
    openTab(`pm:${chat.id}`);
  } catch (e) {
    if ((e as ApiError).code === 409) {
      openTab(`pm:${user.cid}`);
    } else {
      reportError('Private message')(e);
    }
  }
};

export const browseUser = async (user: HintedUser, directory = '/') => {
  const open = () => openTab(`filelist:${user.cid}`);
  try {
    const list = await socket.post<FilelistSession>('filelists', {
      user: { cid: user.cid, hub_url: user.hub_url },
      directory,
    });
    useApp.setState((s) => ({
      filelists: s.filelists.some((l) => l.id === list.id) ? s.filelists : [...s.filelists, list],
    }));
    open();
  } catch (e) {
    if ((e as ApiError).code === 409) {
      open();
      if (directory !== '/') {
        await socket.post(`filelists/${user.cid}/directory`, { list_path: directory }).catch(reportError('Browse'));
      }
    } else {
      reportError('Get file list')(e);
    }
  }
};

/** Opens the full file list of a user, also if only a part of it is open */
export const browseFullList = async (user: HintedUser) => {
  const open = () => openTab(`filelist:${user.cid}`);
  try {
    const list = await socket.post<FilelistSession>('filelists', {
      user: { cid: user.cid, hub_url: user.hub_url },
      directory: '/',
      full: true,
    });
    useApp.setState((s) => ({
      filelists: s.filelists.some((l) => l.id === list.id) ? s.filelists : [...s.filelists, list],
    }));
    open();
  } catch (e) {
    if ((e as ApiError).code !== 409) {
      reportError('Get full file list')(e);
      return;
    }

    open();
    if (useApp.getState().filelists.find((l) => l.id === user.cid)?.partial_list) {
      await socket.post(`filelists/${user.cid}/full_list`).catch(reportError('Get full file list'));
    }
  }
};

/** What a double click on a user does: bots have no files, so they get a private chat */
export const openUser = (user: HintedUser) =>
  user.flags.includes('bot') ? openPrivateChat(user) : browseUser(user);

export const openOwnList = async () => {
  try {
    const profiles = await socket.get<{ id: number; str?: string; name?: string; default?: boolean }[]>('share_profiles');
    let profile = profiles.find((p) => p.default)?.id ?? profiles[0]?.id;
    if (profiles.length > 1) {
      const result = await showDialog({
        title: 'Open own file list',
        fields: [
          {
            key: 'profile',
            label: 'Share profile',
            type: 'select',
            value: profile,
            options: profiles.map((p) => ({ value: p.id, label: p.str ?? p.name ?? String(p.id) })),
          },
        ],
        confirmLabel: 'Open',
      });
      if (!result) {
        return;
      }

      profile = Number(result.profile);
    }

    await openProfileList(profile!);
  } catch (e) {
    reportError('Own file list')(e);
  }
};

/** Opens the own file list of a share profile */
export const openProfileList = async (profile: number) => {
  try {
    const list = await socket.post<FilelistSession>('filelists/self', { share_profile: profile });
    useApp.setState((s) => ({
      filelists: s.filelists.some((l) => l.id === list.id) ? s.filelists : [...s.filelists, list],
    }));
    openTab(`filelist:${list.id}`);
  } catch (e) {
    const own = useApp.getState().login?.system_info.cid;
    if ((e as ApiError).code === 409 && own) {
      // The own list is open already: show the chosen profile in it
      await socket.patch(`filelists/${own}`, { share_profile: profile }).catch(reportError('Own file list'));
      openTab(`filelist:${own}`);
    } else {
      reportError('Own file list')(e);
    }
  }
};

export const grantSlot = (user: HintedUser) =>
  socket
    .post(`users/slots/${user.cid}`, { hub_url: user.hub_url })
    .then(() => toast(`Extra slot granted to ${user.nicks}`), reportError('Grant slot'));

export const setIgnored = (user: HintedUser, ignore: boolean) =>
  (ignore ? socket.post(`users/ignores/${user.cid}`) : socket.delete(`users/ignores/${user.cid}`)).then(
    () => toast(`${user.nicks} ${ignore ? 'ignored' : 'removed from ignored users'}`),
    reportError('Ignore'),
  );

export const matchQueue = (user: HintedUser) =>
  socket
    .post('filelists/match_queue', { user: { cid: user.cid, hub_url: user.hub_url } })
    .then(() => toast(`Matching the queue against ${user.nicks}`), reportError('Match queue'));

export const userMenu = (user: HintedUser): MenuEntry[] => {
  const self = user.flags.includes('self');
  const offline = user.flags.includes('offline');
  const ignored = user.flags.includes('ignored');
  const bot = user.flags.includes('bot');
  // The entry in bold is what a double click does
  return [
    { label: 'Get file list', bold: !bot, disabled: offline || self, onClick: () => void browseUser(user) },
    { label: 'Get full file list', disabled: offline || self, onClick: () => void browseFullList(user) },
    { label: 'Send private message', bold: bot, disabled: offline || self, onClick: () => void openPrivateChat(user) },
    { label: 'Match queue', disabled: offline || self, onClick: () => void matchQueue(user) },
    'separator',
    { label: 'Grant extra slot', disabled: self, onClick: () => void grantSlot(user) },
    {
      label: ignored ? 'Stop ignoring' : 'Ignore messages',
      disabled: self,
      onClick: () => void setIgnored(user, !ignored),
    },
  ];
};

/* Share */

export const refreshShare = (incoming = false) =>
  socket
    .post('share/refresh', { incoming })
    .then(() => toast(incoming ? 'Refreshing incoming folders' : 'Refreshing the share'), reportError('Refresh share'));

const REFRESH_RESULTS = {
  started: (name: string) => `Refreshing ${name}`,
  queued: (name: string) => `${name} will be refreshed after the current refresh`,
  exists: (name: string) => `${name} is already being refreshed or waiting for it`,
};

/** Rescans shared folders, given by their path on the disk */
export const refreshFolders = (paths: string[], name: string) =>
  socket
    .post<{ result: keyof typeof REFRESH_RESULTS }>('share/refresh/paths', { paths })
    .then(({ result }) => toast(REFRESH_RESULTS[result](name)), reportError(`Refresh ${name}`));

/** Rescans folders of the own share, given by their path in the file list */
export const refreshInShare = async (paths: string[]) => {
  for (const path of new Set(paths)) {
    const name = path === '/' ? 'the share' : lastSegment(path);
    await socket
      .post('share/refresh/virtual', { path })
      .then(() => toast(`Refreshing ${name}`), reportError(`Refresh ${name}`));
  }
};

/* Windows */

let searchCounter = 0;
export const openSearch = (initial?: SearchTab['initial']) => {
  const key = `search:${++searchCounter}`;
  useApp.setState((s) => ({
    searches: [...s.searches, { key, title: initial?.pattern || 'Search', initial }],
  }));
  openTab(key);
};

export const closeWindow = async (key: string) => {
  const id = windowId(key);
  const remove = async (path: string) => {
    try {
      await socket.delete(path);
    } catch (e) {
      if ((e as ApiError).code !== 404) {
        reportError('Close')(e);
        return false;
      }
    }

    return true;
  };

  switch (windowType(key)) {
    case 'hub': {
      const hub = useApp.getState().hubs.find((h) => String(h.id) === id);
      if (hub?.connect_state.id === 'connected') {
        const ok = await confirm('Close hub', `Disconnect from ${hub.identity.name || hub.hub_url}?`);
        if (!ok) {
          return;
        }
      }

      if (await remove(`hubs/${id}`)) {
        releaseHubUsers(Number(id));
        useApp.setState((s) => ({ hubs: s.hubs.filter((h) => String(h.id) !== id) }));
        removeTab(key);
      }
      return;
    }
    case 'pm':
      if (await remove(`private_chat/${id}`)) {
        useApp.setState((s) => ({ chats: s.chats.filter((c) => c.id !== id) }));
        removeTab(key);
      }
      return;
    case 'filelist':
      if (await remove(`filelists/${id}`)) {
        useApp.setState((s) => ({ filelists: s.filelists.filter((l) => l.id !== id) }));
        removeTab(key);
      }
      return;
    case 'file':
      if (await remove(`view_files/${id}`)) {
        useApp.setState((s) => ({ files: s.files.filter((f) => f.id !== id) }));
        removeTab(key);
      }
      return;
    case 'search':
      closeSearch(key);
      removeTab(key);
      return;
    case 'settings':
      if (await confirmDiscard()) {
        useSettingsNav.setState({ dirty: false });
        removeTab(key);
      }
      return;
    default:
      removeTab(key);
  }
};

export const showWindow = (key: 'home' | 'syslog' | 'favorites' | 'queue' | 'transfers' | 'adl') => {
  openTab(key);
  activate(key);
};
