import { Lock, LockOpen, Menu as MenuIcon, ShieldAlert } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { hubMenu, reconnectHub } from '../actions';
import type { HubSession, OnlineUser } from '../api/types';
import { ChatView } from '../components/ChatView';
import { Splitter } from '../components/Splitter';
import { formatSize } from '../lib/format';
import { load, save } from '../lib/storage';
import { useIsMobile } from '../lib/useIsMobile';
import { reportError, useApp } from '../store/app';
import type { LiveList } from '../store/live';
import { getHubUsers, socket } from '../store/session';
import { openMenu } from '../store/ui';
import { useMarkRead, useMessages } from '../store/useSession';
import { UserList } from './UserList';

const NO_USERS: OnlineUser[] = [];
const noSubscription = () => () => undefined;

const useHubUsers = (hubId: number): OnlineUser[] => {
  const generation = useApp((s) => s.generation);
  const connected = useApp((s) => s.connection === 'connected');
  const list: LiveList<OnlineUser> | null = useMemo(
    () => (connected ? getHubUsers(hubId) : null),
    [hubId, generation, connected],
  );
  return useSyncExternalStore(list?.subscribe ?? noSubscription, list?.getSnapshot ?? (() => NO_USERS));
};

/** Actions needed to get connected */
const ConnectBar = ({ hub }: { hub: HubSession }) => {
  const [password, setPassword] = useState('');
  const { id, str, data } = hub.connect_state;

  if (id === 'password') {
    return (
      <form
        className="hub-bar"
        onSubmit={(e) => {
          e.preventDefault();
          socket.post(`hubs/${hub.id}/password`, { password }).then(() => setPassword(''), reportError('Password'));
        }}
      >
        <span>The hub requires a password</span>
        <input
          type="password"
          aria-label="Hub password"
          autoComplete="off"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Send password</button>
      </form>
    );
  }

  if (id === 'redirect') {
    return (
      <div className="hub-bar">
        <span className="grow">The hub redirects to {data?.hub_url}</span>
        <button type="button" onClick={() => socket.post(`hubs/${hub.id}/redirect`).catch(reportError('Redirect'))}>
          Follow redirect
        </button>
      </div>
    );
  }

  if (id === 'disconnected' || id === 'keyprint_mismatch') {
    return (
      <div className={`hub-bar${id === 'keyprint_mismatch' ? ' error' : ''}`}>
        {id === 'keyprint_mismatch' && <ShieldAlert size={14} />}
        <span className="grow">{str}</span>
        <button type="button" onClick={() => void reconnectHub(hub.id)}>
          Reconnect
        </button>
      </div>
    );
  }

  return null;
};

export const Hub = ({ id, active }: { id: number; active: boolean }) => {
  const hub = useApp((s) => s.hubs.find((h) => h.id === id));
  const mobile = useIsMobile();
  const path = `hubs/${id}`;
  const messages = useMessages(`hub:${id}`, path);
  const users = useHubUsers(id);
  const [showUsers, setShowUsers] = useState(() => load('showUsers', true));
  const [pane, setPane] = useState<'chat' | 'users'>('chat');
  useMarkRead(active && (!mobile || pane === 'chat'), hub?.message_counts, `${path}/messages/read`, true);

  const totals = useMemo(() => {
    const visible = users.filter((u) => !u.flags.includes('hidden'));
    return { count: visible.length, share: visible.reduce((sum, u) => sum + Math.max(0, u.share_size), 0) };
  }, [users]);

  if (!hub) {
    return <div className="view-empty">The hub has been closed</div>;
  }

  const chat = (
    <ChatView
      sessionKey={`hub:${id}`}
      path={path}
      messages={messages}
      hubId={id}
      nicks={() => users.map((u) => u.nick)}
      disabled={hub.connect_state.id !== 'connected'}
      active={active && (!mobile || pane === 'chat')}
    />
  );
  const userList = <UserList hubId={id} users={users} />;

  return (
    <div className="view">
      <ConnectBar hub={hub} />
      {mobile ? (
        <>
          <div className="segmented" role="tablist">
            {(['chat', 'users'] as const).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => setPane(p)}>
                {p === 'chat' ? 'Chat' : `Users (${totals.count})`}
              </button>
            ))}
          </div>
          <div className="view-main">
            <div className={`pane${pane === 'chat' ? '' : ' hidden'}`}>{chat}</div>
            <div className={`pane${pane === 'users' ? '' : ' hidden'}`}>{userList}</div>
          </div>
        </>
      ) : (
        <div className="view-main">
          <Splitter id="users" direction="row" initial={600} min={180} first={chat} second={showUsers ? userList : null} />
        </div>
      )}
      <div className="view-status">
        <span className="grow">{hub.connect_state.str || hub.hub_url}</span>
        {hub.encryption ? (
          <span title={hub.encryption.str + (hub.encryption.trusted ? '' : ' (untrusted certificate)')}>
            <Lock size={12} className={hub.encryption.trusted ? 'i-ok' : 'i-warn'} />
          </span>
        ) : (
          <span title="Not encrypted">
            <LockOpen size={12} />
          </span>
        )}
        <span>{totals.count} users</span>
        <span className="wide">{formatSize(totals.share)}</span>
        {totals.count > 0 && <span className="wide">{formatSize(totals.share / totals.count)}/user</span>}
        <button type="button" className="icon-button" aria-label="Hub menu" title="Hub menu" onClick={(e) => {
          const { entries, more } = hubMenu(hub);
          openMenu({ x: e.clientX, y: e.clientY }, entries, more, hub.identity.name);
        }}>
          <MenuIcon size={14} />
        </button>
        {!mobile && (
          <input
            type="checkbox"
            title="Show the user list"
            aria-label="Show the user list"
            checked={showUsers}
            onChange={(e) => {
              setShowUsers(e.target.checked);
              save('showUsers', e.target.checked);
            }}
          />
        )}
      </div>
    </div>
  );
};
