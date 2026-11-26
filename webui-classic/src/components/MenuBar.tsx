import { X } from 'lucide-react';
import { closeWindow } from '../actions';
import { MAIN_MENU } from '../actions/mainMenu';
import { useApp } from '../store/app';
import { openMenu } from '../store/ui';

export const MenuBar = () => {
  const active = useApp((s) => s.active);

  return (
    <nav className="menubar" aria-label="Main menu">
      {MAIN_MENU.map(([title, items]) => (
        <button
          key={title}
          type="button"
          aria-haspopup="menu"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            openMenu({ x: box.left, y: box.bottom }, items());
          }}
        >
          {title}
        </button>
      ))}
      {/* As with a maximized window of a desktop client */}
      {active && (
        <button
          type="button"
          className="window-close"
          aria-label="Close window"
          title="Close this window"
          onClick={() => void closeWindow(active)}
        >
          <X size={14} />
        </button>
      )}
    </nav>
  );
};
