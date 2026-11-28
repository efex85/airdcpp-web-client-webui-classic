import { create } from 'zustand';
import type {
  FilelistSession,
  HubSession,
  LoginResponse,
  LogMessage,
  MessageCounts,
  MessageWrapper,
  PrivateChatSession,
  TransferStats,
  ViewFile,
} from '../api/types';
import { startupTabs, type StartupSettings } from '../lib/startup';
import { load, save } from '../lib/storage';
import { mergeOrder, moveItem, orderTabs, savedIndex, savedTabId } from '../lib/tabOrder';
import { rememberWindow, windowAfterClose } from '../lib/windowHistory';

export type ConnectionState = 'login' | 'connecting' | 'connected' | 'reconnecting';

export type WindowType =
  | 'home'
  | 'syslog'
  | 'favorites'
  | 'adl'
  | 'queue'
  | 'transfers'
  | 'settings'
  | 'hub'
  | 'pm'
  | 'filelist'
  | 'search'
  | 'file';

export interface SearchTab {
  key: string; // 'search:<n>'
  title: string;
  /** Search to run as soon as the window opens ("search for alternates" etc.) */
  initial?: { pattern: string; fileType?: string };
}

export interface Toast {
  id: number;
  text: string;
  error: boolean;
  /** Run when the notification is clicked */
  action?: () => void;
}

export interface AppState {
  connection: ConnectionState;
  loginError: string | null;
  login: LoginResponse | null;
  /** A saved login is being used: the login form isn't shown */
  resuming: boolean;
  /** Increases after every (re)connect; views reload their data when it changes */
  generation: number;

  hubs: HubSession[];
  chats: PrivateChatSession[];
  filelists: FilelistSession[];
  /** Files opened for viewing */
  files: ViewFile[];
  searches: SearchTab[];

  /** Open windows in tab order */
  tabs: string[];
  active: string;
  /** The Home window can be disabled in the settings */
  homeEnabled: boolean;

  messages: Record<string, MessageWrapper[]>;
  logCounts: MessageCounts | null;
  lastEvent: LogMessage | null;
  stats: Partial<TransferStats>;
  hubStats: { total_users?: number; total_share?: number } | null;
  shareSize: number | null;
  away: boolean;

  showTransfers: boolean;
  toasts: Toast[];
}

/** Windows that are restored after reloading the page or logging in again */
const STATIC_TABS = ['home', 'syslog', 'favorites', 'queue', 'adl', 'settings'];

const storedTabs = () => load<string[]>('tabs', []).filter((key) => STATIC_TABS.includes(key));

export const useApp = create<AppState>(() => ({
  connection: 'login',
  loginError: null,
  login: null,
  resuming: false,
  generation: 0,
  hubs: [],
  chats: [],
  filelists: [],
  files: [],
  searches: [],
  tabs: storedTabs(),
  active: load('active', '', 'session'),
  homeEnabled: true,
  messages: {},
  logCounts: null,
  lastEvent: null,
  stats: {},
  hubStats: null,
  shareSize: null,
  away: false,
  showTransfers: load('showTransfers', true),
  toasts: [],
}));

export const windowType = (key: string): WindowType => key.split(':')[0] as WindowType;
export const windowId = (key: string): string => key.slice(key.indexOf(':') + 1);

/** The windows in the order in which they have been used */
let history = load<string[]>('history', [], 'session');

useApp.subscribe((s, previous) => {
  if (s.active && s.active !== previous.active) {
    history = rememberWindow(history, s.active);
    save('history', history, 'session');
  }
});

/**
 * New windows are added at the end. Home goes to the beginning, and a hub to the place that it had when the
 * tabs were rearranged.
 */
const withTab = (tabs: string[], key: string) => {
  if (tabs.includes(key)) {
    return tabs;
  }

  let index = key === 'home' ? 0 : tabs.length;
  if (windowType(key) === 'hub' && tabOrder && orderApplied) {
    index = savedIndex(tabs.map(tabId), tabOrder, tabId(key));
  }

  return [...tabs.slice(0, index), key, ...tabs.slice(index)];
};

export const openTab = (key: string, activate = true) => {
  useApp.setState((s) => ({
    tabs: withTab(s.tabs, key),
    active: activate ? key : s.active,
  }));
  persistTabs();
};

/** Set until the windows of a new login have been opened */
let freshStart = load<string | null>('active', null, 'session') === null;

/** The next login opens the windows of the startup settings (logging in with a password, or after logging out) */
export const requestFreshStart = () => {
  freshStart = true;
  save('active', null, 'session');
};

