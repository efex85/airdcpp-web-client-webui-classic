import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { closeWindow } from '../actions';
import { windowMenu } from '../actions/mainMenu';
import { useDragTabs } from '../lib/useDragTabs';
import { windowInfo } from '../lib/windows';
import { activate, useApp } from '../store/app';
import { openMenu } from '../store/ui';

export const TabBar = () => {
  const state = useApp();
  const bar = useRef<HTMLDivElement>(null);
  const { dragged, onPointerDown } = useDragTabs(bar);

  useEffect(() => {
    bar.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [state.active]);

  return (
    <div
      ref={bar}
      className={`tabbar${dragged ? ' dragging' : ''}`}
      role="tablist"
      onWheel={(e) => {
        e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      {state.tabs.map((key) => {
        const info = windowInfo(key, state);
        const selected = key === state.active;
        return (
          <div
            key={key}
            className={`tab${selected ? ' active' : ''}${!selected && info.attention ? ` ${info.attention}` : ''}${key === dragged ? ' dragged' : ''}`}
            data-key={key}
            title={dragged ? undefined : (info.detail ?? info.title)}
            onPointerDown={(e) => onPointerDown(e, key)}
            // Middle click closes the window
            onMouseDown={(e) => e.button === 1 && e.preventDefault()}
            onAuxClick={(e) => e.button === 1 && void closeWindow(key)}
            onContextMenu={(e) => {
              e.preventDefault();
              const { entries, more } = windowMenu(key);
              openMenu({ x: e.clientX, y: e.clientY }, entries, more, info.title);
            }}
          >
            <button type="button" role="tab" aria-selected={selected} onClick={() => activate(key)}>
              {info.icon}
              <span>{info.title}</span>
            </button>
            <button type="button" className="tab-close" aria-label={`Close ${info.title}`} onClick={() => void closeWindow(key)}>
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
