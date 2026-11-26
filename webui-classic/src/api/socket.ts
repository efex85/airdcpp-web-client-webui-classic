// Minimal client for the AirDC++ Web API websocket (wire protocol of airdcpp-apisocket):
//   request  {method, path, data, callback_id}
//   response {callback_id, code, data} | {callback_id, code, error}
//   event    {event, data, id?}

import type { LoginResponse } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    /** The request field that was rejected (validation errors) */
    readonly field?: string,
  ) {
    super(message);
  }
}

export type EventHandler = (data: any, entityId: any) => void;

interface Pending {
  resolve: (data: any) => void;
  reject: (error: ApiError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export type Credentials =
  | { grant_type: 'password'; username: string; password: string }
  | { grant_type: 'refresh_token'; refresh_token: string }
  | { auth_token: string };

const REQUEST_TIMEOUT_MS = 60_000;

export class ApiSocket {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private handlers = new Map<string, Set<EventHandler>>();
  private subscribed = new Map<string, Promise<unknown>>();

  /** Called when an authenticated connection is lost (not by close()) */
  onClose: (() => void) | null = null;

  constructor(readonly url: string) {}

  /** Opens a new websocket and authenticates it */
  connect(credentials: Credentials): Promise<LoginResponse> {
    this.close();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let authenticated = false;
      this.ws = ws;

      ws.onopen = () => {
        const path = 'auth_token' in credentials ? 'sessions/socket' : 'sessions/authorize';
        this.request<LoginResponse>('POST', path, credentials).then(
          (response) => {
            authenticated = true;
            resolve(response);
          },
          (error) => {
            reject(error);
            this.close();
          },
        );
      };

      ws.onmessage = (event) => this.handleMessage(String(event.data));

      ws.onclose = () => {
        if (this.ws !== ws) {
          return;
        }

        this.ws = null;
        this.reset();
        if (authenticated) {
          this.onClose?.();
        } else {
          reject(new ApiError('Cannot connect to the server', 0));
        }
      };
    });
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    this.reset();
    ws?.close(1000);
  }

  private reset() {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new ApiError('Disconnected', 0));
    }

    this.pending.clear();
    this.handlers.clear();
    this.subscribed.clear();
  }

  private handleMessage(raw: string) {
    const message = JSON.parse(raw);
    if (message.callback_id !== undefined) {
      const p = this.pending.get(message.callback_id);
      if (!p) {
        return;
      }

      this.pending.delete(message.callback_id);
      clearTimeout(p.timer);
      if (message.code >= 200 && message.code <= 204) {
        p.resolve(message.data);
      } else {
        p.reject(new ApiError(formatError(message), message.code, message.error?.field));
      }
    } else if (message.event) {
      for (const handler of this.handlers.get(message.event) ?? []) {
        try {
          handler(message.data, message.id);
        } catch (e) {
          console.error('Event handler failed', message.event, e);
        }
      }
    }
  }

  private request<T>(method: string, path: string, data?: unknown): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new ApiError('Not connected', 0));
    }

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new ApiError(`Request timed out: ${path}`, 0));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ method, path, data, callback_id: id }));
    });
  }

  get<T = any>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T = any>(path: string, data?: unknown) {
    return this.request<T>('POST', path, data);
  }

  patch<T = any>(path: string, data?: unknown) {
    return this.request<T>('PATCH', path, data);
  }

  delete<T = any>(path: string) {
    return this.request<T>('DELETE', path);
  }

  /**
   * Listens to an API event. With an entity ID only the events of that session are delivered.
   * Returns a function that removes the listener.
   */
  async listen(module: string, event: string, handler: EventHandler, entityId?: string | number): Promise<() => void> {
    const path =
      entityId === undefined ? `${module}/listeners/${event}` : `${module}/${entityId}/listeners/${event}`;

    const filtered: EventHandler =
      entityId === undefined
        ? handler
        : (data, id) => {
            if (String(id) === String(entityId)) {
              handler(data, id);
            }
          };

    let set = this.handlers.get(event);
    if (!set) {
      this.handlers.set(event, (set = new Set()));
    }

    set.add(filtered);

    let subscription = this.subscribed.get(path);
    if (!subscription) {
      subscription = this.post(path);
      this.subscribed.set(path, subscription);
    }

    const remove = () => {
      this.handlers.get(event)?.delete(filtered);
    };

    try {
      await subscription;
    } catch (e) {
      remove();
      this.subscribed.delete(path);
      throw e;
    }

    return remove;
  }

  /** Removes the server-side subscriptions of a session that is no longer shown */
  async unlisten(module: string, events: string[], entityId: string | number): Promise<void> {
    await Promise.all(
      events.map(async (event) => {
        const path = `${module}/${entityId}/listeners/${event}`;
        if (this.subscribed.delete(path)) {
          await this.delete(path).catch(() => undefined); // The session may be gone already
        }
      }),
    );
  }
}

const formatError = (message: any): string => {
  const error = message.error;
  if (!error) {
    return `Request failed (${message.code})`;
  }

  return error.field ? `${error.field}: ${error.message}` : String(error.message ?? `Request failed (${message.code})`);
};

/** The folder of the page, so that a reverse proxy subpath works */
export const getBasePath = (pathname: string): string => pathname.replace(/[^/]*$/, '');

export const getSocketUrl = (location: Pick<Location, 'protocol' | 'host' | 'pathname'>): string =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${getBasePath(location.pathname)}api/v1/`;