/** The order chosen by dragging the tabs (null as long as they haven't been rearranged) */
let tabOrder = load<string[] | null>('tabOrder', null);

/** Set when the windows of the client have been loaded; saving earlier would forget the order of the missing ones */
let orderApplied = false;

const tabId = (key: string) => savedTabId(key, useApp.getState().hubs);

/** Shows a window at another position */
export const moveTab = (key: string, index: number) =>
  useApp.setState((s) => {
    const tabs = moveItem(s.tabs, key, index);
    return tabs === s.tabs ? s : { tabs };
  });

/** Keeps the current order, also after reloading the page or logging in again */
export const saveTabOrder = () => {
  tabOrder ??= [];
  orderApplied = true;
  persistTabs();
};

/** Applies the saved order once the windows have been loaded */
export const restoreTabOrder = () => {
  const saved = tabOrder;
  if (saved) {
    useApp.setState((s) => ({ tabs: orderTabs(s.tabs, saved, tabId) }));
  }

  orderApplied = true;
  persistTabs();
};

/** Called on every (re)connect, before the windows are shown */
export const startSession = (settings: StartupSettings) => {
  orderApplied = false;
  if (freshStart) {
    freshStart = false;
    history = [];
    const tabs = startupTabs(storedTabs(), settings);
    useApp.setState({ tabs, active: tabs[0] ?? '', searches: [], homeEnabled: settings.home_enabled });
    history = tabs.length ? [tabs[0]!] : [];
    save('history', history, 'session');
    persistTabs();
  } else {
    applyHomeSetting(settings.home_enabled);
  }
};

/** Adds or removes the Home window when the setting changes (here or on another device) */
export const applyHomeSetting = (enabled: boolean) => {
  const previous = useApp.getState().homeEnabled;
  useApp.setState({ homeEnabled: enabled });
  if (!enabled) {
    removeTab('home');
  } else if (!previous) {
    openTab('home', false);
  }
};

/** The window that was used before the shown one */
export const lastUsedWindow = (): string | undefined => {
  const { tabs, active } = useApp.getState();
  return [...history].reverse().find((key) => key !== active && tabs.includes(key));
};

export const activate = (key: string) => {
  useApp.setState({ active: key });
  persistTabs();
};

export const removeTab = (key: string) => {
  useApp.setState((s) => {
    const index = s.tabs.indexOf(key);
    if (index === -1) {
      return s;
    }

    const tabs = s.tabs.filter((t) => t !== key);
    history = history.filter((t) => t !== key);
    const active = s.active === key ? windowAfterClose(history, tabs, index) : s.active;
    const messages = { ...s.messages };
    delete messages[key];
    return { tabs, active, messages, searches: s.searches.filter((x) => x.key !== key) };
  });
  persistTabs();
};

const persistTabs = () => {
  const { tabs, active } = useApp.getState();
  save('tabs', tabs.filter((key) => STATIC_TABS.includes(key)));
  save('active', active, 'session');
  if (tabOrder && orderApplied) {
    tabOrder = mergeOrder(tabOrder, tabs.map(tabId));
    save('tabOrder', tabOrder);
  }
};

let toastId = 0;
export const toast = (text: string, error = false, action?: () => void) => {
  const id = ++toastId;
  useApp.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, error, action }] }));
  setTimeout(() => dismissToast(id), error ? 8000 : 4000);
};

export const dismissToast = (id: number) =>
  useApp.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

/** Reports the failure of an API request */
export const reportError = (action: string) => (error: unknown) =>
  toast(`${action}: ${error instanceof Error ? error.message : String(error)}`, true);

const MAX_MESSAGES = 1000;
const messageId = (m: MessageWrapper) => (m.chat_message ?? m.log_message)!.id;

export const appendMessage = (key: string, message: MessageWrapper) => {
  useApp.setState((s) => {
    const list = s.messages[key];
    if (!list || list.some((m) => messageId(m) === messageId(message))) {
      return s; // Not loaded yet (it will be included in the loaded history) or a duplicate
    }

    return { messages: { ...s.messages, [key]: [...list, message].slice(-MAX_MESSAGES) } };
  });
};

export const mergeHistory = (key: string, history: MessageWrapper[]) => {
  useApp.setState((s) => {
    const known = new Set(history.map(messageId));
    const newer = (s.messages[key] ?? []).filter((m) => !known.has(messageId(m)));
    return { messages: { ...s.messages, [key]: [...history, ...newer].slice(-MAX_MESSAGES) } };
  });
};
