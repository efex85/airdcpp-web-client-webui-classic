// The bottom corners of a widget, which are dragged to change its size

import { useEffect, useRef } from 'react';
import { BOX_UNITS, clampWidth, GAP, ROW, snapHeight } from '../../lib/widgetSizes';

/** Where a widget is held while it's resized, so that it doesn't jump away from the pointer */
export interface Place {
  column: number;
  row: number;
}

export interface Resize {
  /** Only what differs from the size at the start */
  width?: number;
  height?: number;
}

interface Props {
  corner: 'se' | 'sw';
  title: string;
  columns: number;
  /** The present width in steps */
  units: number;
  /** The smallest width of this widget in steps */
  min: number;
  /** Called when a resize starts; returns the function that applies a size */
  begin: () => (size: Resize) => void;
  hold: (place: Place | null) => void;
}

/** Dragging closer than this to the edge of the window scrolls */
const SCROLL_EDGE = 28;
/** …if the pointer has also moved this far towards the edge, so that a drag across doesn't scroll */
const SCROLL_START = 8;
const SCROLL_STEP = 10;
const KEY_STEP = 2 * ROW;

export const ResizeHandle = ({ corner, title, columns, units, min, begin, hold }: Props) => {
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || stop.current) {
      return;
    }

    e.preventDefault();
    const handle = e.currentTarget;
    const widget = handle.closest<HTMLElement>('.widget')!;
    const grid = widget.parentElement!;
    const scroller = grid.parentElement!;
    const gridBox = grid.getBoundingClientRect();
    const box = widget.getBoundingClientRect();
    // The distance from one width step to the next
    const step = (grid.clientWidth - 2 * GAP + GAP) / columns;
    const column = Math.round((box.left - gridBox.left - GAP) / step) + 1;
    const row = Math.round((box.top - gridBox.top - GAP) / ROW) + 1;
    const height = Math.round(box.height);
    const from = { x: e.clientX, y: e.clientY - gridBox.top, screenY: e.clientY };
    const pointer = { x: e.clientX, y: e.clientY };
    const apply = begin();
    let tallest = 0;
    let frame = 0;

    const update = () => {
      // The page must not get shorter under the pointer: it would scroll, which would change the size again
      tallest = Math.max(tallest, grid.offsetHeight);
      grid.style.minHeight = `${tallest}px`;
      const moved = (pointer.x - from.x) * (corner === 'se' ? 1 : -1);
      const width = clampWidth(units + Math.round(moved / step), columns, min);
      // Measured from the top of the grid, so that scrolling counts
      const next = snapHeight(height + pointer.y - grid.getBoundingClientRect().top - from.y);
      // The corner that isn't dragged stays where it is
      hold({
        column: corner === 'se' ? Math.min(column, columns - width + 1) : Math.max(1, column + units - width),
        row,
      });
      apply({
        width: width === units ? undefined : width,
        height: next === snapHeight(height) ? undefined : next,
      });
    };

    const scroll = () => {
      const view = scroller.getBoundingClientRect();
      const direction =
        pointer.y > view.bottom - SCROLL_EDGE && pointer.y > from.screenY + SCROLL_START
          ? 1
          : pointer.y < view.top + SCROLL_EDGE && pointer.y < from.screenY - SCROLL_START
            ? -1
            : 0;
      if (direction) {
        const before = scroller.scrollTop;
        scroller.scrollTop += direction * SCROLL_STEP;
        if (scroller.scrollTop !== before) {
          update();
        }
      }

      frame = requestAnimationFrame(scroll);
    };

    const move = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      update();
    };
    const finish = () => {
      stop.current = null;
      cancelAnimationFrame(frame);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('lostpointercapture', finish);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      scroller.removeEventListener('scroll', update);
      grid.style.minHeight = '';
      hold(null);
    };

    stop.current = finish;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    scroller.addEventListener('scroll', update);
    frame = requestAnimationFrame(scroll);
  };

  const key = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const across = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const down = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if ((!across && !down) || e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    e.preventDefault();
    const widget = e.currentTarget.closest<HTMLElement>('.widget')!;
    const height = widget.offsetHeight;
    const width = clampWidth(units + across, columns, min);
    begin()({
      width: width === units ? undefined : width,
      height: down ? snapHeight(height + down * KEY_STEP) : undefined,
    });
    requestAnimationFrame(() => widget.scrollIntoView({ block: 'nearest' }));
  };

  // One of the two corners can be reached with the keyboard
  const keyboard = corner === 'se';
  return (
    <button
      type="button"
      className={`widget-resize ${corner}`}
      aria-label={keyboard ? `Resize ${title}` : undefined}
      aria-hidden={keyboard ? undefined : true}
      tabIndex={keyboard ? 0 : -1}
      title={
        keyboard
          ? `Drag to resize (or use the arrow keys). A normal box is ${BOX_UNITS} steps wide.`
          : 'Drag to resize'
      }
      onPointerDown={start}
      onKeyDown={keyboard ? key : undefined}
    />
  );
};
