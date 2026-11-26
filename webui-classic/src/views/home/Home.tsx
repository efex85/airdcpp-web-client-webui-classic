// The Home window: statistics, feeds and notes
import { Activity, EllipsisVertical, Plus, Rss, StickyNote, X } from 'lucide-react';
import { WIDGET_NAMES, type Widget, type WidgetType } from '../../lib/widgets';
import { useDoc, useDocStatus, widgetsDoc } from '../../store/docs';
import { useFeeds } from '../../store/feeds';
import { openMenu } from '../../store/ui';
import { NotesWidget } from './NotesWidget';
import { RssWidget } from './RssWidget';
import { StatsWidget } from './StatsWidget';
import { addWidget, askRemoveWidget, updateWidget, widgetMenu } from './widgetActions';

const ICONS: Record<WidgetType, typeof Rss> = { stats: Activity, rss: Rss, notes: StickyNote };

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
      {widget.type === 'stats' ? (
        <StatsWidget active={active} />
      ) : widget.type === 'rss' ? (
        <RssWidget widget={widget} active={active} onAddress={(url) => updateWidget(widget.id, { url })} />
      ) : (
        <NotesWidget id={widget.id} title={title} />
      )}
    </section>
  );
};

export const Home = ({ active }: { active: boolean }) => {
  const { list } = useDoc(widgetsDoc);
  const status = useDocStatus(widgetsDoc);

  return (
    <div className="view home">
      <div className="view-buttons home-buttons">
        <button type="button" onClick={() => void addWidget('rss')}>
          <Plus size={13} /> RSS feed
        </button>
        <button type="button" onClick={() => void addWidget('notes')}>
          <Plus size={13} /> Notes
        </button>
        <button type="button" disabled={list.some((w) => w.type === 'stats')} onClick={() => void addWidget('stats')}>
          <Plus size={13} /> System stats
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
          {!list.length && <div className="view-empty">No widgets. Add them with the buttons above.</div>}
        </div>
      </div>
    </div>
  );
};
