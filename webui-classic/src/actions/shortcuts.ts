// What the keyboard shortcuts and thumb buttons do
import { actionById, neighbourWindow, shortcutOf } from '../lib/shortcuts';
import { activate, lastUsedWindow, useApp } from '../store/app';
import { shortcutsDoc } from '../store/docs';
import { openSettings } from '../store/settingsNav';
import { closeWindow, openOwnList, openSearch, quickConnect, refreshShare, showWindow } from '.';
import { toggleAway, toggleTransferPane } from './mainMenu';

const step = (direction: 1 | -1) => {
  const { tabs, active } = useApp.getState();
  const next = neighbourWindow(tabs, active, direction);
  if (next) {
    activate(next);
  }
};

const ACTIONS: Record<string, () => unknown> = {
  previous_tab: () => step(-1),
  next_tab: () => step(1),
  last_window: () => {
    const key = lastUsedWindow();
    if (key) {
      activate(key);
    }
  },
  close_window: () => {
    const { active } = useApp.getState();
    return active && closeWindow(active);
  },
  search: () => openSearch(),
  home: () => useApp.getState().homeEnabled && showWindow('home'),
  favorites: () => showWindow('favorites'),
  adl: () => showWindow('adl'),
  quick_connect: () => quickConnect(),
  queue: () => showWindow('queue'),
  transfers: () => showWindow('transfers'),
  transfer_pane: () => toggleTransferPane(),
  own_list: () => openOwnList(),
  syslog: () => showWindow('syslog'),
  settings: () => openSettings(),
  refresh_share: () => refreshShare(),
  away: () => toggleAway(),
};

export const runShortcut = (id: string) => void ACTIONS[id]?.();

/** The keys of an action as they are set now ('' without a usable shortcut), shown next to menu entries */
export const activeKeys = (id: string): string => {
  const settings = shortcutsDoc.value;
  const shortcut = shortcutOf(settings, actionById(id)!);
  return settings.keyboard && shortcut.enabled ? shortcut.key : '';
};
