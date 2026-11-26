// Connection handling and the data that is kept up to date while connected

import { ApiError, ApiSocket, getSocketUrl, type Credentials } from '../api/socket';
import type {
  FavoriteHub,
  FilelistSession,
  HubSession,
  LoginResponse,
  LogMessage,
  OnlineUser,
  PrivateChatSession,
  QueueBundle,
  Transfer,
  ViewFile,
} from '../api/types';
import { load, save } from '../lib/storage';
import { loadFavoriteDirectories } from '../actions/download';
import {
  appendMessage,
  applyHomeSetting,
  mergeHistory,
  openTab,
  removeTab,
  reportError,
  requestFreshStart,
  restoreTabOrder,
  startSession,
  toast,
  useApp,
  windowType,
} from './app';
import {
  browserCache,
  colorsDoc,
  connectDocs,
  disconnectDocs,
  flushDocs,
  isConnected,
  remoteChange,
  startupDoc,
  syncAll,
} from './docs';
import { showUserColors } from './theme';
import { LiveList } from './live';
import { syncNotifications } from './notifications';
import { requestPermission } from '../lib/browserNotification';

export const socket = new ApiSocket(getSocketUrl(window.location));

export const transfers = new LiveList<Transfer>(250);
export const bundles = new LiveList<QueueBundle>(250);
export const favorites = new LiveList<FavoriteHub>();

/** User lists of the hubs that have been opened */
const hubUsers = new Map<number, LiveList<OnlineUser>>();

const ALL = 100000;
let rememberLogin = false;
let timers: ReturnType<typeof setInterval>[] = [];
let attempt = 0;

const upsert = <T extends { id: number | string }>(list: T[], item: Partial<T> & { id: number | string }): T[] => {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) {
    return [...list, item as T];
  }

  const next = list.slice();
  next[index] = { ...next[index], ...item };
  return next;
};

type SessionKey = 'hubs' | 'chats' | 'filelists' | 'files';

const syncSessions = async <T extends HubSession | PrivateChatSession | FilelistSession | ViewFile>(
  module: string,
  prefix: string,
  stateKey: SessionKey,
  name: string,
) => {
  // Note that the module names don't follow a common pattern: hubs, private_chat, filelists, view_files
  const set = (fn: (list: T[]) => T[]) =>
    useApp.setState((s) => ({ [stateKey]: fn(s[stateKey] as unknown as T[]) }) as any);

  await Promise.all([
    socket.listen(module, `${name}_created`, (data: T) => {
      set((list) => upsert(list, data));
      // Windows opened by others (incoming messages etc.) don't steal the focus
      openTab(`${prefix}:${data.id}`, false);
    }),
    socket.listen(module, `${name}_removed`, (data: { id: number | string }) => {
      set((list) => list.filter((x) => x.id !== data.id));
      if (prefix === 'hub') {
        releaseHubUsers(data.id as number);
      }

      removeTab(`${prefix}:${data.id}`);
    }),
    socket.listen(module, `${name}_updated`, (data: Partial<T>, id) => {
      // Session updates don't contain the ID, it's delivered with the event (except for viewed files)
      const target = String(id ?? data.id);
      set((list) => list.map((x) => (String(x.id) === target ? { ...x, ...data } : x)));
    }),
  ]);

  // The session modules return their open sessions
  const sessions = await socket.get<T[]>(module);
  set(() => sessions);
  useApp.setState((s) => {
    const keys = sessions.map((x) => `${prefix}:${x.id}`);
    const kept = s.tabs.filter((t) => windowType(t) !== prefix || keys.includes(t));
    return { tabs: [...kept, ...keys.filter((k) => !kept.includes(k))] };
  });
};

const syncMessages = (module: string, prefix: string, name: string) =>
  Promise.all([
    socket.listen(module, `${name}_message`, (data, id) => appendMessage(`${prefix}:${id}`, { chat_message: data })),
    socket.listen(module, `${name}_status`, (data, id) => appendMessage(`${prefix}:${id}`, { log_message: data })),
  ]);

