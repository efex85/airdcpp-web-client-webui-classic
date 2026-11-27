import { useEffect, useRef, useState, type RefObject } from 'react';

/** Whether text in the element is selected, or is being selected with the mouse or a finger */
export const useSelecting = (ref: RefObject<HTMLElement | null>) => {
  const [selected, setSelected] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const check = () => {
      const selection = document.getSelection();
      setSelected(
        !!selection && !selection.isCollapsed && selection.rangeCount > 0 && selection.getRangeAt(0).intersectsNode(element),
      );
    };
    const down = (e: PointerEvent) => {
      if (e.button === 0 && !(e.target as Element).closest('button')) {
        setPressed(true);
      }
    };
    const up = () => setPressed(false);

    document.addEventListener('selectionchange', check);
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      document.removeEventListener('selectionchange', check);
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return selected || pressed;
};

/** The value, kept as it was while held: changing text would lose the selection of it */
export const useHeld = <T,>(value: T, held: boolean): T => {
  const kept = useRef(value);
  if (!held) {
    kept.current = value;
  }

  return kept.current;
};
