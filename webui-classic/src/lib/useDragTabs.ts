// Rearranging the tabs by dragging them with the mouse or a pen. Touch gestures are left alone, as they
// scroll the tab bar and open the context menus.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { moveTab, saveTabOrder, useApp } from '../store/app';

/** Movement after which a click becomes a drag (pixels) */
const THRESHOLD = 5;
/** Dragging this close to an end of the bar scrolls it */
const EDGE = 30;
const SCROLL_STEP = 8;

export const useDragTabs = (bar: RefObject<HTMLDivElement | null>) => {
  const [dragged, setDragged] = useState<string | null>(null);
  const stop = useRef<() => void>(undefined);

  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent, key: string) => {
    if (event.button !== 0 || event.pointerType === 'touch' || (event.target as Element).closest('.tab-close')) {
      return;
    }

    stop.current?.();

    const { pointerId, clientX: startX } = event;
    const original = useApp.getState().tabs.indexOf(key);
    let x = startX;
    let dragging = false;
    let frame = 0;

    // The new position is after the tabs whose middle is left of the pointer
    const place = () => {
      const others = [...(bar.current?.querySelectorAll<HTMLElement>('.tab') ?? [])].filter(
        (tab) => tab.dataset.key !== key,
      );
      const index = others.filter((tab) => {
        const box = tab.getBoundingClientRect();
        return box.left + box.width / 2 < x;
      }).length;
      moveTab(key, index);
    };

    const scroll = () => {
      const element = bar.current;
      if (element) {
        const box = element.getBoundingClientRect();
        const direction = x < box.left + EDGE ? -1 : x > box.right - EDGE ? 1 : 0;
        const before = element.scrollLeft;
        element.scrollLeft += direction * SCROLL_STEP;
        if (element.scrollLeft !== before) {
          place();
        }
      }

      frame = requestAnimationFrame(scroll);
    };

    const finish = (keep: boolean) => {
      stop.current = undefined;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('blur', cancel);
      cancelAnimationFrame(frame);
      if (!dragging) {
        return;
      }

      setDragged(null);
      if (!keep) {
        moveTab(key, original);
      } else if (useApp.getState().tabs.indexOf(key) !== original) {
        saveTabOrder();
      }
    };

    /** The click that follows the drag must not do anything */
    const ignoreClick = () => {
      const ignore = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', ignore, true);
      setTimeout(() => window.removeEventListener('click', ignore, true));
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) {
        return;
      }

      // The button was released where it couldn't be noticed
      if (!(e.buttons & 1)) {
        finish(true);
        return;
      }

      x = e.clientX;
      if (!dragging) {
        if (Math.abs(x - startX) < THRESHOLD) {
          return;
        }

        dragging = true;
        setDragged(key);
        frame = requestAnimationFrame(scroll);
      }

      place();
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId === pointerId) {
        if (dragging) {
          ignoreClick();
        }

        finish(true);
      }
    };

    const cancel = () => finish(false);

    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragging) {
        e.stopPropagation();
        finish(false);
        // The button is still held down; releasing it over the tab would otherwise be a click
        window.addEventListener('pointerup', ignoreClick, { capture: true, once: true });
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('blur', cancel);
    stop.current = () => finish(false);
  };

  return { dragged, onPointerDown };
};
