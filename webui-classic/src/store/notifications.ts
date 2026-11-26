// Announces new messages and status changes
import type { ChatMessage, LogMessage, QueueBundle } from '../api/types';
import type { ApiSocket } from '../api/socket';
import { showNative } from '../lib/browserNotification';
import {
  bundleNotification,
  createRateLimiter,
  eventLevel,
  hubMessageNotifies,
  privateMessageNotifies,
  type Level,
} from '../lib/notificationRules';
import { activate, openTab, toast, useApp } from './app';
import { useLocalSettings } from './localSettings';

const allow = createRateLimiter(3, 3000);
const MAX_TEXT = 400;

const notify = (level: Level, title: string, text: string, tag: string | undefined, windowKey: string | null) => {
  // Many notifications at once would flood the screen; errors are always shown
  if (!allow(Date.now()) && level !== 'error') {
    return;
  }

  const body = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
  const open = windowKey
    ? () => {
        openTab(windowKey);
        activate(windowKey);
      }
    : undefined;

  // The browser shows it when the page is in the background; otherwise it's shown on the page
  if (!document.hasFocus() && showNative(title, body, tag, open)) {
    return;
  }

  toast(`${title}: ${body}`, level === 'error', open);
};

const SEVERITY_TITLES: Record<string, string> = {
  notify: 'Information',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
};

/** isActive tells whether someone is using this page right now */
export const syncNotifications = (socket: ApiSocket, isActive: () => boolean) => {
  /** Is the user looking at the window? */
  const watching = (windowKey: string) => useApp.getState().active === windowKey && isActive();

  const listeners = [
    socket.listen('hubs', 'hub_message', (message: ChatMessage) => {
      const hubId = message.from.hub_session_id;
      const hub = useApp.getState().hubs.find((h) => h.id === hubId);
      if (
        !message.is_read &&
        !watching(`hub:${hubId}`) &&
        hubMessageNotifies(message, useLocalSettings.getState(), !!hub?.settings?.use_main_chat_notify)
      ) {
        notify('info', message.from.nick, message.text, undefined, `hub:${hubId}`);
      }
    }),
    socket.listen('private_chat', 'private_chat_message', (message: ChatMessage) => {
      const cid = message.reply_to?.cid;
      if (
        cid &&
        !message.is_read &&
        !watching(`pm:${cid}`) &&
        privateMessageNotifies(message, useLocalSettings.getState())
      ) {
        notify('info', message.from.nick, message.text, cid, `pm:${cid}`);
      }
    }),
    socket.listen('events', 'event_message', (message: LogMessage) => {
      if (message.is_read || (message.severity !== 'notify' && watching('syslog'))) {
        return;
      }

      const level = eventLevel(message, useLocalSettings.getState());
      if (level) {
        notify(
          level,
          SEVERITY_TITLES[message.severity],
          message.text,
          undefined,
          message.severity === 'notify' ? null : 'syslog',
        );
      }
    }),
    ...['queue_bundle_added', 'queue_bundle_status'].map((event) =>
      socket.listen('queue', event, (bundle: QueueBundle) => {
        const status = useLocalSettings.getState().notify_bundle_status && bundleNotification(bundle);
        if (status) {
          notify(status.level, bundle.name, status.text, `queue_bundle_${bundle.id}`, 'queue');
        }
      }),
    ),
  ];

  return Promise.all(listeners);
};