const syncLiveList = async <T extends { id: number | string }>(
  list: LiveList<T>,
  module: string,
  events: { added: string; updated: string; removed: string },
  fetchPath: string,
) => {
  list.clear();
  await Promise.all([
    socket.listen(module, events.added, list.add),
    socket.listen(module, events.updated, list.update),
    socket.listen(module, events.removed, (data: T) => list.remove(data.id)),
  ]);
  await list.load(() => socket.get<T[]>(fetchPath));
};

const syncEvents = async () => {
  mergeHistory('syslog', []); // Messages arriving during loading are appended
  await Promise.all([
    socket.listen('events', 'event_message', (data: LogMessage) => {
      useApp.setState({ lastEvent: data });
      appendMessage('syslog', { log_message: data });
    }),
    socket.listen('events', 'event_counts', (logCounts) => useApp.setState({ logCounts })),
  ]);

  const [messages, counts] = await Promise.all([
    socket.get<LogMessage[]>('events/500'),
    socket.get('events/counts'),
  ]);
  mergeHistory(
    'syslog',
    messages.map((m) => ({ log_message: m })),
  );
  useApp.setState({ logCounts: counts, lastEvent: messages[messages.length - 1] ?? null });
};

const syncStats = async () => {
  await Promise.all([
    socket.listen('transfers', 'transfer_statistics', (data) =>
      useApp.setState((s) => ({ stats: { ...s.stats, ...data } })),
    ),
    socket.listen('system', 'away_state', (data) => useApp.setState({ away: data.id !== 'off' })),
  ]);

  const refresh = () => {
    socket.get('hubs/stats').then((hubStats) => useApp.setState({ hubStats: hubStats ?? null }), () => undefined);
    socket
      .get('share/stats')
      .then((stats) => useApp.setState({ shareSize: stats?.total_size ?? null }), () => undefined);
  };

  refresh();
  timers.push(setInterval(refresh, 60_000));

  socket.get('transfers/stats').then((stats) => useApp.setState({ stats }), () => undefined);
  socket.get('system/away').then((data) => useApp.setState({ away: data.id !== 'off' }), () => undefined);
};

// Keeps the session alive and lets the client know whether someone is there (auto away)
let lastInput = Date.now();
for (const event of ['keydown', 'pointerdown', 'pointermove', 'touchstart']) {
  window.addEventListener(event, () => (lastInput = Date.now()), { passive: true });
}

/** Longest time that logging in or out waits for the synced settings */
const SYNC_WAIT = 4000;
const patience = (operation: Promise<unknown>) =>
  Promise.race([operation, new Promise((resolve) => setTimeout(resolve, SYNC_WAIT))]);

/** The synced data of the user; the copy of the browser is used until the client has answered */
const connectUserData = (login: LoginResponse) => {
  if (isConnected()) {
    return;
  }

  connectDocs(
    {
      transport: {
        get: (key) => socket.get(`system/user_data/${key}`),
        post: (key, value, revision) => socket.post(`system/user_data/${key}`, { value, revision }),
        remove: (key) => socket.delete(`system/user_data/${key}`),
      },
      cache: browserCache(`${login.system_info.cid}.${login.user.username}`),
    },
    reportError('Saving to the client failed'),
  );
};

const syncUserDataEvents = () =>
  socket
    .listen('system', 'user_data_updated', (data) => void remoteChange(data.key, data.revision))
    // A client without the patch doesn't have the event
    .catch(() => undefined);

startupDoc.subscribe(() => {
  if (isConnected() && useApp.getState().connection === 'connected') {
    applyHomeSetting(startupDoc.value.home_enabled);
  }
});

