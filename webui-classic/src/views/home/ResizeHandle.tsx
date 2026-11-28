// The bottom corners of a widget, which are dragged to change its size

import { useEffect, useRef } from 'react';
import { BOX_UNITS, clampWidth, ROW, snapHeight } from '../../lib/widgetSizes';
import { scrollWhileDragging } from './dragScroll';

export interface Resize {
  /** Only what differs from the size at the start */
  width?: number;
  height?: number;
}

export interface Resizing {
  /** The width in steps at the start */
  units: number;
  /** …and the widest it can become */
  max: number;
  /** Pixels from one width step to the next */
  unit: number;
  change: (size: Resize) => void;
  end: () => void;
}

interface Props {
  corner: 'se' | 'sw';
  title: string;
  /** The smallest width of this widget in steps */
  min: number;
  /** Called when a resize starts */
  begin: () => Resizing;
}

const KEY_STEP = 2 * ROW;

export const ResizeHandle = ({ corner, title, min, begin }: Props) => {
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
    const height = Math.round(widget.getBoundingClientRect().height);
    const from = { x: e.clientX, y: e.clientY - grid.getBoundingClientRect().top };
    const pointer = { x: e.clientX, y: e.clientY };
    const resizing = begin();
    let tallest = 0;

    const update = () => {
      // The page must not get shorter under the pointer: it would scroll, which would change the size again
      tallest = Math.max(tallest, grid.offsetHeight);
      grid.style.minHeight = `${tallest}px`;
      const moved = (pointer.x - from.x) * (corner === 'se' ? 1 : -1);
      const { units, max, unit } = resizing;
      const width = clampWidth(units + Math.round(moved / unit), max, min);
      // Measured from the top of the grid, so that scrolling counts
      const next = snapHeight(height + pointer.y - grid.getBoundingClientRect().top - from.y);
      resizing.change({
        width: width === units ? undefined : width,
        height: next === snapHeight(height) ? undefined : next,
      });
    };

    const stopScroll = scrollWhileDragging(scroller, e.clientY, pointer, update);
    const move = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      update();
    };
    const finish = () => {
      stop.current = null;
      stopScroll();
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('lostpointercapture', finish);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      scroller.removeEventListener('scroll', update);
      grid.style.minHeight = '';
      resizing.end();
    };

    stop.current = finish;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    scroller.addEventListener('scroll', update);
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
    const resizing = begin();
    const width = clampWidth(resizing.units + across, resizing.max, min);
    resizing.change({
      width: width === resizing.units ? undefined : width,
      height: down ? snapHeight(height + down * KEY_STEP) : undefined,
    });
    resizing.end();
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
        keyboard ? `Drag to resize (or use the arrow keys). A normal box is ${BOX_UNITS} steps wide.` : 'Drag to resize'
      }
      onPointerDown={start}
      onKeyDown={keyboard ? key : undefined}
    />
  );
};
