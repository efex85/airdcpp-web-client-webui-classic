// Keyboard shortcuts and the thumb buttons of the mouse

export type ThumbButton = 'back' | 'forward';

export interface ShortcutAction {
  id: string;
  label: string;
  /** Default keyboard shortcut, '' for none */
  key: string;
  /** Default thumb button */
  mouse?: ThumbButton;
  /** Holding the keys down repeats it */
  repeat?: boolean;
}

// The default keys avoid the ones that browsers keep for themselves (such as Ctrl+W and Ctrl+Tab) and those that
// open their menus or address bar (Alt with D, E or F)
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'previous_tab', label: 'Previous tab', key: 'Alt+Shift+ArrowLeft', mouse: 'back', repeat: true },
  { id: 'next_tab', label: 'Next tab', key: 'Alt+Shift+ArrowRight', mouse: 'forward', repeat: true },
  { id: 'last_window', label: 'Last used window', key: 'Alt+Q' },
  { id: 'close_window', label: 'Close the current window', key: 'Alt+W' },
  { id: 'search', label: 'New search', key: 'Alt+N' },
  { id: 'home', label: 'Home', key: 'Alt+M' },
  { id: 'favorites', label: 'Favorite hubs', key: 'Alt+A' },
  { id: 'quick_connect', label: 'Quick connect', key: 'Alt+C' },
  { id: 'queue', label: 'Download queue', key: 'Alt+U' },
  { id: 'transfers', label: 'Transfers', key: 'Alt+R' },
  { id: 'transfer_pane', label: 'Show or hide the transfer pane', key: 'Alt+P' },
  { id: 'own_list', label: 'Open own file list', key: 'Alt+L' },
  { id: 'syslog', label: 'System log', key: 'Alt+G' },
  { id: 'settings', label: 'Settings', key: 'Alt+O' },
  { id: 'refresh_share', label: 'Refresh share', key: '' },
  { id: 'away', label: 'Away mode on or off', key: '' },
];

export const actionById = (id: string) => SHORTCUT_ACTIONS.find((a) => a.id === id);

/** What differs from the default of an action */
export interface ShortcutChange {
  /** The shortcut is switched off */
  off?: boolean;
  /** '' for none */
  key?: string;
  /** '' for none */
  mouse?: ThumbButton | '';
}

export interface ShortcutSettings {
  keyboard: boolean;
  mouse: boolean;
  changes: Record<string, ShortcutChange>;
}

export const SHORTCUT_DEFAULTS: ShortcutSettings = { keyboard: true, mouse: true, changes: {} };

export interface Shortcut {
  action: ShortcutAction;
  enabled: boolean;
  key: string;
  mouse: ThumbButton | '';
}

export const shortcutOf = (settings: ShortcutSettings, action: ShortcutAction): Shortcut => {
  const change = settings.changes[action.id];
  return {
    action,
    enabled: !change?.off,
    key: change?.key ?? action.key,
    mouse: change?.mouse ?? action.mouse ?? '',
  };
};

export const shortcutList = (settings: ShortcutSettings): Shortcut[] =>
  SHORTCUT_ACTIONS.map((action) => shortcutOf(settings, action));

/** The action of a key combination or thumb button, if shortcuts of that kind are switched on */
export const findShortcut = (
  settings: ShortcutSettings,
  kind: 'key' | 'mouse',
  value: string,
): ShortcutAction | undefined => {
  if (!value || !(kind === 'key' ? settings.keyboard : settings.mouse)) {
    return undefined;
  }

  const matches = shortcutList(settings).filter((s) => s.enabled && s[kind] === value);
  // Two devices may have given different actions the same keys: a choice made by the user wins over a default
  return (matches.find((s) => settings.changes[s.action.id]?.[kind] !== undefined) ?? matches[0])?.action;
};

/** Stores a change, leaving out what equals the default */
const withChange = (settings: ShortcutSettings, action: ShortcutAction, change: ShortcutChange): ShortcutSettings => {
  const next: ShortcutChange = { ...settings.changes[action.id], ...change };
  if (!next.off) {
    delete next.off;
  }

  if (next.key === action.key) {
    delete next.key;
  }

  if (next.mouse === (action.mouse ?? '')) {
    delete next.mouse;
  }

  const changes = { ...settings.changes, [action.id]: next };
  if (!Object.keys(next).length) {
    delete changes[action.id];
  }

  return { ...settings, changes };
};

export const setEnabled = (settings: ShortcutSettings, id: string, enabled: boolean): ShortcutSettings =>
  withChange(settings, actionById(id)!, { off: !enabled });

/**
 * Gives an action a key combination or thumb button. Other actions that had it lose it; they are returned, so that
 * the user can be told.
 */
export const assign = (
  settings: ShortcutSettings,
  id: string,
  kind: 'key' | 'mouse',
  value: string,
): { settings: ShortcutSettings; taken: ShortcutAction[] } => {
  const taken = value
    ? shortcutList(settings)
        .filter((s) => s.action.id !== id && s[kind] === value)
        .map((s) => s.action)
    : [];
  const cleared = taken.reduce((result, action) => withChange(result, action, { [kind]: '' }), settings);
  return { settings: withChange(cleared, actionById(id)!, { [kind]: value }), taken };
};