// Changes are saved when the page is left, and fetched again when it's shown
document.addEventListener('visibilitychange', () => {
  if (useApp.getState().connection === 'connected') {
    void (document.hidden ? flushDocs() : syncAll());
  }
});
window.addEventListener('pagehide', () => void flushDocs());

const isUserActive = () => document.hasFocus() && Date.now() - lastInput < 60_000;

const initialSync = async () => {
  useApp.setState((s) => ({ messages: {}, generation: s.generation + 1 }));
  hubUsers.clear();
  hubUserCleanup.clear();

  // A user may lack permissions for some of these; the rest should still work
  const windows = Promise.allSettled([
    syncSessions<HubSession>('hubs', 'hub', 'hubs', 'hub'),
    syncSessions<PrivateChatSession>('private_chat', 'pm', 'chats', 'private_chat'),
    syncSessions<FilelistSession>('filelists', 'filelist', 'filelists', 'filelist'),
    syncSessions<ViewFile>('view_files', 'file', 'files', 'view_file'),
  ]).then((loaded) => {
    // Not after a failure (such as a lost connection), as some windows would be missing
    if (loaded.every((r) => r.status === 'fulfilled' || r.reason?.code === 403)) {
      restoreTabOrder();
    }

    return loaded;
  });
  const others = Promise.allSettled([
    syncMessages('hubs', 'hub', 'hub'),
    syncMessages('private_chat', 'pm', 'private_chat'),
    syncLiveList(
      transfers,
      'transfers',
      { added: 'transfer_added', updated: 'transfer_updated', removed: 'transfer_removed' },
      'transfers',
    ),
    syncLiveList(
      bundles,
      'queue',
      { added: 'queue_bundle_added', updated: 'queue_bundle_updated', removed: 'queue_bundle_removed' },
      `queue/bundles/0/${ALL}`,
    ),
    syncLiveList(
      favorites,
      'favorite_hubs',
      { added: 'favorite_hub_created', updated: 'favorite_hub_updated', removed: 'favorite_hub_removed' },
      `favorite_hubs/0/${ALL}`,
    ),
    syncEvents(),
    syncStats(),
    syncNotifications(socket, isUserActive),
    loadFavoriteDirectories(),
  ]);
  const results = (await Promise.all([windows, others])).flat();
  void syncUserDataEvents().then(syncAll);

  for (const result of results) {
    if (result.status === 'rejected' && result.reason?.code !== 403) {
      console.error(result.reason);
      toast(`Loading failed: ${result.reason?.message}`, true);
    }
  }

  useApp.setState((s) => ({ active: s.tabs.includes(s.active) ? s.active : (s.tabs[0] ?? '') }));
};

const startTimers = () => {
  timers.push(
    setInterval(() => {
      socket
        .post('sessions/activity', { user_active: Date.now() - lastInput < 60_000 })
        .catch(() => undefined);
    }, 50_000),
  );
};

const stopTimers = () => {
  timers.forEach(clearInterval);
  timers = [];
};

const onAuthenticated = async (response: LoginResponse) => {
  // Each refresh token can be used once and a new one is issued on every login.
  // Reconnecting with the session token doesn't return one: keep the stored token then.
  if (!rememberLogin) {
    save('refresh', null);
  } else if (response.refresh_token) {
    save('refresh', response.refresh_token);
  }

  save('auth', response.auth_token, 'session');

  // The startup windows and colors are needed before the windows are shown
  const current = attempt;
  const login = { ...useApp.getState().login, ...response } as LoginResponse;
  connectUserData(login);
  await patience(Promise.all([startupDoc.sync(), colorsDoc.sync()]));
  if (current !== attempt) {
    return;
  }

  showUserColors();
  startSession(startupDoc.value);
  useApp.setState({ connection: 'connected', login, loginError: null });
  startTimers();
  void requestPermission().catch(() => undefined);
  await initialSync();
};

const showLogin = (error: string | null) => {
  stopTimers();
  save('auth', null, 'session');
  useApp.setState({ connection: 'login', loginError: error, login: null });
  disconnectDocs();
};

