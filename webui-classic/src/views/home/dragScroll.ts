// Scrolls the Home window while a widget is dragged near its top or bottom

/** Dragging closer than this to the edge of the window scrolls */
const SCROLL_EDGE = 28;
/** …if the pointer has also moved this far towards the edge, so that a drag across doesn't scroll */
const SCROLL_START = 8;
const SCROLL_STEP = 10;

/**
 * Runs until the returned function is called. `startY` and `pointer` are positions on the screen; `scrolled` is
 * called after every step.
 */
export const scrollWhileDragging = (
  scroller: HTMLElement,
  startY: number,
  pointer: { y: number },
  scrolled: () => void,
): (() => void) => {
  let frame = 0;
  const scroll = () => {
    const view = scroller.getBoundingClientRect();
    const direction =
      pointer.y > view.bottom - SCROLL_EDGE && pointer.y > startY + SCROLL_START
        ? 1
        : pointer.y < view.top + SCROLL_EDGE && pointer.y < startY - SCROLL_START
          ? -1
          : 0;
    if (direction) {
      const before = scroller.scrollTop;
      scroller.scrollTop += direction * SCROLL_STEP;
      if (scroller.scrollTop !== before) {
        scrolled();
      }
    }

    frame = requestAnimationFrame(scroll);
  };

  frame = requestAnimationFrame(scroll);
  return () => cancelAnimationFrame(frame);
};
