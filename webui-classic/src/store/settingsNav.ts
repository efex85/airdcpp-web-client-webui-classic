// The shown settings page and leaving a page with unsaved changes
import { create } from 'zustand';
import { load, save } from '../lib/storage';
import { openTab } from './app';
import { confirm } from './ui';

interface SettingsNavState {
  page: string;
  /** Set while the shown page has unsaved changes */
  dirty: boolean;
}

export const useSettingsNav = create<SettingsNavState>(() => ({
  page: load('settingsPage', 'user'),
  dirty: false,
}));

export const confirmDiscard = async (): Promise<boolean> =>
  !useSettingsNav.getState().dirty ||
  (await confirm('Unsaved changes', 'You have unsaved changes. Discard them?', 'Discard'));

/** Returns false if the user wants to stay on the page with unsaved changes */
export const showSettingsPage = async (page: string): Promise<boolean> => {
  if (page === useSettingsNav.getState().page) {
    return true;
  }

  if (!(await confirmDiscard())) {
    return false;
  }

  useSettingsNav.setState({ page, dirty: false });
  save('settingsPage', page);
  return true;
};

export const openSettings = (page?: string) => {
  openTab('settings');
  if (page) {
    void showSettingsPage(page);
  }
};
