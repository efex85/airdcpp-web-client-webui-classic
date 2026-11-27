// The colors that can be changed and the ready-made color sets

import { TAB_EVENTS, type TabHighlights } from './tabEvents';

export type ColorGroup = 'Nicknames' | 'Tabs' | 'Chat' | 'Shared, queued and downloaded items' | 'Interface';

export interface ColorDefinition {
  key: string;
  label: string;
  group: ColorGroup;
  /** CSS variable that receives the color */
  cssVar: string;
  /** Without a color of its own: how it looks then */
  optional?: string;
  /** Shown below the name */
  help?: string;
  /** Further variables that follow this color when it has been changed: variable, share of the text color (%) */
  derived?: [cssVar: string, textShare: number][];
  /** The default of the bold choice (nicknames only) */
  bold?: boolean;
  /** Font weight of bold text */
  weight?: number;
}

const color = (
  group: ColorGroup,
  key: string,
  label: string,
  cssVar: string,
  extra: Partial<ColorDefinition> = {},
): ColorDefinition => ({ group, key, label, cssVar, ...extra });

const ITEMS: ColorGroup = 'Shared, queued and downloaded items';

export const COLOR_DEFINITIONS: ColorDefinition[] = [
  color('Nicknames', 'nick', 'Other users', '--nick', { optional: 'Same as the text', bold: false }),
  color('Nicknames', 'nick_self', 'My nick', '--self', { bold: true }),
  color('Nicknames', 'nick_op', 'Operators', '--op', { bold: true, weight: 600 }),
  color('Nicknames', 'nick_bot', 'Bots', '--bot', { bold: false }),
  color('Nicknames', 'nick_favorite', 'Favorite users', '--nick-favorite', {
    optional: 'No color of their own',
    bold: false,
    help: 'Users that are favorites in the configuration of the client; this interface can’t add them',
  }),
  color('Nicknames', 'nick_ignored', 'Ignored users', '--nick-ignored', { optional: 'No color of their own', bold: false }),

  // The tabs: a background (which also has the bold choice) and a text color for every event
  ...TAB_EVENTS.flatMap((event) => {
    const name = `${event.place === 'hub' ? 'Hub chat' : 'Private chat'}, ${event.label.toLowerCase()}`;
    // Only the first two have colors of their own in the color sets
    const optional = event.fallback ? { optional: 'Same as another event' } : {};
    const css = `--${event.colors.replaceAll('_', '-')}`;
    return [
      color('Tabs', `${event.colors}_bg`, `${name}: background`, `${css}-bg`, {
        // Tabs of mentions and private messages are bold unless that is switched off
        bold: event.level === 'mention',
        weight: 600,
        ...optional,
      }),
      color('Tabs', `${event.colors}_text`, `${name}: text`, `${css}-text`, { optional: 'Same as the text' }),
    ];
  }),
  color('Tabs', 'dot_unread', 'Phone menu dot: new messages', '--dot-unread'),
  color('Tabs', 'dot_mention', 'Phone menu dot: mention', '--dot-mention'),

  color('Chat', 'chat_mention', 'Highlighted nicks', '--mention'),
  color('Chat', 'chat_mention_line', 'Background tint of lines that mention me', '--mention-line'),
  color('Chat', 'chat_link', 'Links', '--link'),
  color('Chat', 'chat_time', 'Timestamps', '--chat-time', { optional: 'As the text; orange in the system log' }),
  color('Chat', 'chat_status', 'Status messages', '--chat-status', { optional: 'Dimmed text' }),

  color(ITEMS, 'dupe_shared', 'Already shared', '--dupe-shared'),
  color(ITEMS, 'dupe_queued', 'In the download queue', '--dupe-queued'),
  color(ITEMS, 'dupe_finished', 'Downloaded', '--dupe-finished'),

  color('Interface', 'ui_bg', 'Background', '--bg'),
  color('Interface', 'ui_chrome', 'Bars and panels', '--chrome', { derived: [['--chrome-hover', 8], ['--select-inactive', 8]] }),
  color('Interface', 'ui_input', 'Input fields', '--bg-input'),
  color('Interface', 'ui_text', 'Text', '--text'),
  color('Interface', 'ui_muted', 'Dimmed text', '--muted'),
  color('Interface', 'ui_accent', 'Accent', '--accent'),
  color('Interface', 'ui_select', 'Selection', '--select'),
  color('Interface', 'ui_border', 'Borders', '--border', { derived: [['--border-strong', 15]] }),
];