/** Back to the defaults of one action; other actions lose the keys that it gets back */
export const resetAction = (settings: ShortcutSettings, id: string) => {
  const action = actionById(id)!;
  const key = assign(settings, id, 'key', action.key);
  const mouse = assign(key.settings, id, 'mouse', action.mouse ?? '');
  return {
    settings: withChange(mouse.settings, action, { off: false }),
    taken: [...new Set([...key.taken, ...mouse.taken])],
  };
};

/* Key combinations: "Ctrl+Alt+Shift+Meta+" followed by the key */

export type KeyPress = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'> & {
  getModifierState?: (key: string) => boolean;
};

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'OS'];

const PUNCTUATION: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Minus: '-',
  Equal: '=',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
};

/**
 * The name of the pressed key. Letters follow the keyboard layout. When the pressed combination produces another
 * character (e.g. Option on a Mac, or a layout without Latin letters), the place of the key decides.
 */
const keyName = ({ key, code, altKey }: KeyPress): string => {
  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }

  const physical = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (physical) {
    return physical[1] ?? physical[2]!;
  }

  if (key === ' ' || code === 'Space') {
    return 'Space';
  }

  // Named keys, such as ArrowLeft and F2
  if (key.length > 1 && key !== 'Dead' && key !== 'Unidentified') {
    return key;
  }

  const ascii = key.length === 1 && key.charCodeAt(0) < 128;
  if (!ascii && altKey && PUNCTUATION[code]) {
    return PUNCTUATION[code]!;
  }

  if (key.length === 1) {
    return key === '+' ? 'Plus' : key.toUpperCase();
  }

  return PUNCTUATION[code] ?? '';
};

/** The combination of a key press; '' for a modifier alone and for characters typed with AltGr */
export const combinationOf = (event: KeyPress): string => {
  if (MODIFIER_KEYS.includes(event.key) || event.getModifierState?.('AltGraph')) {
    return '';
  }

  const name = keyName(event);
  if (!name) {
    return '';
  }

  return [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', name]
    .filter(Boolean)
    .join('+');
};

const parts = (combination: string) => {
  const list = combination.split('+');
  const key = list.pop()!;
  return { key, modifiers: new Set(list) };
};

/** Why a combination can't be used as a shortcut (null: it can) */
export const combinationProblem = (combination: string): string | null => {
  const { key, modifiers } = parts(combination);
  const command = modifiers.has('Ctrl') || modifiers.has('Meta');
  const functionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
  if (!command && !modifiers.has('Alt') && !functionKey) {
    return 'Use it together with Ctrl or Alt (or use a function key): other keys are needed for typing.';
  }

  const browser =
    (command && !modifiers.has('Alt') && ['W', 'T', 'N', 'Tab', 'PageUp', 'PageDown'].includes(key)) ||
    (key === 'F4' && (modifiers.has('Alt') || command)) ||
    (modifiers.has('Meta') && key === 'Q') ||
    (modifiers.has('Alt') && key === 'Tab');
  if (browser) {
    return 'The browser or the system keeps this combination for itself.';
  }

  if (command && !modifiers.has('Alt') && ['A', 'C', 'V', 'X', 'Y', 'Z'].includes(key)) {
    return 'This combination is needed for selecting, copying, pasting and undoing.';
  }

  return null;
};

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Escape: 'Esc',
};

/** A combination as shown to the user */
export const combinationLabel = (combination: string, mac = false): string => {
  if (!combination) {
    return '';
  }

  const { key, modifiers } = parts(combination);
  const names = [...modifiers].map((m) => (m === 'Meta' ? (mac ? 'Cmd' : 'Win') : m === 'Alt' && mac ? 'Option' : m));
  return [...names, KEY_LABELS[key] ?? key].join('+');
};

export const sanitizeShortcuts = (value: unknown): ShortcutSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<ShortcutSettings>;
  const changes: Record<string, ShortcutChange> = {};
  for (const action of SHORTCUT_ACTIONS) {
    const raw = source.changes?.[action.id];
    if (!raw || typeof raw !== 'object') {
      continue;
    }

    const change: ShortcutChange = {};
    if (raw.off === true) {
      change.off = true;
    }

    if (typeof raw.key === 'string' && (raw.key === '' || (raw.key.length <= 40 && !combinationProblem(raw.key)))) {
      change.key = raw.key;
    }

    if (raw.mouse === '' || raw.mouse === 'back' || raw.mouse === 'forward') {
      change.mouse = raw.mouse;
    }

    if (Object.keys(change).length) {
      changes[action.id] = change;
    }
  }

  return {
    keyboard: typeof source.keyboard === 'boolean' ? source.keyboard : true,
    mouse: typeof source.mouse === 'boolean' ? source.mouse : true,
    changes,
  };
};

/** The window before or after the shown one, going around at the ends */
export const neighbourWindow = (tabs: string[], active: string, step: 1 | -1): string | undefined => {
  if (!tabs.length) {
    return undefined;
  }

  const index = tabs.indexOf(active);
  return index === -1 ? tabs[0] : tabs[(index + step + tabs.length) % tabs.length];
};
