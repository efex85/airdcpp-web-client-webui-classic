import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import { closeMenu, useUi, type MenuEntry } from '../store/ui';
import { useIsMobile } from '../lib/useIsMobile';
import { tidySeparators } from '../lib/menu';
import { combinationLabel } from '../lib/shortcuts';
import { isMac } from '../lib/platform';

const MenuList = ({ items, mobile }: { items: MenuEntry[]; mobile: boolean }) => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      {tidySeparators(items).map((item, index) => {
        if (item === 'separator') {
          return <div key={index} className="menu-separator" role="separator" />;
        }

        if (item.heading) {
          return (
            <div key={`${index}-${item.label}`} className="menu-heading" role="presentation">
              {item.label}
            </div>
          );
        }

        const submenu = !!item.children || !!item.load;
        const isOpen = open === index;
        return (
          <div
            key={`${index}-${item.label}`}
            className="menu-item-wrap"
            onPointerEnter={mobile ? undefined : () => setOpen(submenu ? index : null)}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup={submenu || undefined}
              aria-expanded={submenu ? isOpen : undefined}
              className={`menu-item${item.bold ? ' bold' : ''}${item.wrap ? ' wrap' : ''}${isOpen ? ' open' : ''}`}
              disabled={item.disabled}
              aria-keyshortcuts={item.keys || undefined}
              onClick={() => {
                if (submenu) {
                  setOpen(isOpen && mobile ? null : index);
                } else {
                  closeMenu();
                  item.onClick?.();
                }
              }}
            >
              <span className="menu-icon">{item.checked ? <Check size={14} /> : item.icon}</span>
              <span className="menu-label">{item.label}</span>
              {item.keys && !mobile && (
                <span className="menu-keys" aria-hidden="true">
                  {combinationLabel(item.keys, isMac)}
                </span>
              )}
              {submenu && (mobile && isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </button>
            {submenu && isOpen && !item.disabled && (
              <Submenu mobile={mobile} items={item.children} load={item.load} />
            )}
          </div>
        );
      })}
    </>
  );
};

interface SubmenuProps {
  items?: MenuEntry[];
  load?: () => Promise<MenuEntry[]>;
  mobile: boolean;
}

const Submenu = ({ items, load, mobile }: SubmenuProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<MenuEntry[] | null>(null);

  useEffect(() => {
    if (!load) {
      return;
    }

    let current = true;
    load().then(
      (entries) => current && setLoaded(entries),
      () => current && setLoaded([{ label: 'The list couldn’t be loaded', disabled: true }]),
    );
    return () => {
      current = false;
    };
  }, []);

  const entries = load ? loaded : items;

  // Flip to the left / move up when there is no room
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || mobile) {
      return;
    }

    el.style.left = '';
    el.style.top = '';
    const parent = el.parentElement!.getBoundingClientRect();
    const { width, height } = el.getBoundingClientRect();
    // Nested submenus continue in the direction of the previous one, so they don't cover it
    const opensLeft = el.parentElement!.closest<HTMLElement>('.submenu')?.dataset.side === 'left';
    const fitsRight = parent.right + width <= window.innerWidth;
    const fitsLeft = parent.left - width >= 0;
    const toLeft = opensLeft ? fitsLeft || !fitsRight : !fitsRight;
    el.dataset.side = toLeft ? 'left' : 'right';
    const left = toLeft ? Math.max(0, parent.left - width) : parent.right;
    const top = Math.max(0, Math.min(parent.top, window.innerHeight - height - 4));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  return (
    <div ref={ref} className={mobile ? 'submenu-inline' : 'menu submenu'} role="menu">
      {entries ? <MenuList items={entries} mobile={mobile} /> : <div className="menu-loading">Loading…</div>}
    </div>
  );
};

export const ContextMenuHost = () => {
  const menu = useUi((s) => s.menu);
  const mobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !menu) {
      return;
    }

    if (mobile) {
      el.style.left = '';
      el.style.top = '';
      return;
    }

    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(0, Math.min(menu.x, window.innerWidth - width - 4))}px`;
    el.style.top = `${Math.max(0, Math.min(menu.y, window.innerHeight - height - 4))}px`;
  }, [menu, mobile]);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menu?.token]);

  if (!menu) {
    return null;
  }

  return (
    <div
      className={`menu-overlay${mobile ? ' sheet' : ''}`}
      onPointerDown={(e) => e.target === e.currentTarget && !mobile && closeMenu()}
      // On touch screens close on click, so that the tap doesn't reach the element below
      onClick={(e) => e.target === e.currentTarget && closeMenu()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={ref} key={menu.token} className="menu context" role="menu">
        {menu.title && <div className="menu-title">{menu.title}</div>}
        <MenuList items={menu.items} mobile={mobile} />
        {menu.loading && <div className="menu-loading">Loading…</div>}
      </div>
    </div>
  );
};
