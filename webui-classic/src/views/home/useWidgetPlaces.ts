// Where the widgets are on a large screen: arranging them, moving and resizing them, and saving their places

import { useEffect, useRef, useState } from 'react';
import {
  arrange,
  columnOrder,
  fittingUnit,
  moveBox,
  nudgeBox,
  resizeBox,
  rightEdge,
  settle,
  snapColumn,
  tooNarrow,
  type Box,
  type Direction,
  type Item,
} from '../../lib/widgetLayout';
import {
  columnCount,
  GAP,
  heightPixels,
  minUnits,
  ROW,
  rowSpan,
  sizeOf,
  widthUnits,
  type WidgetSizes,
} from '../../lib/widgetSizes';
import type { Widget } from '../../lib/widgets';
import { addedHere, setWidgetLayout, useWidgetLayout } from '../../store/widgetLayout';
import { setWidgetSize, useWidgetSizes } from '../../store/widgetSizes';
import { scrollWhileDragging } from './dragScroll';
import { orderByPlaces } from './widgetActions';

/** A widget that isn't dragged this far hasn't been moved */
const DRAG_START = 5;
/** The sizes have to stay as they are this long before the widgets get their places for the first time */
const FIRST_PLACES_DELAY = 800;

interface Arrangement {
  boxes: Box[];
  /** Pixels from one width step to the next */
  unit: number;
  /** Width steps of the window */
  columns: number;
}

/** The widget that follows the pointer, relative to the grid */
export interface Moving {
  id: string;
  left: number;
  top: number;
  width: number;
}

/** While a widget is moved or resized */
interface Held extends Arrangement {
  moving?: Moving;
  resizing?: string;
}

export interface ResizeSession {
  /** The width in steps at the start */
  units: number;
  /** …and the widest it can become */
  max: number;
  unit: number;
  /** Shows the widget with this size */
  show: (units: number, rows: number) => void;
  end: (keep: boolean) => void;
}

export interface Places extends Arrangement {
  moving: Moving | undefined;
  resizing: string | undefined;
  boxOf: (id: string) => Box;
  startMove: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  nudge: (id: string, direction: Direction) => void;
  startResize: (id: string, corner: 'se' | 'sw') => ResizeSession;
}

export interface Placement {
  /** null where the widgets aren't placed: on phones, and in a window that is too narrow */
  places: Places | null;
  /** A new arrangement for the window; undefined on phones */
  arrangeToFit: (() => void) | undefined;
}

interface Options {
  list: Widget[];
  sizes: WidgetSizes;
  /** The height of a normal box */
  normal: number;
  /** The text size, as a factor */
  scale: number;
  /** The width of the grid without its padding; 0 until it's known */
  width: number;
  mobile: boolean;
  active: boolean;
  /** The list of widgets has been fetched from the client */
  loaded: boolean;
  ordered: boolean;
}

const positions = (boxes: Box[]) => Object.fromEntries(boxes.map(({ id, x, y }) => [id, { x, y }]));

/** The first places must hold what's shown: a widget that was wider than the window keeps the shown width */
const keepShownWidths = (boxes: Box[], list: Widget[]) => {
  for (const widget of list) {
    const box = boxes.find((b) => b.id === widget.id);
    const size = sizeOf(useWidgetSizes.getState().sizes, widget);
    if (box && widthUnits(size, minUnits(widget.type)) > box.w) {
      setWidgetSize(widget.id, { ...size, w: box.w });
    }
  }
};

