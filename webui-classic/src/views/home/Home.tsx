// The Home window: statistics, feeds, notes and recent chats and searches
import { Activity, EllipsisVertical, History, MessagesSquare, Plus, Rss, StickyNote, X } from 'lucide-react';
import { WIDGET_NAMES, type Widget, type WidgetType } from '../../lib/widgets';
import { useDoc, useDocStatus, widgetsDoc } from '../../store/docs';
import { useFeeds } from '../../store/feeds';
import { openMenu } from '../../store/ui';
import { NotesWidget } from './NotesWidget';
import { RecentPmsWidget } from './RecentPmsWidget';
import { RecentSearchesWidget } from './RecentSearchesWidget';
import { RssWidget } from './RssWidget';
import { StatsWidget } from './StatsWidget';
import { addWidgetMenu, askRemoveWidget, updateWidget, widgetMenu } from './widgetActions';

const ICONS: Record<WidgetType, typeof Rss> = {
  stats: Activity,
  rss: Rss,
  notes: StickyNote,
  pms: MessagesSquare,
  searches: History,
};

const Content = ({ widget, title, active }: { widget: Widget; title: string; active: boolean }) => {
  switch (widget.type) {
    case 'stats':
      return <StatsWidget active={active} />;
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

const Card = ({ widget, active }: { widget: Widget; active: boolean }) => {
  const feedTitle = useFeeds((s) => (s[widget.id]?.url === widget.url ? s[widget.id]?.feed?.title : undefined));
  const title = widget.title || (widget.type === 'rss' && feedTitle) || WIDGET_NAMES[widget.type];
  const Icon = ICONS[widget.type];

  return (
    <section
      className={`widget widget-${widget.type}${widget.rows ? ` rows-${widget.rows}` : ''}`}
      aria-label={title}
      data-widget={widget.id}
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
      <Content widget={widget} title={title} active={active} />
    </section>
  );
};

export const Home = ({ active }: { active: boolean }) => {
  const { list } = useDoc(widgetsDoc);
  const status = useDocStatus(widgetsDoc);

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
        <div className="home-grid">
          {list.map((widget) => (
            <Card key={widget.id} widget={widget} active={active} />
          ))}
          {!list.length && <div className="view-empty">No widgets. Add one with the button above.</div>}
        </div>
      </div>
    </div>
  );
};
