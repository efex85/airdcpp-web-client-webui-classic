// The message area and input line of hub and private chats
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Send } from 'lucide-react';
import { copyText, userMenu } from '../actions';
import { remoteMenu } from '../actions/menus';
import type { MessageWrapper, OnlineUser } from '../api/types';
import { completeNick, messageRequests, parseCommand, type Completion } from '../lib/chat';
import { insertEmoji, type EmoticonMatcher } from '../lib/emoji';
import { Time } from './Time';
import { nickClass, toHinted } from '../lib/user';
import { useFollowBottom } from '../lib/useFollowBottom';
import { useIsMobile } from '../lib/useIsMobile';
import { reportError, toast, useApp } from '../store/app';
import { useEmoji } from '../store/emoji';
import { socket } from '../store/session';
import { openMenu, type MenuEntry, type MenuPosition } from '../store/ui';
import { EmojiPicker } from './Emoji';
import { MessageText } from './MessageText';

const HELP = [
  'Chat commands',
  '',
  '\t/clear - Clear the messages',
  '\t/help - Show the commands (extensions add their own)',
  '\t/me <message> - Send a message in third person',
].join('\n');

/** Shows the commands in the chat, only to this session */
const showHelp = (path: string) => {
  const session = useApp.getState().login?.session_id;
  return socket
    .post(`${path}/status_message`, { text: HELP, severity: 'info', type: 'private', owner: `session:${session}` })
    .catch(() => toast(HELP)); // Without the permission to add messages
};

/** Menu of a nick shown in the chat; hubSessionId adds the commands of the hub */
const nickMenu = (position: MenuPosition, user: OnlineUser, hubId: number | undefined, insert: (nick: string) => void) => {
  const items: MenuEntry[] = [
    { label: 'Mention', onClick: () => insert(user.nick) },
    { label: 'Copy nick', onClick: () => void copyText(user.nick) },
    'separator',
    ...userMenu(toHinted(user)),
  ];
  openMenu(position, items, hubId === undefined ? undefined : () => remoteMenu('hub_user', [user.id], hubId), user.nick);
};

interface NickProps {
  user: OnlineUser;
  hubId?: number;
  insert: (nick: string) => void;
  children: ReactNode;
}

const Nick = ({ user, hubId, insert, children }: NickProps) => {
  const menu = (e: MouseEvent) => {
    e.preventDefault();
    nickMenu({ x: e.clientX, y: e.clientY }, user, hubId, insert);
  };

  const mobile = useIsMobile();
  return (
    <button
      type="button"
      className={nickClass(user.flags)}
      onContextMenu={menu}
      onClick={(e) => (mobile ? menu(e) : insert(user.nick))}
    >
      {children}
    </button>
  );
};

interface LineProps {
  message: MessageWrapper;
  hubId?: number;
  insert: (nick: string) => void;
  emoji?: EmoticonMatcher;
}

const Line = memo(({ message, hubId, insert, emoji }: LineProps) => {
  const chat = message.chat_message;
  if (chat) {
    const nick = (
      <Nick user={chat.from} hubId={hubId} insert={insert}>
        {chat.from.nick}
      </Nick>
    );

    return (
      <div className={`line${chat.has_mention ? ' mentioned' : ''}`}>
        <Time value={chat.time} />
        {chat.third_person ? <>* {nick} </> : <>&lt;{nick}&gt; </>}
        <MessageText text={chat.text} highlights={chat.highlights} sender={toHinted(chat.from)} emoji={emoji} />
      </div>
    );
  }

  const status = message.log_message!;
  return (
    <div className={`line status ${status.severity}`}>
      <Time value={status.time} />*** <MessageText text={status.text} highlights={status.highlights} />
    </div>
  );
});

interface Props {
  sessionKey: string;
  /** API path of the session */
  path: string;
  messages: MessageWrapper[] | undefined;
  /** ID of the hub session; not given for private chats */
  hubId?: number;
  /** Nicks that Tab can complete */
  nicks: () => string[];
  disabled?: boolean;
  active: boolean;
}

