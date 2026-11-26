import { EllipsisVertical, Folder, Lock, LockOpen } from 'lucide-react';
import { browseUser, closeWindow, userMenu } from '../actions';
import { ChatView } from '../components/ChatView';
import { useApp } from '../store/app';
import { openMenu } from '../store/ui';
import { useMarkRead, useMessages } from '../store/useSession';

export const PrivateChat = ({ id, active }: { id: string; active: boolean }) => {
  const chat = useApp((s) => s.chats.find((c) => c.id === id));
  const path = `private_chat/${id}`;
  const messages = useMessages(`pm:${id}`, path);
  useMarkRead(active, chat?.message_counts, `${path}/messages/read`, true);

  if (!chat) {
    return <div className="view-empty">The chat has been closed</div>;
  }

  const offline = chat.user.flags.includes('offline');
  const encryption = chat.ccpm_state.encryption;
  return (
    <div className="view">
      <ChatView
        sessionKey={`pm:${id}`}
        path={path}
        messages={messages}
        nicks={() => [chat.user.nicks]}
        active={active}
      />
      <div className="view-status">
        <span className="grow">
          {offline ? 'The user is offline' : `${chat.user.nicks} (${chat.user.hub_names ?? chat.user.hub_url})`}
        </span>
        <span title={encryption?.str ?? 'Messages are sent via the hub'}>
          {encryption ? <Lock size={12} className="i-ok" /> : <LockOpen size={12} />}{' '}
          {chat.ccpm_state.id === 'connected' ? 'Direct encrypted connection' : 'Via hub'}
        </span>
        <button type="button" disabled={offline} onClick={() => void browseUser(chat.user)}>
          <Folder size={12} /> File list
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="User actions"
          onClick={(e) =>
            openMenu({ x: e.clientX, y: e.clientY }, [
              ...userMenu(chat.user),
              'separator',
              { label: 'Close', onClick: () => void closeWindow(`pm:${id}`) },
            ])
          }
        >
          <EllipsisVertical size={14} />
        </button>
      </div>
    </div>
  );
};
