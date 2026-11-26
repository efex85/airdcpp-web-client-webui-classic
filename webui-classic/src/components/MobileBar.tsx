// Navigation on small screens: a title bar and a drawer with the open windows
import { EllipsisVertical, Menu as MenuIcon, X } from 'lucide-react';
import { useState } from 'react';
import { closeWindow } from '../actions';
import { MAIN_MENU, windowMenu } from '../actions/mainMenu';
import { windowInfo } from '../lib/windows';
import { activate, useApp } from '../store/app';
import { openMenu } from '../store/ui';

export const MobileBar = () => {
  const state = useApp();
  const [open, setOpen] = useState(false);
  const info = state.active ? windowInfo(state.active, state) : null;
  const others = state.tabs.filter((key) => key !== state.active).map((key) => windowInfo(key, state).attention);
  const attention = others.includes('mention') ? 'mention' : others.includes('unread') ? 'unread' : null;

  return (
    <header className="topbar">
      <button type="button" className="icon-button" aria-label="Windows and menu" onClick={() => setOpen(true)}>
        <MenuIcon size={20} />
        {attention && <span className={`dot ${attention}`} />}
      </button>
      <span className="topbar-title">
        {info?.icon}
        <span>{info?.title ?? 'AirDC++ Classic'}</span>
      </span>
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
                const tab = windowInfo(key, state);
                return (
                  <li key={key} className={`${key === state.active ? 'active' : ''} ${tab.attention ?? ''}`}>
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
