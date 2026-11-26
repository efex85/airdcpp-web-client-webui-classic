// Adding, changing and removing the widgets of the Home window
import { createWidget, MAX_WIDGETS, moveWidget, newWidgetId, WIDGET_NAMES, type Widget, type WidgetType } from '../../lib/widgets';
import { toast } from '../../store/app';
import { noteDoc, removeWidget, widgetsDoc } from '../../store/docs';
import { confirm, showDialog, type MenuEntry } from '../../store/ui';
import { isFeedAddress } from './RssWidget';

const list = () => widgetsDoc.value.list;

export const updateWidget = (id: string, changes: Partial<Widget>) =>
  widgetsDoc.set({ list: list().map((w) => (w.id === id ? { ...w, ...changes } : w)) });

/** Title, and for feeds the address and interval; null if cancelled */
const askSettings = async (type: WidgetType, widget?: Widget): Promise<Partial<Widget> | null> => {
  let current: Partial<Widget> = widget ?? { title: '', url: '', refresh_minutes: 60 };
  for (;;) {
    const values = await showDialog({
      title: widget ? `${WIDGET_NAMES[type]}: settings` : `Add: ${WIDGET_NAMES[type]}`,
      fields: [
        ...(type === 'rss'
          ? [
              { key: 'url', label: 'Feed address', value: current.url, required: true, placeholder: 'https://…' },
              {
                key: 'refresh_minutes',
                label: 'Refresh interval (minutes)',
                type: 'number' as const,
                value: current.refresh_minutes,
                required: true,
              },
            ]
          : []),
        {
          key: 'title',
          label: 'Title (optional)',
          value: current.title,
          placeholder: type === 'rss' ? 'The title of the feed' : WIDGET_NAMES[type],
        },
      ],
      confirmLabel: widget ? 'Save' : 'Add',
    });
    if (!values) {
      return null;
    }

    current = values;
    if (type !== 'rss') {
      return { title: values.title.trim() };
    }

    const url = String(values.url).trim();
    if (isFeedAddress(url) && values.refresh_minutes >= 1) {
      return { title: values.title.trim(), url, refresh_minutes: Math.round(values.refresh_minutes) };
    }

    toast('Enter an address that starts with http:// or https://, and an interval of at least one minute', true);
  }
};

export const addWidget = async (type: WidgetType) => {
  const values = type === 'rss' ? await askSettings(type) : {};
  if (!values) {
    return;
  }

  if (list().length >= MAX_WIDGETS) {
    toast(`At most ${MAX_WIDGETS} widgets can be added`, true);
    return;
  }

  const widget = createWidget(type, newWidgetId(), values);
  // The statistics are shown first
  widgetsDoc.set({ list: type === 'stats' ? [widget, ...list()] : [...list(), widget] });
  requestAnimationFrame(() =>
    document.querySelector(`[data-widget="${widget.id}"]`)?.scrollIntoView({ block: 'nearest' }),
  );
};

const editWidget = async (widget: Widget) => {
  const values = await askSettings(widget.type, widget);
  if (values) {
    updateWidget(widget.id, values);
  }
};

export const askRemoveWidget = async (widget: Widget, title: string) => {
  const hasContent = widget.type === 'notes' ? !!noteDoc(widget.id).value.trim() : !!widget.url;
  const text =
    widget.type === 'notes'
      ? `Remove “${title}” and its text from all your devices? This can't be undone.`
      : `Remove “${title}” from all your devices?`;
  if (!hasContent || (await confirm('Remove widget', text, 'Remove'))) {
    await removeWidget(widget.id);
  }
};

export const widgetMenu = (widget: Widget, title: string): MenuEntry[] => {
  const index = list().findIndex((w) => w.id === widget.id);
  return [
    ...(widget.type === 'stats'
      ? []
      : [
          {
            label: widget.type === 'rss' ? 'Settings…' : 'Rename…',
            onClick: () => void editWidget(widget),
          },
        ]),
    {
      label: 'Move earlier',
      disabled: index <= 0,
      onClick: () => widgetsDoc.set({ list: moveWidget(list(), widget.id, -1) }),
    },
    {
      label: 'Move later',
      disabled: index >= list().length - 1,
      onClick: () => widgetsDoc.set({ list: moveWidget(list(), widget.id, 1) }),
    },
    'separator',
    { label: 'Remove', onClick: () => void askRemoveWidget(widget, title) },
  ];
};
