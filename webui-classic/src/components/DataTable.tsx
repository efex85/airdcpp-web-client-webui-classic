// Classic "report view" list: sortable and resizable columns, multi selection, keyboard
// navigation and context menus. Only the visible rows are rendered. On small screens each
// item is shown on two lines.

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, EllipsisVertical, X } from 'lucide-react';
import { emptySelection, moveCursor, select, selectAll, type Selection } from '../lib/selection';
import { load, save } from '../lib/storage';
import { useLocalSettings } from '../store/localSettings';
import { buildRows, scrollToRow, sortItems, visibleRange, type Group, type SortState, type SortValue } from '../lib/table';
import { useIsMobile } from '../lib/useIsMobile';
import { openMenu, type MenuEntry, type MenuPosition } from '../store/ui';

export interface Column<T> {
  id: string;
  title: string;
  width: number;
  align?: 'right';
  /** Used for sorting, and shown as such unless a renderer is given */
  value: (item: T) => SortValue;
  render?: (item: T) => ReactNode;
  defaultHidden?: boolean;
  /** Placement on small screens; the first column is always the title */
  mobile?: 'detail' | 'right';
}

export interface RowMenu {
  entries: MenuEntry[];
  more?: () => Promise<MenuEntry[]>;
}

interface Props<T> {
  /** Column settings are remembered by this ID */
  id: string;
  label: string;
  columns: Column<T>[];
  items: T[];
  itemKey: (item: T) => string;
  icon?: (item: T) => ReactNode;
  rowClass?: (item: T) => string | undefined;
  groups?: Group[];
  groupOf?: (item: T) => string;
  defaultSort?: SortState;
  menu?: (items: T[]) => RowMenu;
  onActivate?: (item: T) => void;
  onDelete?: (items: T[]) => void;
  /** Called when the selection changes */
  onSelect?: (items: T[]) => void;
  /** Changing this number clears the selection */
  clearSelection?: number;
  /** Tap on small screens (default: activate, or the menu for lists without a default action) */
  mobileTap?: Tap | ((item: T) => Tap);
  /** Keeps items of a lower rank first regardless of the sort order (folders before files) */
  rank?: (item: T) => number;
  empty?: ReactNode;
}

type Tap = 'activate' | 'menu' | 'select';

interface Preferences {
  sort?: SortState | null;
  widths?: Record<string, number>;
  hidden?: Record<string, boolean>;
}

const ROW_HEIGHT = 20;
const MOBILE_ROW_HEIGHT = 46;
const HEADER_HEIGHT = 22;
const LONG_PRESS_MS = 500;