export const login = async (username: string, password: string, remember: boolean) => {
  attempt++;
  rememberLogin = remember;
  save('remember', remember);
  requestFreshStart();
  useApp.setState({ connection: 'connecting', loginError: null });
  try {
    await onAuthenticated(await socket.connect({ grant_type: 'password', username, password }));
  } catch (e) {
    showLogin((e as Error).message);
  }
};

/** Continues a previous session or logs in with a saved token */
export const resume = async () => {
  const auth = load<string | null>('auth', null, 'session');
  const refresh = load<string | null>('refresh', null);
  rememberLogin = load('remember', false);
  if (!auth && !refresh) {
    return;
  }

  useApp.setState({ connection: 'connecting' });
  await reconnect(++attempt);
};

const reconnect = async (current: number) => {
  while (current === attempt) {
    const auth = load<string | null>('auth', null, 'session');
    const refresh = load<string | null>('refresh', null);
    const credentials: Credentials | null = auth
      ? { auth_token: auth }
      : refresh
        ? { grant_type: 'refresh_token', refresh_token: refresh }
        : null;

    if (!credentials) {
      showLogin('The session has expired, please log in again');
      return;
    }

    try {
      const response = await socket.connect(credentials);
      await onAuthenticated(response);
      return;
    } catch (e) {
      const code = (e as ApiError).code;
      if (code === 400 || code === 401) {
        // The session or token is not valid anymore, try the next option
        save(auth ? 'auth' : 'refresh', null, auth ? 'session' : 'local');
      } else {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
};

socket.onClose = () => {
  stopTimers();
  useApp.setState({ connection: 'reconnecting' });
  void reconnect(++attempt);
};

export const logout = async () => {
  if (useApp.getState().connection === 'connected') {
    await patience(flushDocs());
  }

  attempt++;
  await socket.delete('sessions/self').catch(() => undefined);
  socket.close();
  save('refresh', null);
  requestFreshStart();
  showLogin(null);
};

const HUB_USER_EVENTS = ['hub_user_connected', 'hub_user_updated', 'hub_user_disconnected'];

/** Removes the local listeners of a hub user list */
const hubUserCleanup = new Map<number, () => void>();

export const getHubUsers = (hubId: number): LiveList<OnlineUser> => {
  let list = hubUsers.get(hubId);
  if (list) {
    return list;
  }

  list = new LiveList<OnlineUser>(300);
  hubUsers.set(hubId, list);
  const users = list;
  const loadUsers = () => users.load(() => socket.get<OnlineUser[]>(`hubs/${hubId}/users/0/${ALL}`));

  const listeners = [
    socket.listen('hubs', 'hub_user_connected', users.add, hubId),
    socket.listen('hubs', 'hub_user_updated', users.add, hubId),
    socket.listen('hubs', 'hub_user_disconnected', (u: OnlineUser) => users.remove(u.id), hubId),
    // Users are not reported one by one when the hub connection is lost
    socket.listen(
      'hubs',
      'hub_updated',
      (data) => {
        const state = data.connect_state?.id;
        if (state && state !== 'connected') {
          users.clear();
        }
      },
      hubId,
    ),
  ];

  hubUserCleanup.set(hubId, () => {
    for (const listener of listeners) {
      listener.then(
        (remove) => remove(),
        () => undefined,
      );
    }
  });

  Promise.all(listeners)
    .then(loadUsers)
    .catch((e) => {
      releaseHubUsers(hubId);
      toast(`Failed to load the user list: ${e.message}`, true);
    });

  return list;
};

export const releaseHubUsers = (hubId: number) => {
  hubUserCleanup.get(hubId)?.();
  hubUserCleanup.delete(hubId);
  if (hubUsers.delete(hubId)) {
    void socket.unlisten('hubs', HUB_USER_EVENTS, hubId);
  }
};
