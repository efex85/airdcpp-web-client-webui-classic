// The widget sizes of this browser

import { create } from 'zustand';
import { load, save } from '../lib/storage';
import { sanitizeSizes, type WidgetSize, type WidgetSizes } from '../lib/widgetSizes';

const KEY = 'widgetSizes';

export const useWidgetSizes = create<{ sizes: WidgetSizes }>(() => ({ sizes: sanitizeSizes(load(KEY, {})) }));

const store = (sizes: WidgetSizes) => {
  useWidgetSizes.setState({ sizes });
  save(KEY, sizes);
};

/** An empty size is the normal one */
export const setWidgetSize = (id: string, size: WidgetSize) =>
  store({ ...useWidgetSizes.getState().sizes, [id]: size });

export const forgetWidgetSize = (id: string) => {
  const { [id]: _, ...others } = useWidgetSizes.getState().sizes;
  store(others);
};
