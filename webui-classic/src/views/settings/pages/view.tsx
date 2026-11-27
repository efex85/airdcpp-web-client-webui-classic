import { useState } from 'react';
import type { SettingDefinition, SettingValues } from '../../../api/settingsTypes';
import { requestPermission, nativeState } from '../../../lib/browserNotification';
import { withSearch } from '../../../lib/settingsSearch';
import {
  MISC_DEFINITIONS,
  NOTIFICATION_DEFINITIONS,
  saveLocalSettings,
  useLocalSettings,
} from '../../../store/localSettings';
import { Fields, Note, Page, Section, useForm, useRemoteForm } from '../form';
import { settingsPage } from './common';

/** Settings that are stored in this browser */
export const useLocalForm = (definitions: SettingDefinition[]) =>
  useForm({
    canSave: true,
    load: async () => ({ definitions, saved: { ...useLocalSettings.getState() } as unknown as SettingValues }),
    save: async (changed) => saveLocalSettings(changed),
  });

const LocalNote = () => <Note>The settings on this page are stored in this browser.</Note>;

const BrowserPermission = () => {
  const [state, setState] = useState(nativeState);
  const text = {
    granted: 'Enabled. They are shown while this page is in the background.',
    denied: 'Blocked in the browser settings. Notifications are only shown inside the page.',
    default: 'Not enabled yet. Notifications are only shown inside the page.',
    insecure: 'Browsers only allow them over HTTPS (or on localhost). Notifications are only shown inside the page.',
    unsupported: 'Not supported by this browser. Notifications are only shown inside the page.',
  }[state];

  return (
    <Section title="Notifications of the browser">
      <Note>{text}</Note>
      {state === 'default' && (
        <div className="settings-actions">
          <button type="button" onClick={() => void requestPermission().then(() => setState(nativeState()))}>
            Allow notifications
          </button>
        </div>
      )}
    </Section>
  );
};

const localEntries = (definitions: SettingDefinition[]) =>
  definitions.map((def) => ({ title: def.title, help: def.help, selector: `[data-key="${def.key}"]` }));

const Notifications = () => {
  const form = useLocalForm(NOTIFICATION_DEFINITIONS);
  return (
    <Page form={form}>
      <LocalNote />
      <Section title="Popup notifications">
        <Fields form={form} keys={NOTIFICATION_DEFINITIONS.map((d) => d.key)} />
      </Section>
      <BrowserPermission />
    </Page>
  );
};

export const NotificationsPage = withSearch(Notifications, {
  words: 'popup',
  items: [...localEntries(NOTIFICATION_DEFINITIONS), { title: 'Notifications of the browser', words: 'allow' }],
});

const BrowserMisc = () => {
  const form = useLocalForm(MISC_DEFINITIONS);
  return (
    <Page form={form}>
      <LocalNote />
      <Fields form={form} keys={MISC_DEFINITIONS.map((d) => d.key)} />
    </Page>
  );
};

export const BrowserMiscPage = withSearch(BrowserMisc, { items: localEntries(MISC_DEFINITIONS) });

const CACHE_KEYS = ['history_hub_messages', 'history_pm_messages', 'history_log_messages'];
const SESSION_KEYS = ['history_hub_sessions', 'history_pm_sessions', 'history_filelist_sessions'];
const HISTORY_KEYS = ['history_search_max', 'history_download_max', 'history_chat_log_lines'];

const Histories = () => {
  const form = useRemoteForm([...HISTORY_KEYS, ...CACHE_KEYS, ...SESSION_KEYS]);
  return (
    <Page form={form}>
      <Fields form={form} keys={HISTORY_KEYS} />
      <Section title="Maximum number of messages to cache">
        <Fields form={form} keys={CACHE_KEYS} />
      </Section>
      <Section title="Maximum number of previously opened sessions">
        <Fields form={form} keys={SESSION_KEYS} />
      </Section>
    </Page>
  );
};

export const HistoriesPage = withSearch(Histories, {
  keys: [...HISTORY_KEYS, ...CACHE_KEYS, ...SESSION_KEYS],
  // Names such as "Private chat" only make sense with the title of their group
  describe: (key, name) => {
    if (CACHE_KEYS.includes(key)) {
      return { title: `${name} (cached messages)` };
    }

    return SESSION_KEYS.includes(key) ? { title: `${name} (previously opened)` } : {};
  },
  items: [
    { title: 'Maximum number of messages to cache' },
    { title: 'Maximum number of previously opened sessions' },
  ],
});

export const EventsPage = settingsPage([
  'report_uploads',
  'report_downloads',
  'report_search_alternates',
  'report_added_sources',
  'report_blocked_share',
  'report_hashed_files',
  'report_scheduled_refreshes',
  'report_filelist_dupes',
]);

export const AppearancePage = settingsPage(['use_main_chat_notify', 'show_joins', 'format_release_names']);
