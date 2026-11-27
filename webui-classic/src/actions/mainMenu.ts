// The main menu, also used by the toolbar and the small screen drawer
import { removeCompleted } from '../views/Queue';
import { activate, reportError, useApp, windowType } from '../store/app';
import { favorites, logout, socket } from '../store/session';
import { confirm, showDialog, type MenuEntry } from '../store/ui';
import { save } from '../lib/storage';
import { hasAccess } from '../lib/access';
import { openSettings } from '../store/settingsNav';
import { windowInfo } from '../lib/windows';
import { rootFolderEntries, type GroupedRoot } from '../lib/refreshMenu';
import {
  closeWindow,
  connectHub,
  hubMenu,
  openOwnList,
  openSearch,
  quickConnect,
  refreshFolders,
  refreshShare,
  showWindow,
  userMenu,
} from '.';
import { activeKeys } from './shortcuts';

export const toggleAway = () =>
  socket.post('system/away', { away: !useApp.getState().away }).catch(reportError('Away'));

export const toggleTransferPane = () => {
  const showTransfers = !useApp.getState().showTransfers;
  useApp.setState({ showTransfers });
  save('showTransfers', showTransfers);
};

const askLogout = async () => {
  if (await confirm('Log out', 'Log out from the web interface? The client keeps running.', 'Log out')) {
    await logout();
  }
};

const about = () => {
  const { login } = useApp.getState();
  void showDialog({
    title: 'About AirDC++ Classic',
    text:
      'A web interface in the style of the classic Windows clients, for the AirDC++ Web Client. ' +
      `Client ${login?.system_info.client_version ?? ''}, logged in as ${login?.user.username ?? ''}.`,
    cancelLabel: null,
  });
};

const refreshEntries = (): MenuEntry[] => [
  { label: 'Refresh share', keys: activeKeys('refresh_share'), onClick: () => void refreshShare() },
  { label: 'Refresh incoming folders', onClick: () => void refreshShare(true) },
];

const rootFolders = async (): Promise<MenuEntry[]> =>
  rootFolderEntries(await socket.get<GroupedRoot[]>('share/grouped_root_paths'), (paths, name) =>
    void refreshFolders(paths, name),
  );

/** The refresh choices of the toolbar, with the shared folders listed below */
export const refreshMenu = (): { entries: MenuEntry[]; more?: () => Promise<MenuEntry[]> } => ({
  entries: refreshEntries(),
  more: hasAccess('share_edit')
    ? async () => {
        const folders = await rootFolders().catch((e) => {
          reportError('Shared folders')(e);
          return [];
        });
        return folders.length ? [{ label: 'Refresh a single folder', heading: true }, ...folders] : [];
      }
    : undefined,
});

export const fileMenu = (): MenuEntry[] => [
  { label: 'Quick connect…', keys: activeKeys('quick_connect'), onClick: () => void quickConnect() },
  { label: 'Open own file list', keys: activeKeys('own_list'), onClick: () => void openOwnList() },
  'separator',
  { label: 'Settings', keys: activeKeys('settings'), onClick: () => openSettings() },
  { label: 'Shared folders', disabled: !hasAccess('share_view'), onClick: () => openSettings('share') },
  'separator',
  ...refreshEntries(),
  {
    label: 'Refresh folder',
    disabled: !hasAccess('share_edit'),
    load: async () => {
      const folders = await rootFolders();
      return folders.length ? folders : [{ label: 'No shared folders', disabled: true }];
    },
  },
  'separator',
  { label: 'Away', keys: activeKeys('away'), checked: useApp.getState().away, onClick: () => void toggleAway() },
  { label: 'Log out', onClick: () => void askLogout() },
];

