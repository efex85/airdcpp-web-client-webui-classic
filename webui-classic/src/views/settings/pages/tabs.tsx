// Which events in chats mark their tab, and with which colors. Changes apply immediately.
import { RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { colorChain, isMarked, TAB_EVENTS, tabEventStyle, type ChatPlace, type TabEvent } from '../../../lib/tabEvents';
import { COLOR_DEFINITIONS, colorOf, isBold, type ColorSettings } from '../../../lib/theme';
import { colorsDoc, useDoc } from '../../../store/docs';
import { Note, Page, Section } from '../form';
import { change, ColorRow, SyncNote, without } from './personal';

const PLACES: [ChatPlace, string][] = [
  ['hub', 'Hub chats'],
  ['pm', 'Private chats'],
];

/** The color that a tab has for the event: its own, or that of the event it follows */
const shownColor = (settings: ColorSettings, event: TabEvent, part: 'bg' | 'text') =>
  colorChain(event.id)
    .map((e) => colorOf(settings, `${e.colors}_${part}`))
    .find(Boolean) ?? colorOf(settings, 'ui_text')!;

const sameAs = (event: TabEvent) => {
  const other = event.fallback && TAB_EVENTS.find((e) => e.id === event.fallback)!;
  return other && `${other.place === 'hub' ? 'hub chats' : 'private chats'}, “${other.label.toLowerCase()}”`;
};

const EventRow = ({ event, settings }: { event: TabEvent; settings: ColorSettings }) => {
  const on = isMarked(settings.highlight, event.id);
  const keys = [`${event.colors}_bg`, `${event.colors}_text`];
  const changed = event.id in settings.highlight || keys.some((k) => k in settings.colors || k in settings.bold);
  const follows = sameAs(event);
  const name = `${event.label} (${event.place === 'hub' ? 'hub chats' : 'private chats'})`;

  const colorField = (part: 'bg' | 'text', label: string) => {
    const key = `${event.colors}_${part}`;
    const own = colorOf(settings, key) !== undefined;
    return (
      <label className="check-field">
        <input
          type="color"
          className={own ? undefined : 'unset'}
          aria-label={`${label}: ${name}`}
          data-color={key}
          disabled={!on}
          value={shownColor(settings, event, part)}
          onChange={(e) => change((c) => ({ ...c, colors: { ...c.colors, [key]: e.target.value } }))}
        />
        {label}
      </label>
    );
  };

  return (
    <div className="tab-event" data-event={event.id}>
      <div className="tab-event-head">
        <label className="check-field grow">
          <input
            type="checkbox"
            aria-label={`Mark the tab: ${name}`}
            checked={on}
            onChange={(e) => change((c) => ({ ...c, highlight: { ...c.highlight, [event.id]: e.target.checked } }))}
          />
          {event.label}
        </label>
        <div className="tab-sample" aria-hidden="true">
          <div className={`tab${on ? ' event' : ''}`} style={on ? (tabEventStyle(event.id) as CSSProperties) : undefined}>
            <span>{event.place === 'hub' ? 'Hub name' : 'Nickname'}</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Back to the default"
          aria-label={`Reset ${name}`}
          disabled={!changed}
          onClick={() =>
            change((c) => ({
              ...c,
              highlight: without(c.highlight as Record<string, boolean>, event.id),
              colors: without(without(c.colors, keys[0]!), keys[1]!),
              bold: without(c.bold, keys[0]!),
            }))
          }
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="tab-event-options">
        {colorField('bg', 'Background')}
        {colorField('text', 'Text color')}
        <label className="check-field">
          <input
            type="checkbox"
            aria-label={`Bold: ${name}`}
            disabled={!on}
            checked={isBold(settings, keys[0]!)}
            onChange={(e) => change((c) => ({ ...c, bold: { ...c.bold, [keys[0]!]: e.target.checked } }))}
          />
          Bold
        </label>
      </div>
      {(event.help || follows) && (
        <p className="field-help">
          {[event.help, follows && `Colors that you haven't set follow ${follows}.`].filter(Boolean).join(' ')}
        </p>
      )}
    </div>
  );
};

export const TabsPage = () => {
  const settings = useDoc(colorsDoc);

  return (
    <Page>
      <SyncNote doc={colorsDoc} />
      <Note>
        A tab is marked when something happens in its chat while another window is shown. If several things have
        happened, the first one in the list that is switched on decides how the tab looks.
      </Note>
      {PLACES.map(([place, title]) => (
        <Section key={place} title={title}>
          <div className="tab-events">
            {TAB_EVENTS.filter((e) => e.place === place).map((event) => (
              <EventRow key={event.id} event={event} settings={settings} />
            ))}
          </div>
        </Section>
      ))}
      <Section title="Menu button on phones">
        <div className="color-list">
          {COLOR_DEFINITIONS.filter((d) => d.key.startsWith('dot_')).map((def) => (
            <ColorRow key={def.key} def={def} settings={settings} />
          ))}
        </div>
        <Note>
          The dot shows that a tab is marked: one color for mentions and private messages, one for everything else.
        </Note>
      </Section>
    </Page>
  );
};
