// The entries of an RSS or Atom feed
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { openSearch } from '../../actions';
import { useAccess } from '../../lib/access';
import type { FeedEntry } from '../../lib/feed';
import { formatAge, formatDate } from '../../lib/format';
import type { Widget } from '../../lib/widgets';
import { toast, useApp } from '../../store/app';
import { feedState, loadFeed, loadFeedIfDue, useFeeds } from '../../store/feeds';
import { openMenu } from '../../store/ui';
import { useNow } from './StatsWidget';

export const isFeedAddress = (url: string) => /^https?:\/\/[^\s/]+/i.test(url);

const AddressForm = ({ onSubmit }: { onSubmit: (url: string) => void }) => {
  const [url, setUrl] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isFeedAddress(url.trim())) {
      onSubmit(url.trim());
    } else {
      toast('The address of a feed starts with http:// or https://', true);
    }
  };

  return (
    <form className="widget-setup" onSubmit={submit}>
      <label>
        Address of an RSS or Atom feed
        <input type="text" inputMode="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <button type="submit" disabled={!url.trim()}>
        Show feed
      </button>
    </form>
  );
};

interface Props {
  widget: Widget;
  active: boolean;
  onAddress: (url: string) => void;
}

export const RssWidget = ({ widget, active, onAddress }: Props) => {
  const { id, url, refresh_minutes: minutes } = widget;
  const access = useAccess();
  const connected = useApp((s) => s.connection === 'connected');
  const stored = useFeeds((s) => s[id]);
  const state = url ? (stored?.url === url ? stored : feedState(id, url)) : null;
  const now = useNow(active, 30_000);

  // Loaded when the window is shown and the feed is older than the interval, and then repeatedly
  useEffect(() => {
    if (!active || !connected || !url) {
      return;
    }

    void loadFeedIfDue(id, url, minutes);
    const timer = setInterval(() => void loadFeedIfDue(id, url, minutes), 30_000);
    return () => clearInterval(timer);
  }, [id, url, minutes, active, connected]);

  if (!state) {
    return <AddressForm onSubmit={onAddress} />;
  }

  const entryMenu = (e: MouseEvent, entry: FeedEntry) => {
    e.preventDefault();
    openMenu(
      { x: e.clientX, y: e.clientY },
      [
        {
          label: 'Open link',
          icon: <ExternalLink size={13} />,
          disabled: !entry.link,
          onClick: () => void window.open(entry.link, '_blank', 'noopener,noreferrer'),
        },
        {
          label: 'Search',
          icon: <Search size={13} />,
          disabled: !access('search'),
          onClick: () => openSearch({ pattern: entry.title }),
        },
      ],
      undefined,
      entry.title,
    );
  };

  return (
    <>
      <div className="widget-scroll">
        {state.error && (
          <div className="error widget-message" role="alert">
            {state.error}
          </div>
        )}
        {!state.feed && state.loading && <div className="muted widget-message">Loading the feed…</div>}
        {state.feed && !state.feed.entries.length && <div className="muted widget-message">The feed is empty</div>}
        <ul className="feed">
          {state.feed?.entries.map((entry) => (
            <li key={entry.key}>
              <button type="button" onClick={(e) => entryMenu(e, entry)} onContextMenu={(e) => entryMenu(e, entry)}>
                <span className="feed-title">{entry.title}</span>
                {entry.date !== null && (
                  <span className="feed-date" title={formatDate(entry.date)}>
                    {formatAge(entry.date, Math.max(now, Date.now() / 1000))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="widget-footer">
        <button
          type="button"
          className="icon-button"
          title="Refresh feed"
          aria-label="Refresh feed"
          disabled={state.loading || !connected}
          onClick={() => void loadFeed(id, url)}
        >
          <RefreshCw size={13} className={state.loading ? 'spin' : undefined} />
        </button>
        <span className="muted grow">
          {state.loading
            ? 'Loading…'
            : state.loadedAt
              ? `Last updated: ${formatAge(state.loadedAt / 1000, Math.max(now, Date.now() / 1000))}`
              : ''}
        </span>
      </div>
    </>
  );
};
