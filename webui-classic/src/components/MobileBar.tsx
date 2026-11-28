// Navigation on small screens: a title bar and a drawer with the open windows
import { EllipsisVertical, Menu as MenuIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { closeWindow } from '../actions';
import { MAIN_MENU, windowMenu } from '../actions/mainMenu';
import { tabEventStyle } from '../lib/tabEvents';
import { windowInfo } from '../lib/windows';
import { activate, useApp } from '../store/app';
import { colorsDoc, useDoc } from '../store/docs';
import { openMenu } from '../store/ui';

export const MobileBar = () => {
  const state = useApp();
  const { highlight } = useDoc(colorsDoc);
  const [open, setOpen] = useState(false);
  /** The full title of a hub is shown below the bar */
  const [full, setFull] = useState(false);
  // Closed again in another window
  useEffect(() => setFull(false), [state.active]);
  const info = state.active ? windowInfo(state.active, state, highlight) : null;
  const others = state.tabs
    .filter((key) => key !== state.active)
    .map((key) => windowInfo(key, state, highlight).attention);
  const attention = others.includes('mention') ? 'mention' : others.includes('unread') ? 'unread' : null;

  return (
    <header className="topbar">
      <button type="button" className="icon-button" aria-label="Windows and menu" onClick={() => setOpen(true)}>
        <MenuIcon size={20} />
        {attention && <span className={`dot ${attention}`} />}
      </button>
      {info?.topic ? (
        // The topic of a hub below its name; a tap shows all of it
        <button
          type="button"
          className="topbar-title"
          aria-expanded={full}
          onClick={() => setFull(!full)}
        >
          {info.icon}
          <span className="topbar-names">
            <span>{info.title}</span>
            <span className="topbar-topic">{info.topic}</span>
          </span>
        </button>
      ) : (
        <span className="topbar-title">
          {info?.icon}
          <span>{info?.title ?? 'AirDC++ Classic'}</span>
        </span>
      )}
      {info && (
        <button
          type="button"
          className="icon-button"
          aria-label="Window actions"
          onClick={(e) => {
            // "Reconnect", "Close" etc. of the current window
            const { entries, more } = windowMenu(state.active);
            openMenu({ x: e.clientX, y: e.clientY }, entries, more, info.title);
          }}
        >
          <EllipsisVertical size={20} />
        </button>
      )}
      {info && (
        <button type="button" className="icon-button" aria-label="Close window" onClick={() => void closeWindow(state.active)}>
          <X size={20} />
        </button>
      )}
      {info?.topic && full && <div className="topbar-caption">{info.caption}</div>}
      {open && (
        <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside className="drawer">
            <div className="drawer-menu">
              {MAIN_MENU.filter(([title]) => title !== 'Window').map(([title, items]) => (
                <button
                  key={title}
                  type="button"
                  onClick={(e) => {
                    setOpen(false);
                    openMenu({ x: e.clientX, y: e.clientY }, items(), undefined, title);
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
            <ul>
              {state.tabs.map((key) => {
                const tab = windowInfo(key, state, highlight);
                const event = key === state.active ? undefined : tab.event;
                return (
                  <li
                    key={key}
                    className={`${key === state.active ? 'active' : ''} ${tab.attention ?? ''}${event ? ' event' : ''}`}
                    style={event && tabEventStyle(event)}
                    data-event={event}
                  >
                    <button
                      type="button"
                      className="drawer-window"
                      onClick={() => {
                        activate(key);
                        setOpen(false);
                      }}
                    >
                      {tab.icon}
                      <span>{tab.title}</span>
                    </button>
                    <button type="button" className="icon-button" aria-label={`Close ${tab.title}`} onClick={() => void closeWindow(key)}>
                      <X size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}
    </header>
  );
};
