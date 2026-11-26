// Settings of this browser (not stored by the client)
import { create } from 'zustand';
import type { SettingDefinition } from '../api/settingsTypes';
import { load, save } from '../lib/storage';

export interface LocalSettings {
  notify_mention_my_nick: boolean;
  notify_pm_user: boolean;
  notify_pm_bot: boolean;
  notify_hub_message: boolean;
  notify_bundle_status: boolean;
  notify_events_info: boolean;
  notify_events_warning: boolean;
  notify_events_error: boolean;
  unread_label_delay: number;
  background_image_url: string;
  /** Percent */
  ui_text_size: number;
  /** Percent, in addition to ui_text_size */
  chat_text_size: number;
  chat_font: string;
  chat_timestamps: string;
}

const toggle = (key: keyof LocalSettings, title: string, value: boolean, help?: string): SettingDefinition => ({
  key,
  title,
  type: 'boolean',
  default_value: value,
  help,
});

export const NOTIFICATION_DEFINITIONS: SettingDefinition[] = [
  toggle('notify_mention_my_nick', 'Mentions of my nick', true),
  toggle('notify_pm_user', 'Private messages from users', true),
  toggle('notify_pm_bot', 'Private messages from bots', false),
  toggle('notify_hub_message', 'Hub messages', false, 'Only in hubs where chat notifications are enabled'),
  toggle('notify_bundle_status', 'Download status changes', true),
  toggle('notify_events_info', 'Information messages of the system log', false),
  toggle('notify_events_warning', 'Warnings of the system log', true),
  toggle('notify_events_error', 'Errors of the system log', true),
];

export const MISC_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'unread_label_delay',
    title: 'Delay for marking chat sessions as read (seconds)',
    type: 'number',
    min: 0,
    default_value: 0,
  },
  { key: 'background_image_url', title: 'Background image address', type: 'url', optional: true, default_value: '' },
];

const select = (
  key: keyof LocalSettings,
  title: string,
  options: [id: string | number, name: string][],
  value: string | number,
  help?: string,
): SettingDefinition => ({
  key,
  title,
  type: typeof value === 'number' ? 'number' : 'string',
  default_value: value,
  options: options.map(([id, name]) => ({ id, name })),
  help,
});

const percentages = (...values: number[]): [number, string][] => values.map((v) => [v, `${v} %`]);

export const TEXT_DEFINITIONS: SettingDefinition[] = [
  select('ui_text_size', 'Text size of the interface', percentages(90, 100, 110, 125, 140), 100),
  select(
    'chat_text_size',
    'Text size of chats and the system log',
    percentages(85, 100, 115, 130, 150),
    100,
    'In addition to the text size of the interface',
  ),
  select(
    'chat_font',
    'Font of chats and the system log',
    [
      ['default', 'Same as the interface'],
      ['mono', 'Fixed width'],
      ['serif', 'Serif'],
    ],
    'default',
  ),
  select(
    'chat_timestamps',
    'Timestamps',
    [
      ['seconds', 'Hours, minutes and seconds'],
      ['minutes', 'Hours and minutes'],
      ['none', 'Hidden'],
    ],
    'seconds',
  ),
];

const DEFINITIONS = [...NOTIFICATION_DEFINITIONS, ...MISC_DEFINITIONS, ...TEXT_DEFINITIONS];

export const LOCAL_DEFAULTS = Object.fromEntries(
  DEFINITIONS.map((def) => [def.key, def.default_value]),
) as unknown as LocalSettings;

/** Ignores stored values of the wrong type; null restores the default */
export const mergeLocalSettings = (current: LocalSettings, changed: Record<string, unknown>): LocalSettings => {
  const ret: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(changed)) {
    if (!(key in LOCAL_DEFAULTS)) {
      continue;
    }

    const fallback = LOCAL_DEFAULTS[key as keyof LocalSettings];
    const options = DEFINITIONS.find((def) => def.key === key)?.options;
    const valid = typeof value === typeof fallback && (!options || options.some((o) => o.id === value));
    ret[key] = valid ? value : fallback;
  }

  return ret as unknown as LocalSettings;
};

const STORAGE_KEY = 'ui-settings';

export const useLocalSettings = create<LocalSettings>(() =>
  mergeLocalSettings(LOCAL_DEFAULTS, load<Record<string, unknown>>(STORAGE_KEY, {}) ?? {}),
);

export const saveLocalSettings = (changed: Record<string, unknown>) => {
  const next = mergeLocalSettings(useLocalSettings.getState(), changed);
  useLocalSettings.setState(next);
  save(STORAGE_KEY, next);
};
