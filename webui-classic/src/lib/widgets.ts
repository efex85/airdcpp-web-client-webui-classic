// The widgets of the Home window

export type WidgetType = 'stats' | 'rss' | 'notes' | 'pms' | 'searches';

export interface Widget {
  /** Letters and digits; also part of the name under which the text of notes is stored */
  id: string;
  type: WidgetType;
  /** Empty: the default title */
  title: string;
  /** Address of the feed (RSS widgets) */
  url: string;
  /** A feed is loaded again when it's older than this (RSS widgets) */
  refresh_minutes: number;
  /** Widgets that are made taller fill this many rows of the window (missing: one) */
  rows?: number;
}

export interface HomeWidgets {
  list: Widget[];
}

export const WIDGET_NAMES: Record<WidgetType, string> = {
  stats: 'System stats',
  rss: 'RSS feed',
  notes: 'Notes',
  pms: 'Recent PMs',
  searches: 'Recent searches',
};

/** Widgets that show the same wherever they are, so there is only one of each */
export const isSingleWidget = (type: WidgetType) => type === 'stats' || type === 'pms' || type === 'searches';

export const MAX_WIDGETS = 50;
export const MAX_NOTE_LENGTH = 60_000;
export const DEFAULT_REFRESH_MINUTES = 60;
export const WIDGET_HEIGHTS: [rows: number, name: string][] = [
  [1, 'Normal'],
  [2, 'Tall (2 boxes)'],
  [3, 'Extra tall (3 boxes)'],
];

/** The statistics are always one row high */
const validRows = (type: WidgetType, rows: unknown): rows is number =>
  type !== 'stats' && WIDGET_HEIGHTS.some(([value]) => value > 1 && value === rows);

export const setWidgetRows = (list: Widget[], id: string, rows: number): Widget[] =>
  list.map((widget) => {
    if (widget.id !== id) {
      return widget;
    }

    const { rows: _, ...normal } = widget;
    return validRows(widget.type, rows) ? { ...normal, rows } : normal;
  });

export const createWidget = (type: WidgetType, id: string, values: Partial<Widget> = {}): Widget => ({
  title: '',
  url: '',
  refresh_minutes: DEFAULT_REFRESH_MINUTES,
  ...values,
  id,
  type,
});

export const DEFAULT_WIDGETS: HomeWidgets = {
  list: [createWidget('stats', 'stats'), createWidget('rss', 'rss1'), createWidget('notes', 'notes1')],
};

export const sanitizeWidgets = (value: unknown): HomeWidgets => {
  const list = (value as { list?: unknown } | null)?.list;
  if (!Array.isArray(list)) {
    return DEFAULT_WIDGETS;
  }

  const ids = new Set<string>();
  const singles = new Set<WidgetType>();
  const widgets = list.flatMap((item: any) => {
    const id = item?.id;
    const type = item?.type as WidgetType;
    if (typeof id !== 'string' || !/^[a-z0-9]{1,40}$/.test(id) || ids.has(id) || !Object.hasOwn(WIDGET_NAMES, type)) {
      return [];
    }

    if (isSingleWidget(type)) {
      if (singles.has(type)) {
        return [];
      }

      singles.add(type);
    }

    ids.add(id);
    const minutes = Math.round(Number(item.refresh_minutes));
    return [
      createWidget(type, id, {
        title: typeof item.title === 'string' ? item.title.slice(0, 100) : '',
        url: typeof item.url === 'string' ? item.url.slice(0, 2000) : '',
        refresh_minutes: minutes >= 1 ? Math.min(minutes, 100_000) : DEFAULT_REFRESH_MINUTES,
        ...(validRows(type, item.rows) ? { rows: item.rows } : {}),
      }),
    ];
  });

  return { list: widgets.slice(0, MAX_WIDGETS) };
};

export const moveWidget = (list: Widget[], id: string, offset: -1 | 1): Widget[] => {
  const from = list.findIndex((w) => w.id === id);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= list.length) {
    return list;
  }

  const next = list.slice();
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
};

export const newWidgetId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => (n % 36).toString(36)).join('');
