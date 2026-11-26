// Message history and read state of a chat session
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageCounts, MessageWrapper } from '../api/types';
import { mergeHistory, reportError, useApp } from './app';
import { socket } from './session';
import { useLocalSettings } from './localSettings';

const HISTORY = 500;

export const useMessages = (key: string, path: string): MessageWrapper[] | undefined => {
  const generation = useApp((s) => s.generation);
  const connected = useApp((s) => s.connection === 'connected');

  useEffect(() => {
    if (!connected) {
      return;
    }

    // From now on new messages are appended; older ones are merged in when they arrive
    mergeHistory(key, []);
    socket
      .get<MessageWrapper[]>(`${path}/messages/${HISTORY}`)
      .then((history) => mergeHistory(key, history), reportError('Failed to load the messages'));
  }, [key, path, generation, connected]);

  return useApp((s) => s.messages[key]);
};

export const unreadCount = (counts: MessageCounts | null | undefined): number =>
  counts ? Object.values(counts.unread).reduce((sum: number, n) => sum + (n ?? 0), 0) : 0;

const useDocumentVisible = () => {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
};

/**
 * Marks the messages as read while the window is shown. In chats this can be delayed with a
 * setting, so that the new messages stay marked for a moment.
 */
export const useMarkRead = (
  active: boolean,
  counts: MessageCounts | null | undefined,
  path: string,
  chat = false,
) => {
  const visible = useDocumentVisible();
  const unread = unreadCount(counts);
  const delay = useLocalSettings((s) => (chat ? s.unread_label_delay : 0));
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => {
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }

    socket.post(path).catch(() => undefined); // May not be allowed for this user
  }, [path]);

  useEffect(() => {
    if (!active || !visible || unread === 0) {
      return;
    }

    if (delay <= 0) {
      markRead();
    } else if (pending.current === null) {
      // The timer is not restarted by further messages
      pending.current = setTimeout(markRead, delay * 1000);
    }
  }, [active, visible, unread, delay, markRead]);

  // Messages that wait to be marked are marked when the window is left
  useEffect(() => {
    if (!active) {
      return;
    }

    return () => {
      if (pending.current !== null) {
        markRead();
      }
    };
  }, [active, markRead]);
};