export interface Preset {
  name: string;
  /** Colors of the definitions, without the optional ones */
  colors: Record<string, string>;
  /** Values of the derived variables */
  derived: Record<string, string>;
}

// Must match the values in styles.css
const CLASSIC: Preset = {
  name: 'Classic dark',
  colors: {
    nick_self: '#55d17a',
    nick_op: '#62a8ff',
    nick_bot: '#cfa94e',
    tab_unread_bg: '#22344d',
    tab_mention_bg: '#5b3a1c',
    dot_unread: '#4d9bff',
    dot_mention: '#e8953c',
    chat_mention: '#f2c14e',
    chat_mention_line: '#f2c14e',
    chat_link: '#6cb6ff',
    dupe_shared: '#55c46f',
    dupe_queued: '#e8953c',
    dupe_finished: '#6cb6ff',
    ui_bg: '#1e1e1e',
    ui_chrome: '#29282d',
    ui_input: '#171717',
    ui_text: '#dcdcdc',
    ui_muted: '#8e8d94',
    ui_accent: '#4d9bff',
    ui_select: '#1f4f82',
    ui_border: '#3d3c43',
  },
  derived: { '--chrome-hover': '#38373e', '--select-inactive': '#38373e', '--border-strong': '#57565f' },
};

const preset = (name: string, colors: Record<string, string>, derived: Preset['derived']): Preset => ({
  name,
  colors: { ...CLASSIC.colors, ...colors },
  derived: { ...CLASSIC.derived, ...derived },
});

export const PRESETS: Record<string, Preset> = {
  classic: CLASSIC,
  black: preset(
    'Black',
    {
      ui_bg: '#000000',
      ui_chrome: '#131315',
      ui_input: '#0a0a0a',
      ui_text: '#d8d8d8',
      ui_muted: '#8a8990',
      ui_select: '#17456f',
      ui_border: '#2b2b31',
      tab_unread_bg: '#14283f',
      tab_mention_bg: '#4a2c10',
    },
    { '--chrome-hover': '#242428', '--select-inactive': '#242428', '--border-strong': '#47474f' },
  ),
  midnight: preset(
    'Midnight blue',
    {
      ui_bg: '#0f1626',
      ui_chrome: '#18223a',
      ui_input: '#0a101d',
      ui_text: '#d7e0f0',
      ui_muted: '#8e9cbb',
      ui_accent: '#6aa8ff',
      ui_select: '#27558f',
      ui_border: '#2a3857',
      tab_unread_bg: '#1f3f6e',
      tab_mention_bg: '#6a3d1a',
    },
    { '--chrome-hover': '#25324f', '--select-inactive': '#25324f', '--border-strong': '#43547a' },
  ),
  warm: preset(
    'Warm brown',
    {
      ui_bg: '#1f1a17',
      ui_chrome: '#2c2420',
      ui_input: '#181412',
      ui_text: '#e6dbce',
      ui_muted: '#a09284',
      ui_accent: '#e0a05a',
      ui_select: '#6e431b',
      ui_border: '#41362e',
      nick_op: '#86bce8',
      chat_link: '#e8b574',
      dot_unread: '#e0a05a',
      dot_mention: '#ff7b54',
      tab_unread_bg: '#4a3a24',
      tab_mention_bg: '#6b2f1f',
    },
    { '--chrome-hover': '#3b312b', '--select-inactive': '#3b312b', '--border-strong': '#5c4d42' },
  ),
  contrast: preset(
    'High contrast',
    {
      ui_bg: '#000000',
      ui_chrome: '#101010',
      ui_input: '#000000',
      ui_text: '#ffffff',
      ui_muted: '#c8c8c8',
      ui_accent: '#5cb0ff',
      ui_select: '#0050c8',
      ui_border: '#6a6a6a',
      nick_self: '#3dff7a',
      nick_op: '#7cc8ff',
      nick_bot: '#ffd24a',
      chat_link: '#8fd0ff',
      chat_mention: '#ffe14a',
      chat_mention_line: '#ffe14a',
      dupe_shared: '#3dff7a',
      dupe_queued: '#ffad42',
      dupe_finished: '#8fd0ff',
      tab_unread_bg: '#00428f',
      tab_mention_bg: '#8a4b00',
    },
    { '--chrome-hover': '#2a2a2a', '--select-inactive': '#333333', '--border-strong': '#a0a0a0' },
  ),
};