export const ChatView = ({ sessionKey, path, messages, hubId, nicks, disabled, active }: Props) => {
  const mobile = useIsMobile();
  const [text, setText] = useState('');
  const emoji = useEmoji();
  const matcher = emoji.active?.matcher;
  // Emoji can change the height of lines
  const log = useFollowBottom<HTMLDivElement>(useMemo(() => [messages, matcher], [messages, matcher]));
  const input = useRef<HTMLTextAreaElement>(null);
  const completion = useRef<Completion['next'] | null>(null);
  const history = useRef<{ entries: string[]; index: number; draft: string }>({ entries: [], index: -1, draft: '' });
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = input.current!;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 120)}px`;
    if (caret.current !== null) {
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [text]);

  useEffect(() => {
    // Don't open the on-screen keyboard just by switching windows
    if (active && !mobile) {
      input.current?.focus({ preventScroll: true });
    }
  }, [active, mobile]);

  // Stable, so that old lines don't render again while typing
  const insert = useRef((nick: string) => {
    setText((old) => (old ? `${old.replace(/\s?$/, ' ')}${nick} ` : `${nick}: `));
    input.current?.focus();
  }).current;

  const send = async () => {
    const value = text.replace(/\s+$/, '');
    if (!value || disabled) {
      return;
    }

    const entries = history.current.entries;
    if (entries[entries.length - 1] !== value) {
      entries.push(value);
      entries.splice(0, entries.length - 50);
    }

    history.current.index = -1;
    setText('');
    log.follow();

    const command = parseCommand(value);
    if (command.type === 'help') {
      // Before the extensions answer
      await showHelp(path);
    } else if (command.type === 'clear') {
      await socket.delete(`${path}/messages`).then(
        () => useApp.setState((s) => ({ messages: { ...s.messages, [sessionKey]: [] } })),
        reportError('Clear'),
      );
    }

    try {
      for (const request of messageRequests(value)) {
        await socket.post(`${path}/chat_message`, request);
      }
    } catch (e) {
      setText((current) => current || value); // Keep what was written
      reportError('Message not sent')(e);
    }
  };

  const addEmoji = (code: string) => {
    const el = input.current!;
    const result = insertEmoji(text, code, el.selectionStart, el.selectionEnd);
    completion.current = null;
    setText(result.text);
    // Not on phones: the on-screen keyboard would open
    if (!mobile) {
      caret.current = result.caret;
      el.focus({ preventScroll: true });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key !== 'Tab' && e.key !== 'Shift') {
      completion.current = null;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey) {
      const result = completeNick(text, el.selectionStart, nicks(), completion.current);
      if (result) {
        e.preventDefault();
        completion.current = result.next;
        caret.current = result.caret;
        setText(result.text);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Previously sent messages, when the caret can't move further
      const state = history.current;
      const up = e.key === 'ArrowUp';
      const atEdge = up ? !text.slice(0, el.selectionStart).includes('\n') : !text.slice(el.selectionEnd).includes('\n');
      if (!atEdge || (up && !state.entries.length) || (!up && state.index === -1)) {
        return;
      }

      e.preventDefault();
      if (state.index === -1) {
        state.draft = text;
        state.index = state.entries.length - 1;
      } else {
        state.index += up ? -1 : 1;
      }

      if (state.index >= state.entries.length) {
        state.index = -1;
        setText(state.draft);
      } else {
        state.index = Math.max(0, state.index);
        setText(state.entries[state.index]);
      }
    }
  };

  return (
    <div className="chat">
      <div
        ref={log.ref}
        className="chat-log selectable"
        role="log"
        aria-live={active ? 'polite' : 'off'}
        onScroll={log.onScroll}
      >
        {!messages?.length && <div className="line status">No messages</div>}
        {messages?.map((m) => (
          <Line
            key={(m.chat_message ?? m.log_message)!.id}
            message={m}
            hubId={hubId}
            insert={insert}
            emoji={matcher}
          />
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={input}
          rows={1}
          value={text}
          aria-label="Message"
          disabled={disabled}
          enterKeyHint="send"
          onChange={(e) => {
            completion.current = null;
            setText(e.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {emoji.enabled && (
          <EmojiPicker active={emoji.active} disabled={disabled} shown={active} onPick={addEmoji} />
        )}
        <button type="submit" disabled={disabled || !text.trim()} aria-label="Send" title="Send">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
