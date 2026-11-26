// Which events are announced, following the notification settings of the client
import type { ChatMessage, LogMessage, QueueBundle } from '../api/types';
import type { LocalSettings } from '../store/localSettings';

export type Level = 'info' | 'warning' | 'error';

export const hubMessageNotifies = (message: ChatMessage, settings: LocalSettings, hubNotifications: boolean): boolean =>
  (message.has_mention && settings.notify_mention_my_nick) || (settings.notify_hub_message && hubNotifications);

export const privateMessageNotifies = (message: ChatMessage, settings: LocalSettings): boolean => {
  if (message.has_mention && settings.notify_mention_my_nick) {
    return true;
  }

  return message.reply_to?.flags.includes('bot') ? settings.notify_pm_bot : settings.notify_pm_user;
};

/** Messages of the "notify" severity are always shown */
export const eventLevel = (message: LogMessage, settings: LocalSettings): Level | null => {
  switch (message.severity) {
    case 'notify':
      return 'info';
    case 'info':
      return settings.notify_events_info ? 'info' : null;
    case 'warning':
      return settings.notify_events_warning ? 'warning' : null;
    case 'error':
      return settings.notify_events_error ? 'error' : null;
    default:
      return null;
  }
};

export const bundleNotification = (bundle: QueueBundle): { level: Level; text: string } | null => {
  const { id, str, hook_error } = bundle.status;
  switch (id) {
    case 'queued':
      return { level: 'info', text: 'Added in the queue' };
    case 'download_error':
      return { level: 'error', text: `Download error: ${str}` };
    case 'completion_validation_running':
      return { level: 'info', text: 'Validating the downloaded content' };
    case 'completion_validation_error':
      return {
        level: 'error',
        text: `Content validation failed: ${hook_error?.str ?? str}${hook_error ? ` (${hook_error.hook_name})` : ''}`,
      };
    case 'completed':
      return { level: 'info', text: 'Download completed' };
    case 'shared':
      return { level: 'info', text: 'Added in the share' };
    default:
      return null;
  }
};

/** Allows a number of actions in each time window */
export const createRateLimiter = (count: number, windowMs: number) => {
  let times: number[] = [];
  return (now: number): boolean => {
    times = times.filter((t) => now - t < windowMs);
    if (times.length >= count) {
      return false;
    }

    times.push(now);
    return true;
  };
};