export const favoriteMenu = (): MenuEntry[] => {
  const hubs = [...favorites.getSnapshot()].sort((a, b) => a.name.localeCompare(b.name));
  return [
    { label: 'Manage favorite hubs', onClick: () => showWindow('favorites') },
    ...(hubs.length ? ['separator' as const] : []),
    ...hubs.map((h) => ({
      label: h.name,
      checked: !!h.connect_state.current_hub_id,
      onClick: () => void connectHub(h.hub_url),
    })),
  ];
};

export const viewMenu = (): MenuEntry[] => [
  ...(useApp.getState().homeEnabled
    ? [{ label: 'Home', keys: activeKeys('home'), onClick: () => showWindow('home') }]
    : []),
  { label: 'System log', keys: activeKeys('syslog'), onClick: () => showWindow('syslog') },
  { label: 'Favorite hubs', keys: activeKeys('favorites'), onClick: () => showWindow('favorites') },
  { label: 'Download queue', keys: activeKeys('queue'), onClick: () => showWindow('queue') },
  { label: 'Transfers', keys: activeKeys('transfers'), onClick: () => showWindow('transfers') },
  { label: 'New search', keys: activeKeys('search'), onClick: () => openSearch() },
  'separator',
  {
    label: 'Transfer pane',
    keys: activeKeys('transfer_pane'),
    checked: useApp.getState().showTransfers,
    onClick: toggleTransferPane,
  },
];

export const transferMenu = (): MenuEntry[] => [
  { label: 'Download queue', onClick: () => showWindow('queue') },
  { label: 'Remove completed from the queue', onClick: () => void removeCompleted() },
];

const closeAll = (type: string) =>
  useApp
    .getState()
    .tabs.filter((key) => windowType(key) === type)
    .forEach((key) => void closeWindow(key));

export const windowListMenu = (): MenuEntry[] => {
  const state = useApp.getState();
  const count = (type: string) => state.tabs.filter((key) => windowType(key) === type).length;
  return [
    {
      label: 'Close the current window',
      keys: activeKeys('close_window'),
      disabled: !state.active,
      onClick: () => void closeWindow(state.active),
    },
    { label: 'Close all private messages', disabled: !count('pm'), onClick: () => closeAll('pm') },
    { label: 'Close all file lists', disabled: !count('filelist'), onClick: () => closeAll('filelist') },
    { label: 'Close all searches', disabled: !count('search'), onClick: () => closeAll('search') },
    { label: 'Close all viewed files', disabled: !count('file'), onClick: () => closeAll('file') },
    ...(state.tabs.length ? ['separator' as const] : []),
    ...state.tabs.map((key) => ({
      label: windowInfo(key, state).title,
      checked: key === state.active,
      onClick: () => activate(key),
    })),
  ];
};

export const helpMenu = (): MenuEntry[] => [{ label: 'About', onClick: about }];

export const MAIN_MENU: [string, () => MenuEntry[]][] = [
  ['File', fileMenu],
  ['View', viewMenu],
  ['Transfers', transferMenu],
  ['Window', windowListMenu],
  ['Help', helpMenu],
];

/** Context menu of a window (tab) */
export const windowMenu = (key: string): { entries: MenuEntry[]; more?: () => Promise<MenuEntry[]> } => {
  const state = useApp.getState();
  const close: MenuEntry = { label: 'Close', onClick: () => void closeWindow(key) };
  const id = key.slice(key.indexOf(':') + 1);
  switch (windowType(key)) {
    case 'hub': {
      const hub = state.hubs.find((h) => String(h.id) === id);
      return hub ? hubMenu(hub) : { entries: [close] };
    }
    case 'pm':
    case 'filelist': {
      const user =
        windowType(key) === 'pm'
          ? state.chats.find((c) => c.id === id)?.user
          : state.filelists.find((l) => l.id === id)?.user;
      return { entries: user ? [...userMenu(user), 'separator', close] : [close] };
    }
    case 'search':
      return { entries: [{ label: 'New search', onClick: () => openSearch() }, 'separator', close] };
    default:
      return { entries: [close] };
  }
};
