// The Home window: statistics, feeds, notes and recent chats and searches
import { Activity, EllipsisVertical, History, MessagesSquare, Plus, Rss, StickyNote, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { Direction } from '../../lib/widgetLayout';
import { useIsMobile } from '../../lib/useIsMobile';
import { GAP, heightPixels, minUnits, ROW, rowSpan, sizeOf } from '../../lib/widgetSizes';
import { WIDGET_NAMES, type Widget, type WidgetType } from '../../lib/widgets';
import { useDoc, useDocLoaded, useDocStatus, widgetsDoc } from '../../store/docs';
import { useFeeds } from '../../store/feeds';
import { openMenu } from '../../store/ui';
import { setWidgetSize, useWidgetSizes } from '../../store/widgetSizes';
import { NotesWidget } from './NotesWidget';
import { RecentPmsWidget } from './RecentPmsWidget';
import { RecentSearchesWidget } from './RecentSearchesWidget';
import { ResizeHandle, type Resize, type Resizing } from './ResizeHandle';
import { RssWidget } from './RssWidget';
import { StatsWidget } from './StatsWidget';
import { useHomeGrid } from './useHomeGrid';
import { useWidgetPlaces, type Places } from './useWidgetPlaces';
import { addWidgetMenu, askRemoveWidget, updateWidget, widgetMenu } from './widgetActions';

const ICONS: Record<WidgetType, typeof Rss> = {
  stats: Activity,
  rss: Rss,
  notes: StickyNote,
  pms: MessagesSquare,
  searches: History,
};

interface ContentProps {
  widget: Widget;
  title: string;
  active: boolean;
  measure: (element: HTMLElement | null) => void;
}

/** The information scrolls if the box is too low for it; the buttons stay at the bottom of the box */
const Statistics = ({ active, measure }: Pick<ContentProps, 'active' | 'measure'>) => {
  const [actions, setActions] = useState<HTMLElement | null>(null);
  return (
    <>
      <div className="widget-scroll">
        <div ref={measure}>
          <StatsWidget active={active} actions={actions} />
        </div>
      </div>
      <div className="stats-actions" ref={setActions} />
    </>
  );
};

const Content = ({ widget, title, active, measure }: ContentProps) => {
  switch (widget.type) {
    case 'stats':
      return <Statistics active={active} measure={measure} />;
    case 'rss':
      return <RssWidget widget={widget} active={active} onAddress={(url) => updateWidget(widget.id, { url })} />;
    case 'notes':
      return <NotesWidget id={widget.id} title={title} />;
    case 'pms':
      return <RecentPmsWidget active={active} />;
    case 'searches':
      return <RecentSearchesWidget active={active} />;
  }
};

const widgetIcon = (type: WidgetType) => {
  const Icon = ICONS[type];
  return <Icon size={14} className={`i-widget-${type}`} />;
};

const ARROWS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

interface CardProps {
  widget: Widget;
  active: boolean;
  /** null on phones and in narrow windows, where the boxes are stacked and size themselves */
  places: Places | null;
  /** On large screens */
  arrangeToFit: (() => void) | undefined;
  /** The height of a normal box on a large screen */
  normal: number;
  measure: (element: HTMLElement | null) => void;
}

const Card = ({ widget, active, places, arrangeToFit, normal, measure }: CardProps) => {
  // Of the stored sizes, so the selector returns the same object every time
  const size = sizeOf(
    useWidgetSizes((s) => s.sizes),
    widget,
  );
  const feedTitle = useFeeds((s) => (s[widget.id]?.url === widget.url ? s[widget.id]?.feed?.title : undefined));
  const title = widget.title || (widget.type === 'rss' && feedTitle) || WIDGET_NAMES[widget.type];
  const Icon = ICONS[widget.type];
  const moving = places?.moving?.id === widget.id ? places.moving : undefined;

  let style: CSSProperties | undefined;
  let handles = null;
  if (places) {
    const box = places.boxOf(widget.id);
    const height = heightPixels(size, normal);
    style = moving
      ? { position: 'absolute', left: moving.left, top: moving.top, width: moving.width, height }
      : { gridColumn: `${box.x + 1} / span ${box.w}`, gridRow: `${box.y + 1} / span ${rowSpan(height)}`, height };

    const begin = (corner: 'se' | 'sw'): Resizing => {
      const session = places.startResize(widget.id, corner);
      return {
        units: session.units,
        max: session.max,
        unit: session.unit,
        end: () => session.end(true),
        // What isn't changed stays as it was when the resize started
        change: ({ width, height: pixels }: Resize) => {
          const next = { ...size };
          if (width !== undefined) {
            next.w = width;
          }

          if (widget.type === 'stats') {
            // Its height no longer follows its content, and the other boxes keep their height
            if (width !== undefined || pixels !== undefined) {
              next.h = pixels ?? height;
              next.others = size.others ?? normal;
            }
          } else if (pixels !== undefined) {
            next.h = pixels;
            delete next.rows;
          }

          setWidgetSize(widget.id, next);
          session.show(width ?? session.units, rowSpan(heightPixels(next, normal)));
        },
      };
    };

    handles = (['sw', 'se'] as const).map((corner) => (
      <ResizeHandle
        key={corner}
        corner={corner}
        title={title}
        min={minUnits(widget.type)}
        begin={() => begin(corner)}
      />
    ));
  }

  const state = moving ? ' moving' : places?.resizing === widget.id ? ' resizing' : '';
  return (
    <section
      className={`widget widget-${widget.type}${state}`}
      aria-label={title}
      data-widget={widget.id}
      style={style}
    >
      <header onPointerDown={places ? (e) => places.startMove(widget.id, e) : undefined}>
        {places ? (
          <button
            type="button"
            className="widget-grip"
            title="Drag the title bar to move (or use the arrow keys)"
            aria-label={`Move ${title}`}
            onKeyDown={(e) => {
              const direction = ARROWS[e.key];
              if (direction && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                places.nudge(widget.id, direction);
                const card = e.currentTarget.closest('.widget')!;
                requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest' }));
              }
            }}
          >
            <Icon size={14} className={`i-widget-${widget.type}`} />
          </button>
        ) : (
          <Icon size={14} className={`i-widget-${widget.type}`} />
        )}
        <h2 className="grow">{title}</h2>
        <button
          type="button"
          className="icon-button"
          title="Widget options"
          aria-label={`Options of ${title}`}
          onClick={(e) =>
            openMenu(
              { x: e.clientX, y: e.clientY },
              widgetMenu(widget, title, !!places, arrangeToFit),
              undefined,
              title,
            )
          }
        >
          <EllipsisVertical size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Remove widget"
          aria-label={`Remove ${title}`}
          onClick={() => void askRemoveWidget(widget, title)}
        >
          <X size={14} />
        </button>
      </header>
      <Content widget={widget} title={title} active={active} measure={measure} />
      {handles}
    </section>
  );
};

/** Where a dragged widget will be put */
const Placeholder = ({ places }: { places: Places }) => {
  const box = places.boxOf(places.moving!.id);
  return (
    <div
      className="widget-placeholder"
      aria-hidden
      style={{
        gridColumn: `${box.x + 1} / span ${box.w}`,
        gridRow: `${box.y + 1} / span ${box.h}`,
        height: box.h * ROW - GAP,
      }}
    />
  );
};

export const Home = ({ active }: { active: boolean }) => {
  const { list, ordered } = useDoc(widgetsDoc);
  const status = useDocStatus(widgetsDoc);
  const loaded = useDocLoaded(widgetsDoc);
  const mobile = useIsMobile();
  const sizes = useWidgetSizes((s) => s.sizes);
  const statistics = list.find((w) => w.type === 'stats');
  const { width, scale, normal, setGrid, setStatistics } = useHomeGrid(statistics && sizes[statistics.id]?.others);
  const { places, arrangeToFit } = useWidgetPlaces({
    list,
    sizes,
    normal,
    scale,
    width,
    mobile,
    active,
    loaded,
    ordered: !!ordered,
  });
  // A large screen on which the widgets don't fit side by side
  const stacked = !mobile && width > 0 && !places && list.length > 0;
  const className = places ? ` sized${places.moving ? ' dragging' : ''}` : stacked ? ' stacked' : '';

  return (
    <div className="view home">
      <div className="view-buttons home-buttons">
        <button
          type="button"
          aria-haspopup="menu"
          onClick={(e) => {
            // Below the button, also when it's used with the keyboard; a sheet on phones
            const box = e.currentTarget.getBoundingClientRect();
            openMenu({ x: box.left, y: box.bottom }, addWidgetMenu(widgetIcon), undefined, 'Add widget');
          }}
        >
          <Plus size={13} /> Add widget
        </button>
        <span className="muted grow home-sync">
          {status === 'local' && 'This client can’t sync: saved in this browser only'}
        </span>
      </div>
      <div className="home-scroll">
        <div
          ref={setGrid}
          className={`home-grid${className}`}
          style={
            places
              ? ({
                  '--home-columns': places.columns,
                  '--home-step': `${places.unit - GAP}px`,
                } as CSSProperties)
              : undefined
          }
        >
          {list.map((widget) => (
            <Card
              key={widget.id}
              widget={widget}
              active={active}
              places={places}
              arrangeToFit={arrangeToFit}
              normal={normal}
              measure={setStatistics}
            />
          ))}
          {places?.moving && <Placeholder places={places} />}
          {!list.length && <div className="view-empty">No widgets. Add one with the button above.</div>}
        </div>
      </div>
    </div>
  );
};
