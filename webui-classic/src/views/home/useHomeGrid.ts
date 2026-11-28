// What the sizes of the widgets depend on: the width of the window and the height of the statistics

import { useEffect, useLayoutEffect, useState } from 'react';
import { GAP, NORMAL_HEIGHT, normalHeight } from '../../lib/widgetSizes';
import { useLocalSettings } from '../../store/localSettings';

/**
 * `others` is the height that the other boxes keep after System information has got its own height.
 * Until then all normal boxes are as high as it needs.
 */
export const useHomeGrid = (others: number | undefined) => {
  const [grid, setGrid] = useState<HTMLElement | null>(null);
  /** Around the content of System information; null without that widget */
  const [statistics, setStatistics] = useState<HTMLElement | null>(null);
  /** Without the padding */
  const [width, setWidth] = useState(0);
  const [needed, setNeeded] = useState(0);
  const scale = useLocalSettings((s) => s.ui_text_size) / 100;

  // A hidden window has no size: the last one is kept
  useLayoutEffect(() => {
    if (!grid) {
      return;
    }

    const measure = () => grid.clientWidth && setWidth(grid.clientWidth - 2 * GAP);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);

  useEffect(() => {
    if (!statistics) {
      setNeeded(0);
      return;
    }

    const box = statistics.closest('.widget')!;
    const header = box.querySelector('header')!;
    const actions = box.querySelector<HTMLElement>('.stats-actions')!;
    const measure = () => {
      if (statistics.offsetHeight) {
        // With the borders of the box
        setNeeded(header.offsetHeight + statistics.offsetHeight + actions.offsetHeight + 2);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(statistics);
    observer.observe(actions);
    return () => observer.disconnect();
  }, [statistics]);

  return {
    width,
    scale,
    normal: normalHeight(Math.max(NORMAL_HEIGHT * scale, statistics ? (others ?? needed) : 0)),
    setGrid,
    setStatistics,
  };
};