export function DataTable<T>({
  id,
  label,
  columns,
  items,
  itemKey,
  icon,
  rowClass,
  groups,
  groupOf,
  defaultSort,
  menu,
  onActivate,
  onDelete,
  onSelect,
  clearSelection,
  mobileTap,
  rank,
  empty,
}: Props<T>) {
  const mobile = useIsMobile();
  // Rows and columns grow with the text size setting
  const scale = useLocalSettings((s) => s.ui_text_size) / 100;
  const rowHeight = Math.round((mobile ? MOBILE_ROW_HEIGHT : ROW_HEIGHT) * scale);
  const headerHeight = mobile ? 0 : HEADER_HEIGHT * scale;

  const [preferences, setPreferences] = useState(() => load<Preferences>(`table.${id}`, {}));
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [viewport, setViewport] = useState({ top: 0, height: 400 });
  const scroller = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const update = (change: Partial<Preferences>) =>
    setPreferences((old) => {
      const next = { ...old, ...change };
      save(`table.${id}`, next);
      return next;
    });

  const visibleColumns = columns.filter(
    (c, i) => i === 0 || !(preferences.hidden?.[c.id] ?? c.defaultHidden ?? false),
  );
  // Widths are stored for the normal text size
  const width = (c: Column<T>) => Math.round((preferences.widths?.[c.id] ?? c.width) * scale);
  const totalWidth = visibleColumns.reduce((sum, c) => sum + width(c), 0);

  const sort = preferences.sort === undefined ? (defaultSort ?? null) : preferences.sort;
  const sortColumn = columns.find((c) => c.id === sort?.column);

  const sorted = useMemo(
    () => {
      const result = sortItems(items, sortColumn?.value, !!sort?.desc);
      return rank ? sortItems(result, rank, false) : result;
    },
    // The column objects are recreated on every render
    [items, sort?.column, sort?.desc],
  );
  const rows = useMemo(
    () => buildRows(sorted, itemKey, groups, groupOf, collapsed),
    [sorted, groups, collapsed],
  );
  const { order, byKey } = useMemo(() => {
    const order: string[] = [];
    const byKey = new Map<string, T>();
    for (const row of rows) {
      if (row.kind === 'item') {
        order.push(row.key);
        byKey.set(row.key, row.item);
      }
    }

    return { order, byKey };
  }, [rows]);

  const itemsOf = (keys: ReadonlySet<string>) => order.filter((k) => keys.has(k)).map((k) => byKey.get(k)!);
  const selected = itemsOf(selection.keys);

  const signature = selected.map(itemKey).join('\n');
  useEffect(() => {
    onSelect?.(selected);
  }, [signature]);

  useEffect(() => {
    if (clearSelection) {
      setSelection(emptySelection);
    }
  }, [clearSelection]);

  useEffect(() => {
    if (selecting && !selected.length) {
      setSelecting(false);
    }
  }, [selecting, selected.length]);

  useLayoutEffect(() => {
    const el = scroller.current!;
    const measure = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  const { start, end } = visibleRange(viewport.top, viewport.height - headerHeight, rowHeight, rows.length);

  /* Menus */

  const showRowMenu = (position: MenuPosition, targets: T[], title?: string) => {
    if (!menu || !targets.length) {
      return;
    }

    const { entries, more } = menu(targets);
    openMenu(position, entries, more, title);
  };

  const menuTitle = (targets: T[]) =>
    targets.length === 1 ? String(columns[0].value(targets[0])) : `${targets.length} items`;

  /** Selects the row (unless it already is a part of the selection) and opens its menu */
  const contextAt = (key: string, position: MenuPosition) => {
    let current = selection;
    if (!current.keys.has(key)) {
      current = select(selection, order, key);
      setSelection(current);
    }

    const targets = itemsOf(current.keys);
    showRowMenu(position, targets, menuTitle(targets));
  };

  /* Mouse and touch */

  const onRowMouseDown = (e: MouseEvent, key: string) => {
    if (mobile || e.button !== 0) {
      return;
    }

    e.preventDefault(); // No text selection with Shift
    scroller.current!.focus({ preventScroll: true });
    setSelection(select(selection, order, key, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }));
  };

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  const onRowPointerDown = (e: PointerEvent, key: string) => {
    suppressClick.current = false;
    if (!mobile) {
      return;
    }

    cancelPress();
    press.current = {
      x: e.clientX,
      y: e.clientY,
      timer: window.setTimeout(() => {
        press.current = null;
        suppressClick.current = true;
        setSelecting(true);
        setSelection((s) => (s.keys.has(key) && selecting ? s : select(selecting ? s : emptySelection, order, key, { ctrl: true })));
      }, LONG_PRESS_MS),
    };
  };

  const onRowPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
      cancelPress();
    }
  };

  const onRowClick = (e: MouseEvent, key: string) => {
    if (!mobile || suppressClick.current) {
      return;
    }

    if (selecting) {
      setSelection(select(selection, order, key, { ctrl: true }));
      return;
    }

    setSelection(select(selection, order, key));
    const item = byKey.get(key)!;
    const tap = typeof mobileTap === 'function' ? mobileTap(item) : mobileTap;
    const action = tap ?? (onActivate ? 'activate' : 'menu');
    if (action === 'activate') {
      onActivate?.(item);
    } else if (action === 'menu') {
      showRowMenu({ x: e.clientX, y: e.clientY }, [item], menuTitle([item]));
    }
  };

  /* Keyboard */

  const reveal = (key: string | null) => {
    const index = rows.findIndex((r) => r.key === key);
    const el = scroller.current;
    if (el && index !== -1) {
      el.scrollTop = scrollToRow(index, el.scrollTop, el.clientHeight - headerHeight, rowHeight);
    }
  };

  const move = (delta: number, extend: boolean) => {
    const next = moveCursor(selection, order, delta, extend);
    setSelection(next);
    reveal(next.cursor);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const page = Math.max(1, Math.floor((viewport.height - headerHeight) / rowHeight) - 1);
    const moves: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      PageUp: -page,
      PageDown: page,
      Home: -order.length,
      End: order.length,
    };

    if (e.key in moves) {
      e.preventDefault();
      move(moves[e.key], e.shiftKey);
    } else if (e.key === 'Enter') {
      const item = selection.cursor !== null ? byKey.get(selection.cursor) : undefined;
      if (item) {
        e.preventDefault();
        onActivate?.(item);
      }
    } else if (e.key === 'Delete') {
      if (selected.length) {
        onDelete?.(selected);
      }
    } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setSelection(selectAll(selection, order));
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const key = selection.cursor ?? order[0];
      if (key !== undefined) {
        reveal(key);
        const box = scroller.current!.getBoundingClientRect();
        const index = rows.findIndex((r) => r.key === key);
        const y = box.top + headerHeight + (index + 1) * rowHeight - scroller.current!.scrollTop;
        contextAt(key, { x: box.left + 24, y: Math.min(box.bottom, Math.max(box.top, y)) });
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type the beginning of a name to jump to it
      e.preventDefault();
      const now = Date.now();
      const text = (now - typed.current.at < 800 ? typed.current.text : '') + e.key.toLowerCase();
      typed.current = { text, at: now };

      const from = Math.max(0, selection.cursor === null ? 0 : order.indexOf(selection.cursor));
      // A new search starts after the current row, a longer one may stay on it
      const offset = text.length === 1 && selection.cursor !== null ? 1 : 0;
      for (let i = 0; i < order.length; i++) {
        const key = order[(from + offset + i) % order.length];
        if (String(columns[0].value(byKey.get(key)!)).toLowerCase().startsWith(text)) {
          setSelection(select(selection, order, key));
          reveal(key);
          break;
        }
      }
    }
  };

  /* Header */

  const toggleSort = (column: string) => {
    if (sort?.column !== column) {
      update({ sort: { column, desc: false } });
    } else {
      update({ sort: sort.desc ? null : { column, desc: true } });
    }
  };

  const headerMenu = (e: MouseEvent) => {
    e.preventDefault();
    openMenu({ x: e.clientX, y: e.clientY }, [
      ...columns.slice(1).map((c): MenuEntry => {
        const visible = visibleColumns.includes(c);
        return {
          label: c.title,
          checked: visible,
          onClick: () => update({ hidden: { ...preferences.hidden, [c.id]: visible } }),
        };
      }),
      'separator',
      { label: 'Reset columns', onClick: () => update({ sort: undefined, widths: undefined, hidden: undefined }) },
    ]);
  };

  const resizeHandle = (column: Column<T>) => (
    <span
      className="th-resize"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = e.currentTarget;
        const origin = e.clientX - width(column);
        handle.setPointerCapture(e.pointerId);
        handle.onpointermove = (event) =>
          update({
            widths: { ...preferences.widths, [column.id]: Math.max(32, Math.round((event.clientX - origin) / scale)) },
          });
        handle.onlostpointercapture = () => {
          handle.onpointermove = null;
        };
      }}
    />
  );

  const renderCell = (c: Column<T>, item: T) => (c.render ? c.render(item) : String(c.value(item)));

  return (
    <div className={`table${mobile ? ' mobile' : ''}`}>
      {mobile && selecting && (
        <div className="table-actions">
          <button type="button" className="icon-button" aria-label="End selection" onClick={() => setSelection(emptySelection)}>
            <X size={18} />
          </button>
          <span>{selected.length} selected</span>
          <button type="button" onClick={() => setSelection(selectAll(selection, order))}>
            All
          </button>
          {menu && (
            <button type="button" onClick={(e) => showRowMenu({ x: e.clientX, y: e.clientY }, selected, menuTitle(selected))}>
              Actions
            </button>
          )}
        </div>
      )}
      {mobile && !selecting && rows.length > 1 && (
        <div className="table-sort">
          <label>
            Sort
            <select
              value={sort?.column ?? ''}
              onChange={(e) => update({ sort: e.target.value ? { column: e.target.value, desc: false } : null })}
            >
              <option value="">Default</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          {sort && (
            <button
              type="button"
              className="icon-button"
              aria-label={sort.desc ? 'Descending' : 'Ascending'}
              onClick={() => update({ sort: { ...sort, desc: !sort.desc } })}
            >
              {sort.desc ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            </button>
          )}
        </div>
      )}
      <div
        ref={scroller}
        className="table-scroll"
        tabIndex={0}
        role="grid"
        aria-label={label}
        aria-multiselectable="true"
        aria-rowcount={rows.length}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          cancelPress();
          setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight });
        }}
        // Click on the empty area clears the selection
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (!mobile && e.button === 0 && !target.closest('.tr, .table-header') && e.target !== e.currentTarget) {
            setSelection(emptySelection);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!mobile && (
          <div className="table-header" role="row" style={{ width: totalWidth }} onContextMenu={headerMenu}>
            {visibleColumns.map((c) => (
              <div
                key={c.id}
                role="columnheader"
                aria-sort={sort?.column === c.id ? (sort.desc ? 'descending' : 'ascending') : undefined}
                className={`th${c.align ? ' right' : ''}`}
                style={{ width: width(c) }}
                onClick={() => toggleSort(c.id)}
              >
                <span className="th-title">{c.title}</span>
                {sort?.column === c.id && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                {resizeHandle(c)}
              </div>
            ))}
          </div>
        )}
        <div
          className="table-body"
          style={{ height: rows.length * rowHeight, minWidth: mobile ? undefined : totalWidth }}
        >
          <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
            {rows.slice(start, end).map((row) => {
              if (row.kind === 'group') {
                return (
                  <button
                    key={row.key}
                    type="button"
                    tabIndex={-1}
                    className="tr-group"
                    style={{ height: rowHeight }}
                    aria-expanded={!row.collapsed}
                    onClick={() => {
                      const next = new Set(collapsed);
                      if (!next.delete(row.group.id)) {
                        next.add(row.group.id);
                      }

                      setCollapsed(next);
                    }}
                  >
                    {row.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span>
                      {row.group.title} ({row.count})
                    </span>
                  </button>
                );
              }

              const { item, key } = row;
              const isSelected = selection.keys.has(key);
              const extra = rowClass?.(item);
              return (
                <div
                  key={key}
                  role="row"
                  aria-selected={isSelected}
                  className={`tr${isSelected && (!mobile || selecting) ? ' selected' : ''}${extra ? ` ${extra}` : ''}`}
                  style={{ height: rowHeight }}
                  onMouseDown={(e) => onRowMouseDown(e, key)}
                  onDoubleClick={() => !mobile && onActivate?.(item)}
                  onClick={(e) => onRowClick(e, key)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!mobile) {
                      contextAt(key, { x: e.clientX, y: e.clientY });
                    }
                  }}
                  onPointerDown={(e) => onRowPointerDown(e, key)}
                  onPointerMove={onRowPointerMove}
                  onPointerUp={cancelPress}
                  onPointerCancel={cancelPress}
                >
                  {mobile ? (
                    <>
                      {icon && <span className="row-icon">{icon(item)}</span>}
                      <span className="row-text">
                        <span className="row-title">{renderCell(columns[0], item)}</span>
                        <span className="row-detail">
                          {columns
                            .filter((c) => c.mobile === 'detail' && c.value(item) !== '')
                            .map((c) => (
                              <span key={c.id}>{renderCell(c, item)}</span>
                            ))}
                        </span>
                      </span>
                      <span className="row-right">
                        {columns
                          .filter((c) => c.mobile === 'right')
                          .map((c) => (
                            <span key={c.id}>{renderCell(c, item)}</span>
                          ))}
                      </span>
                      {menu && !selecting && (
                        <button
                          type="button"
                          className="icon-button row-menu"
                          aria-label="Actions"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelection(select(selection, order, key));
                            showRowMenu({ x: e.clientX, y: e.clientY }, [item], menuTitle([item]));
                          }}
                        >
                          <EllipsisVertical size={18} />
                        </button>
                      )}
                    </>
                  ) : (
                    visibleColumns.map((c, i) => (
                      <div
                        key={c.id}
                        role="gridcell"
                        className={`td${c.align ? ' right' : ''}`}
                        style={{ width: width(c) }}
                        title={typeof c.value(item) === 'string' ? String(c.value(item)) : undefined}
                      >
                        {i === 0 && icon && <span className="row-icon">{icon(item)}</span>}
                        <span className="cell">{renderCell(c, item)}</span>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {!rows.length && empty && <div className="table-empty">{empty}</div>}
      </div>
    </div>
  );
}