export const useWidgetPlaces = (options: Options): Placement => {
  const { list, sizes, normal, scale, width, mobile, active, loaded, ordered } = options;
  const layout = useWidgetLayout((s) => s.layout);
  const [held, setHeld] = useState<Held | null>(null);
  /** Ends the present move */
  const stop = useRef<((keep: boolean) => void) | null>(null);

  useEffect(() => {
    if (!active || mobile) {
      stop.current?.(false);
    }
  }, [active, mobile]);
  useEffect(() => () => stop.current?.(false), []);

  const items: Item[] = list.map((widget) => {
    const size = sizeOf(sizes, widget);
    return {
      id: widget.id,
      w: widthUnits(size, minUnits(widget.type)),
      h: rowSpan(heightPixels(size, normal)),
      first: widget.type === 'stats',
    };
  });

  /** The widgets as they would be placed in this window */
  let fitted: Arrangement | null = null;
  if (!mobile && width > 0 && items.length) {
    const free = (width + GAP) / columnCount(width);
    const wanted = layout?.unit ?? free;
    const boxes = arrange(items, layout?.items ?? {}, Math.floor((width + GAP) / wanted + 1e-6), ordered);
    const unit = fittingUnit(wanted, width, boxes);
    fitted = { boxes, unit, columns: Math.max(rightEdge(boxes), Math.floor((width + GAP) / unit + 1e-6)) };
  }

  const statistics = list.find((w) => w.type === 'stats')?.id;
  const arrangement = fitted && !tooNarrow(fitted.boxes, fitted.unit, statistics, scale) ? fitted : null;

  const save = (boxes: Box[], unit: number) => {
    const saved = useWidgetLayout.getState().layout;
    if (!saved) {
      keepShownWidths(boxes, list);
    }

    setWidgetLayout({ unit: saved?.unit ?? unit, items: positions(boxes) });
  };

  /** Saves what the user has arranged; phones then show the widgets in this order */
  const commit = (boxes: Box[], unit: number) => {
    const settled = settle(boxes);
    save(settled, unit);
    orderByPlaces(columnOrder(settled), true);
  };

  // Every widget gets a place of its own, so that it stays there whatever the window becomes
  const unplaced = !held && !!arrangement?.boxes.some((box) => !layout?.items[box.id]);
  const waiting = unplaced ? JSON.stringify(arrangement) : '';
  useEffect(() => {
    if (!active || !loaded || !waiting) {
      return;
    }

    const place = () => {
      const { boxes, unit } = arrangement!;
      const first = !useWidgetLayout.getState().layout;
      const added = boxes.some((box) => addedHere.has(box.id));
      save(boxes, unit);
      boxes.forEach((box) => addedHere.delete(box.id));
      if ((first && !ordered) || added) {
        orderByPlaces(columnOrder(boxes), false);
      }
    };
    const timer = setTimeout(place, layout ? 0 : FIRST_PLACES_DELAY);
    return () => clearTimeout(timer);
  }, [active, loaded, waiting]);

  /** A new arrangement for the present width of the window, in the present order */
  const arrangeToFit =
    fitted &&
    (() => {
      const columns = columnCount(width);
      const sorted = columnOrder(fitted.boxes).map((id) => items.find((item) => item.id === id)!);
      const boxes = arrange(sorted, {}, columns, true);
      keepShownWidths(boxes, list);
      setWidgetLayout({ unit: (width + GAP) / columns, items: positions(boxes) });
      orderByPlaces(columnOrder(boxes), true);
    });

  if (!arrangement) {
    return { places: null, arrangeToFit: arrangeToFit ?? undefined };
  }

  const shown: Held = held ?? arrangement;

  const startMove = (id: string, e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as Element;
    // The title bar moves the widget; its buttons, other than the handle, do their own things
    if (e.button !== 0 || stop.current || target.closest('button:not(.widget-grip)')) {
      return;
    }

    const card = e.currentTarget.closest<HTMLElement>('.widget')!;
    const grid = card.parentElement!;
    const scroller = grid.parentElement!;
    const start = arrangement;
    const box = start.boxes.find((b) => b.id === id)!;
    const cardBox = card.getBoundingClientRect();
    const from = { x: e.clientX, y: e.clientY };
    const pointer = { x: e.clientX, y: e.clientY };
    const { pointerId } = e;
    let result: Box[] | null = null;
    let stopScroll: (() => void) | undefined;
    let tallest = 0;

    const update = () => {
      // The page must not get shorter under the pointer
      tallest = Math.max(tallest, grid.offsetHeight);
      grid.style.minHeight = `${tallest}px`;
      const gridBox = grid.getBoundingClientRect();
      // The widget stays inside the window
      const free = grid.clientWidth - cardBox.width;
      const left = Math.max(0, Math.min(free, cardBox.left + pointer.x - from.x - gridBox.left));
      const top = Math.max(0, cardBox.top + pointer.y - from.y - gridBox.top);
      const others = start.boxes.filter((b) => b.id !== id);
      const x = snapColumn(others, Math.round((left - GAP) / start.unit), box.w, start.columns);
      const y = Math.max(0, Math.round((top - GAP) / ROW));
      result = moveBox(start.boxes, id, { x, y });
      setHeld({ ...start, boxes: result, moving: { id, left, top, width: cardBox.width } });
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!stopScroll) {
        if (Math.hypot(pointer.x - from.x, pointer.y - from.y) < DRAG_START) {
          return;
        }

        window.getSelection()?.removeAllRanges();
        scroller.addEventListener('scroll', update);
        stopScroll = scrollWhileDragging(scroller, from.y, pointer, update);
      }

      event.preventDefault();
      update();
    };
    const finish = (keep: boolean) => {
      stop.current = null;
      stopScroll?.();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancel);
      scroller.removeEventListener('scroll', update);
      grid.style.minHeight = '';
      // Dropped where it was: nothing has changed
      const moved = result?.some((b) => {
        const before = start.boxes.find((s) => s.id === b.id)!;
        return b.x !== before.x || b.y !== before.y;
      });
      if (keep && moved) {
        commit(result!, start.unit);
      }

      setHeld(null);
    };
    const up = (event: PointerEvent) => event.pointerId === pointerId && finish(true);
    const cancel = () => finish(false);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stopScroll) {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    stop.current = finish;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
  };

  const nudge = (id: string, direction: Direction) => {
    const next = nudgeBox(arrangement.boxes, id, direction, arrangement.columns);
    if (next !== arrangement.boxes) {
      commit(next, arrangement.unit);
    }
  };

  const startResize = (id: string, corner: 'se' | 'sw'): ResizeSession => {
    const start = arrangement;
    const box = start.boxes.find((b) => b.id === id)!;
    const right = box.x + box.w;
    let result: Box[] | null = null;
    return {
      units: box.w,
      // The corner that isn't dragged stays where it is
      max: corner === 'se' ? start.columns - box.x : right,
      unit: start.unit,
      show: (units, rows) => {
        const x = corner === 'se' ? box.x : right - units;
        result = resizeBox(start.boxes, { id, x, y: box.y, w: units, h: rows });
        setHeld({ ...start, boxes: result, resizing: id });
      },
      end: (keep) => {
        if (keep && result) {
          commit(result, start.unit);
        }

        setHeld(null);
      },
    };
  };

  const places: Places = {
    ...shown,
    moving: shown.moving,
    resizing: shown.resizing,
    boxOf: (id) => shown.boxes.find((b) => b.id === id) ?? arrangement.boxes.find((b) => b.id === id)!,
    startMove,
    nudge,
    startResize,
  };
  return { places, arrangeToFit: arrangeToFit ?? undefined };
};
