// Data and lists used by the settings pages besides the setting forms
import { EllipsisVertical } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';
import { openMenu, type MenuEntry } from '../../store/ui';

/**
 * Loads API data and keeps it up to date: it is loaded again after the listed events
 * ("module/event") and after a reconnect
 */
export const useApiData = <T,>(path: string, events: string[] = []) => {
  const generation = useApp((s) => s.generation);
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const latest = useRef(0);

  const reload = useCallback(() => {
    const current = ++latest.current;
    return socket.get<T>(path).then(
      (result) => {
        if (current === latest.current) {
          setData(() => result);
          setError('');
        }
      },
      (e: Error) => {
        if (current === latest.current) {
          setError(e.message);
        }
      },
    );
  }, [path]);

  const subscriptions = events.join(' ');
  useEffect(() => {
    let active = true;
    let removers: (() => void)[] = [];
    for (const name of subscriptions.split(' ').filter(Boolean)) {
      const [module, event] = name.split('/');
      socket.listen(module, event, () => void reload()).then(
        (remove) => (active ? removers.push(remove) : remove()),
        () => undefined, // No permission for the events: the data is still shown
      );
    }

    void reload();
    return () => {
      active = false;
      latest.current++;
      removers.forEach((remove) => remove());
      removers = [];
    };
  }, [subscriptions, reload, generation]);

  // Some values (e.g. counters) change without events: load them again when the window is reopened
  const shown = useApp((s) => s.active === 'settings');
  const wasShown = useRef(shown);
  useEffect(() => {
    if (shown && !wasShown.current) {
      void reload();
    }

    wasShown.current = shown;
  }, [shown, reload]);

  return { data, error, reload };
};

export const LoadError = ({ error }: { error: string }) =>
  error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;

export interface ListColumn<T> {
  title: string;
  render: (item: T) => ReactNode;
  /** Not shown on small screens */
  secondary?: boolean;
  align?: 'right';
}

export type RowAction = Exclude<MenuEntry, 'separator'>;

interface SimpleListProps<T> {
  label: string;
  columns: ListColumn<T>[];
  items: T[] | undefined;
  rowKey: (item: T) => string | number;
  /** The first action is also run by double-clicking the row */
  actions?: (item: T) => RowAction[];
  /** Menu entries from the server (extensions) */
  more?: (item: T) => Promise<MenuEntry[]>;
  rowClass?: (item: T) => string;
  empty: string;
}

export const SimpleList = <T,>({ label, columns, items, rowKey, actions, more, rowClass, empty }: SimpleListProps<T>) => {
  const showActions = (item: T, position: { x: number; y: number }) => {
    const entries = actions?.(item);
    if (entries?.length) {
      openMenu(position, entries, more && (() => more(item)));
    }
  };

  if (!items) {
    return <div className="muted">Loading…</div>;
  }

  if (!items.length) {
    return <div className="muted">{empty}</div>;
  }

  return (
    <div className="settings-table">
      <table aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title} className={`${c.secondary ? 'wide' : ''} ${c.align ?? ''}`}>
                {c.title}
              </th>
            ))}
            {actions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={rowKey(item)}
              className={rowClass?.(item)}
              onDoubleClick={() => {
                const first = actions?.(item)[0];
                if (first && !first.disabled) {
                  first.onClick?.();
                }
              }}
              onContextMenu={(e) => {
                if (actions) {
                  e.preventDefault();
                  showActions(item, { x: e.clientX, y: e.clientY });
                }
              }}
            >
              {columns.map((c) => (
                <td key={c.title} className={`${c.secondary ? 'wide' : ''} ${c.align ?? ''}`}>
                  {c.render(item)}
                </td>
              ))}
              {actions && (
                <td className="actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Actions"
                    aria-haspopup="menu"
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      const box = e.currentTarget.getBoundingClientRect();
                      showActions(item, { x: box.left, y: box.bottom });
                    }}
                  >
                    <EllipsisVertical size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Label and value pairs of the status and statistics panels */
export const Facts = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="facts">
    {rows.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

export const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export const links = {
  home: 'https://airdcpp-web.github.io',
  help: 'https://airdcpp-web.github.io/docs/',
  issues: 'https://github.com/airdcpp-web/airdcpp-webclient/issues',
  dbip: 'https://db-ip.com',
  speedtest: 'https://www.speedtest.net',
  portCheck: 'https://www.yougetsignal.com/tools/open-ports/',
  connectivityFaq: 'https://dcplusplus.sourceforge.net/webhelp/faq_connection.html',
  variables: 'https://airdcpp.net/docs/usage/setting-variables.html',
  translations: 'https://airdcpp-web.github.io/docs/advanced/translations.html',
};
