// Home and startup, colors, and text of chats
import { RotateCcw } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { SettingDefinition } from '../../../api/settingsTypes';
import { SettingFields } from '../../../components/forms/SettingFields';
import { ThemeScope } from '../../../components/ThemeScope';
import { formatChatTime } from '../../../lib/format';
import { withSearch } from '../../../lib/settingsSearch';
import type { SyncedDoc } from '../../../lib/syncedDoc';
import {
  COLOR_DEFINITIONS,
  colorOf,
  DEFAULT_COLORS,
  isBold,
  PRESETS,
  type ColorDefinition,
  type ColorSettings,
} from '../../../lib/theme';
import { colorsDoc, startupDoc, useDocStatus } from '../../../store/docs';
import { mergeLocalSettings, TEXT_DEFINITIONS, useLocalSettings } from '../../../store/localSettings';
import { textVariables } from '../../../store/theme';
import { confirm } from '../../../store/ui';
import { Fields, Note, Page, Section, useDocForm } from '../form';
import { useLocalForm } from './view';

/** Where the settings of a synced document are stored */
export const SyncNote = <T,>({ doc }: { doc: SyncedDoc<T> }) => {
  const status = useDocStatus(doc);
  return (
    <Note>
      {status === 'local'
        ? 'This client can’t sync these settings, so they are stored in this browser only.'
        : `These settings are the same on all your devices.${status === 'pending' ? ' Saving to the client…' : ''}`}
    </Note>
  );
};

const STARTUP_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'home_enabled',
    title: 'Show the Home tab',
    type: 'boolean',
    default_value: true,
    help: 'Statistics, RSS feeds and notes. It is the first tab after logging in.',
  },
  {
    key: 'open_syslog_at_start',
    title: 'Open the system log after logging in',
    type: 'boolean',
    default_value: true,
    help: 'When disabled, you can still open it from the View menu, the toolbar or the status bar.',
  },
];

const entriesOf = (definitions: SettingDefinition[]) =>
  definitions.map((def) => ({
    title: def.title,
    help: def.help,
    words: def.options?.map((o) => o.name).join(' '),
    selector: `[data-key="${def.key}"]`,
  }));

const Startup = () => {
  const form = useDocForm(startupDoc);
  return (
    <Page form={form}>
      <SyncNote doc={startupDoc} />
      <SettingFields
        definitions={STARTUP_DEFINITIONS}
        values={{ ...form.value }}
        onChange={(key, v) => form.update((value) => ({ ...value, [key]: !!v }))}
      />
    </Page>
  );
};

export const StartupPage = withSearch(Startup, { items: entriesOf(STARTUP_DEFINITIONS) });

const Text = () => {
  const form = useLocalForm(TEXT_DEFINITIONS);
  const saved = useLocalSettings();
  const shown = mergeLocalSettings(saved, form.values);
  const style = Object.fromEntries(
    Object.entries(textVariables(shown)).map(([name, value]) => [name, value ?? 'initial']),
  ) as CSSProperties;
  const time = formatChatTime(Math.floor(Date.now() / 1000), shown.chat_timestamps);

  return (
    <Page form={form}>
      <Note>These settings are stored in this browser, so that a phone and a computer can have different sizes.</Note>
      <Fields form={form} keys={TEXT_DEFINITIONS.map((d) => d.key)} />
      <Section title="Preview">
        <div className="text-preview" aria-label="Preview" style={style}>
          <div className="tabbar">
            <div className="tab active">Shown tab</div>
            <div className="tab">Tab</div>
          </div>
          <div className="text-preview-ui">This is how the text of the interface looks.</div>
          <div className="chat-log preview-chat">
            <div className="line">
              {time && (
                <>
                  <span className="time">[{time}]</span>{' '}
                </>
              )}
              &lt;<span className="nick">Nickname</span>&gt; This is how a chat message looks.
            </div>
          </div>
        </div>
      </Section>
    </Page>
  );
};

export const TextPage = withSearch(Text, { items: entriesOf(TEXT_DEFINITIONS), words: 'font size' });

/** Changes the colors that are being edited on a page */
export type ColorUpdate = (change: (colors: ColorSettings) => ColorSettings) => void;

export const without = <T,>(record: Record<string, T>, key: string) => {
  const next = { ...record };
  delete next[key];
  return next;
};

const choosePreset = async (preset: string, settings: ColorSettings, update: ColorUpdate) => {
  const own = Object.keys(settings.colors).length + Object.keys(settings.bold).length;
  const text = 'Your own color choices are replaced. Nothing is saved before you press “Save changes”.';
  if (own && !(await confirm('Change the color set', text, 'Replace'))) {
    return;
  }

  // Which events mark a tab isn't a matter of colors
  update((c) => ({ ...DEFAULT_COLORS, preset, highlight: c.highlight }));
};

