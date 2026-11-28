// The places of the widgets in this browser

import { create } from 'zustand';
import { load, save } from '../lib/storage';
import { sanitizeLayout, type Layout } from '../lib/widgetLayout';

const KEY = 'widgetLayout';

/** Widgets added in this browser that don't have a place yet */
export const addedHere = new Set<string>();

export const useWidgetLayout = create<{ layout: Layout | null }>(() => ({ layout: sanitizeLayout(load(KEY, null)) }));

export const setWidgetLayout = (layout: Layout) => {
  useWidgetLayout.setState({ layout });
  save(KEY, layout);
};

export const forgetWidgetPlace = (id: string) => {
  const { layout } = useWidgetLayout.getState();
  if (layout && Object.hasOwn(layout.items, id)) {
    const { [id]: _, ...items } = layout.items;
    setWidgetLayout({ ...layout, items });
  }
};
