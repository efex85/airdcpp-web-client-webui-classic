// The Home window: statistics, feeds, notes and recent chats and searches
import { Activity, EllipsisVertical, History, MessagesSquare, Plus, Rss, StickyNote, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useIsMobile } from '../../lib/useIsMobile';
import { heightPixels, minUnits, rowSpan, sizeOf, widthUnits, type WidgetSize } from '../../lib/widgetSizes';
import { WIDGET_NAMES, type Widget, type WidgetType } from '../../lib/widgets';
import { useDoc, useDocStatus, widgetsDoc } from '../../store/docs';
import { useFeeds } from '../../store/feeds';
import { openMenu } from '../../store/ui';
import { setWidgetSize, useWidgetSizes } from '../../store/widgetSizes';
import { NotesWidget } from './NotesWidget';
import { RecentPmsWidget } from './RecentPmsWidget';
import { RecentSearchesWidget } from './RecentSearchesWidget';
import { ResizeHandle, type Place, type Resize } from './ResizeHandle';
import { RssWidget } from './RssWidget';
import { StatsWidget } from './StatsWidget';
import { useHomeGrid } from './useHomeGrid';
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

const Content = ({ widget, title, active, measure }: ContentProps) => {
  switch (widget.type) {
    case 'stats':
      return (
        <div className="widget-scroll">
          <div ref={measure}>
            <StatsWidget active={active} />
          </div>
        </div>
      );
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

/** The size of a box on a large screen */
interface Sizing {
  columns: number;
  normal: number;
  size: WidgetSize;
}

interface CardProps {
  widget: Widget;
  active: boolean;
  /** null on phones, where the boxes size themselves */
  sizing: Sizing | null;
  measure: (element: HTMLElement | null) => void;
}

const Card = ({ widget, active, sizing, measure }: CardProps) => {
  // While the box is resized
  const [place, setPlace] = useState<Place | null>(null);
  const feedTitle = useFeeds((s) => (s[widget.id]?.url === widget.url ? s[widget.id]?.feed?.title : undefined));
  const title = widget.title || (widget.type === 'rss' && feedTitle) || WIDGET_NAMES[widget.type];
  const Icon = ICONS[widget.type];

  let style: CSSProperties | undefined;
  let handles = null;
  if (sizing) {
    const { columns, normal, size } = sizing;
    const min = minUnits(widget.type);
    const units = widthUnits(size, columns, min);
    const height = heightPixels(size, normal);
    style = {
      gridColumn: place ? `${place.column} / span ${units}` : `span ${units}`,
      gridRow: place ? `${place.row} / span ${rowSpan(height)}` : `span ${rowSpan(height)}`,
      height,
    };

    // What isn't changed stays as it was when the resize started
    const begin = () => ({ width, height: pixels }: Resize) => {
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
    };

    handles = (['sw', 'se'] as const).map((corner) => (
      <ResizeHandle
        key={corner}
        corner={corner}
        title={title}
        columns={columns}
        units={units}
        min={min}
        begin={begin}
        hold={setPlace}
      />
    ));
  }

  return (
    <section
      className={`widget widget-${widget.type}${place ? ' resizing' : ''}`}
      aria-label={title}
      data-widget={widget.id}
      style={style}
    >
      <header>
        <Icon size={14} className={`i-widget-${widget.type}`} />
        <h2 className="grow">{title}</h2>
        <button
          type="button"
          className="icon-button"
          title="Widget options"
          aria-label={`Options of ${title}`}
          onClick={(e) => openMenu({ x: e.clientX, y: e.clientY }, widgetMenu(widget, title), undefined, title)}
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

export const Home = ({ active }: { active: boolean }) => {
  const { list } = useDoc(widgetsDoc);
  const status = useDocStatus(widgetsDoc);
  const mobile = useIsMobile();
  const sizes = useWidgetSizes((s) => s.sizes);
  const statistics = list.find((w) => w.type === 'stats');
  const { columns, normal, setGrid, setStatistics } = useHomeGrid(statistics && sizes[statistics.id]?.others);
  const sized = !mobile && columns > 0 && list.length > 0;

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
          className={`home-grid${sized ? ' sized' : ''}`}
          style={sized ? ({ '--home-columns': columns } as CSSProperties) : undefined}
        >
          {list.map((widget) => (
            <Card
              key={widget.id}
              widget={widget}
              active={active}
              sizing={sized ? { columns, normal, size: sizeOf(sizes, widget) } : null}
              measure={setStatistics}
            />
          ))}
          {!list.length && <div className="view-empty">No widgets. Add one with the button above.</div>}
        </div>
      </div>
    </div>
  );
};