export const ColorRow = ({
  def,
  settings,
  update,
}: {
  def: ColorDefinition;
  settings: ColorSettings;
  update: ColorUpdate;
}) => {
  const value = colorOf(settings, def.key);
  const changed = def.key in settings.colors || def.key in settings.bold;
  return (
    <div className="color-row" data-color={def.key}>
      <input
        type="color"
        aria-label={def.label}
        // Without an own color the field shows a neutral gray
        value={value ?? '#808080'}
        className={value ? undefined : 'unset'}
        onChange={(e) => update((c) => ({ ...c, colors: { ...c.colors, [def.key]: e.target.value } }))}
      />
      <span className="color-label">
        {def.label}
        {!value && <span className="muted">{def.optional}</span>}
        {def.help && <span className="muted">{def.help}</span>}
      </span>
      {def.bold !== undefined && (
        <label className="check-field">
          <input
            type="checkbox"
            aria-label={`Bold: ${def.label}`}
            checked={isBold(settings, def.key)}
            onChange={(e) => update((c) => ({ ...c, bold: { ...c.bold, [def.key]: e.target.checked } }))}
          />
          Bold
        </label>
      )}
      <button
        type="button"
        className="icon-button"
        title="Back to the color of the set"
        aria-label={`Reset ${def.label}`}
        disabled={!changed}
        onClick={() => update((c) => ({ ...c, colors: without(c.colors, def.key), bold: without(c.bold, def.key) }))}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
};

const Line = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`line ${className}`}>
    <span className="time">[12:34:56]</span> {children}
  </div>
);

const Said = ({ nick, type }: { nick: string; type: string }) => (
  <Line>
    &lt;<span className={`nick ${type}`}>{nick}</span>&gt;<span className="preview-text"> Hello</span>
  </Line>
);

/** Shows every color of the page, so that it can be judged before it's saved */
const Preview = ({ colors }: { colors: ColorSettings }) => (
  <ThemeScope colors={colors} className="color-preview" label="Preview">
    <div className="tabbar">
      <div className="tab active">Shown tab</div>
      <div className="tab">Tab</div>
      <div className="tab unread">New messages</div>
      <div className="tab mention">Mention</div>
    </div>
    <div className="chat-log">
      {/* On phones these are shown beside each other, without time and text */}
      <div className="preview-nicks">
        <Said nick="Someone" type="" />
        <Said nick="Me" type="self" />
        <Said nick="Operator" type="op" />
        <Said nick="Bot" type="bot" />
        <Said nick="Favorite" type="favorite" />
        <Said nick="Ignored" type="ignored" />
      </div>
      <Line className="mentioned">
        &lt;<span className="nick">Someone</span>&gt; Hi <span className="mention">Me</span>, see{' '}
        <span className="link">https://example.org</span>
      </Line>
      <Line className="status">*** A status message</Line>
    </div>
    <div className="preview-items">
      <div className="dupe shared">
        <span className="cell">Already shared</span>
      </div>
      <div className="dupe queued">
        <span className="cell">In the download queue</span>
      </div>
      <div className="dupe finished">
        <span className="cell">Downloaded</span>
      </div>
      <div className="preview-selected">Selected item</div>
    </div>
    <div className="preview-controls">
      <input readOnly tabIndex={-1} aria-label="Example input field" value="Input field" />
      <label className="check-field">
        <input type="checkbox" readOnly tabIndex={-1} checked />
        Accent
      </label>
      <span className="preview-button">Button</span>
      <span className="muted">Dimmed text</span>
    </div>
  </ThemeScope>
);

// The colors of the tabs have a page of their own
const PAGE_COLORS = COLOR_DEFINITIONS.filter((d) => d.group !== 'Tabs');

const Colors = () => {
  const form = useDocForm(colorsDoc);
  const settings = form.value;
  const groups = [...new Set(PAGE_COLORS.map((d) => d.group))];
  const own = Object.keys(settings.colors).length + Object.keys(settings.bold).length > 0;

  return (
    <Page form={form}>
      <SyncNote doc={colorsDoc} />
      <div className="field preset-field">
        <label htmlFor="color-preset">Color set</label>
        <select
          id="color-preset"
          value={settings.preset}
          onChange={(e) => void choosePreset(e.target.value, settings, form.update)}
        >
          {Object.entries(PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={!own} onClick={() => void choosePreset(settings.preset, settings, form.update)}>
          Remove my own colors
        </button>
      </div>
      <Note>The colors of marked tabs are chosen on the page “Tab highlights”.</Note>
      <div className="colors-box">
        <div className="colors-layout">
          <Preview colors={settings} />
          <div className="colors-groups">
            {groups.map((group) => (
              <Section key={group} title={group}>
                <div className="color-list">
                  {PAGE_COLORS.filter((d) => d.group === group).map((def) => (
                    <ColorRow key={def.key} def={def} settings={settings} update={form.update} />
                  ))}
                </div>
              </Section>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

export const ColorsPage = withSearch(Colors, {
  words: 'colour theme',
  items: [
    { title: 'Color set', words: Object.values(PRESETS).map((p) => p.name).join(' '), selector: '#color-preset' },
    { title: 'Remove my own colors' },
    ...PAGE_COLORS.map((def) => ({
      title: def.label,
      help: def.help,
      words: `${def.group} color${def.bold === undefined ? '' : ' bold'}`,
      selector: `.color-row[data-color="${def.key}"]`,
    })),
  ],
});