export interface ColorSettings {
  preset: string;
  /** Colors that differ from the preset */
  colors: Record<string, string>;
  /** Bold choices that differ from the default */
  bold: Record<string, boolean>;
  /** Which events mark a tab, where it differs from the default */
  highlight: TabHighlights;
}

export const DEFAULT_COLORS: ColorSettings = { preset: 'classic', colors: {}, bold: {}, highlight: {} };

const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export const sanitizeColors = (value: unknown): ColorSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof ColorSettings, any>>;
  const pick = <T>(entries: unknown, valid: (def: ColorDefinition, v: unknown) => boolean): Record<string, T> =>
    Object.fromEntries(
      COLOR_DEFINITIONS.flatMap((def) => {
        const v = (entries as Record<string, unknown> | undefined)?.[def.key];
        return valid(def, v) ? [[def.key, v as T]] : [];
      }),
    );

  return {
    preset: Object.hasOwn(PRESETS, source.preset) ? source.preset : 'classic',
    colors: pick<string>(source.colors, (_, v) => isColor(v)),
    bold: pick<boolean>(source.bold, (def, v) => def.bold !== undefined && typeof v === 'boolean'),
    highlight: Object.fromEntries(
      TAB_EVENTS.flatMap((event) => {
        const v = source.highlight?.[event.id];
        return typeof v === 'boolean' ? [[event.id, v]] : [];
      }),
    ),
  };
};

const presetOf = (settings: ColorSettings) => PRESETS[settings.preset] ?? CLASSIC;

/** The shown color; undefined for optional colors that haven't been set */
export const colorOf = (settings: ColorSettings, key: string): string | undefined =>
  settings.colors[key] ?? presetOf(settings).colors[key];

export const isBold = (settings: ColorSettings, key: string): boolean =>
  settings.bold[key] ?? !!COLOR_DEFINITIONS.find((d) => d.key === key)?.bold;

export interface ResolvedTheme {
  /** CSS variables to set; null removes the variable */
  variables: Record<string, string | null>;
  /** Classes of the root element: the optional colors that have been set */
  classes: Record<string, boolean>;
}

export const resolveTheme = (settings: ColorSettings): ResolvedTheme => {
  const base = presetOf(settings);
  const variables: Record<string, string | null> = { ...base.derived };
  const classes: Record<string, boolean> = {};

  for (const def of COLOR_DEFINITIONS) {
    const value = colorOf(settings, def.key);
    variables[def.cssVar] = value ?? null;
    if (def.optional) {
      classes[`custom-${def.key.replace('_', '-')}`] = !!value;
    }

    if (def.bold !== undefined) {
      variables[`${def.cssVar}-weight`] = isBold(settings, def.key) ? String(def.weight ?? 700) : '400';
    }

    if (settings.colors[def.key]) {
      for (const [cssVar, textShare] of def.derived ?? []) {
        variables[cssVar] = `color-mix(in srgb, ${settings.colors[def.key]}, var(--text) ${textShare}%)`;
      }
    }
  }

  return { variables, classes };
};

/**
 * The classes and variables for showing a part of the page with other colors than the rest of it: what isn't set is
 * reset, so that nothing is inherited from the colors of the page
 */
export const scopedTheme = (settings: ColorSettings): { classes: string[]; variables: Record<string, string> } => {
  const { variables, classes } = resolveTheme(settings);
  const scoped = Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, value ?? 'initial']));
  for (const def of COLOR_DEFINITIONS) {
    if (def.optional && def.bold !== undefined && !colorOf(settings, def.key) && def.key !== 'nick') {
      scoped[`${def.cssVar}-weight`] = 'initial';
    }
  }

  return { classes: Object.keys(classes).filter((name) => classes[name]), variables: scoped };
};
