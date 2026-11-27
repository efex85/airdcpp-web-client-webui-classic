// The private chats that were opened last, also those that have been closed since
import type { HintedUser } from '../../api/types';
import { openPrivateChat } from '../../actions';
import { useAccess } from '../../lib/access';
import { formatAge, formatDate } from '../../lib/format';
import { openTab, useApp } from '../../store/app';
import { useNow } from './StatsWidget';
import { useWidgetData } from './useWidgetData';

interface RecentChat {
  name: string;
  hub_url: string;
  /** When the chat was opened last */
  last_opened: number;
  user: HintedUser | null;
}

// The client keeps as many as set in Settings → View → History
const PATH = 'histories/sessions/private_chat/100';

export const RecentPmsWidget = ({ active }: { active: boolean }) => {
  const access = useAccess();
  const chats = useApp((s) => s.chats);
  const open = new Set(chats.map((c) => c.id));
  // Opening and closing a chat changes the list
  const { data, error } = useWidgetData<RecentChat[]>(PATH, active, [...open].sort().join());
  const now = useNow(active, 30_000);

  return (
    <div className="widget-scroll">
      {error && (
        <div className="error widget-message" role="alert">
          {error}
        </div>
      )}
      {data && !data.length && <div className="muted widget-message">No private chats yet</div>}
      <ul className="recent">
        {data?.map(({ user, name, hub_url: hubUrl, last_opened: opened }) => {
          if (!user) {
            return null;
          }

          const isOpen = open.has(user.cid);
          const offline = user.flags.includes('offline');
          return (
            <li key={user.cid}>
              <button
                type="button"
                disabled={!isOpen && !access('private_chat_edit')}
                onClick={() => (isOpen ? openTab(`pm:${user.cid}`) : void openPrivateChat(user))}
              >
                <span className="recent-title">
                  <span className="recent-name">{user.nicks || name}</span>
                  {isOpen && <span className="recent-open">Open</span>}
                </span>
                <span className="recent-detail">
                  <span>{offline ? 'Offline' : (user.hub_names ?? hubUrl)}</span>
                  <span title={`Opened ${formatDate(opened)}`}>
                    {formatAge(opened, Math.max(now, Date.now() / 1000))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
