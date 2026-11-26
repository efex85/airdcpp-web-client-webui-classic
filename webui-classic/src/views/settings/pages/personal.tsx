// Home and startup, colors, and text of chats. These pages apply changes immediately.
import { RotateCcw } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import type { SettingDefinition } from '../../../api/settingsTypes';
import { SettingFields } from '../../../components/forms/SettingFields';
import { Time } from '../../../components/Time';
import {
  COLOR_DEFINITIONS,
  colorOf,
  DEFAULT_COLORS,
  isBold,
  PRESETS,
  type ColorDefinition,
  type ColorSettings,
} from '../../../lib/theme';
import { colorsDoc, startupDoc, useDoc, useDocStatus } from '../../../store/docs';
import { saveLocalSettings, TEXT_DEFINITIONS, useLocalSettings } from '../../../store/localSettings';
import { confirm } from '../../../store/ui';
import type { SyncedDoc } from '../../../lib/syncedDoc';
import { Note, Page, Section } from '../form';

const SyncNote = <T,>({ doc }: { doc: SyncedDoc<T> }) => {
  const status = useDocStatus(doc);
  return (
    <Note>
      {status === 'local'
        ? 'Changes apply immediately. This client can’t sync them, so they are stored in this browser only.'
        : `Changes apply immediately and are the same on all your devices.${status === 'pending' ? ' Saving…' : ''}`}
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

export const StartupPage = () => {
  const value = useDoc(startupDoc);
  return (
    <Page>
      <SyncNote doc={startupDoc} />
      <SettingFields
        definitions={STARTUP_DEFINITIONS}
        values={{ ...value }}
        onChange={(key, v) => startupDoc.set({ ...startupDoc.value, [key]: !!v })}
      />
    </Page>
  );
};

export const TextPage = () => {
  const values = useLocalSettings();
  return (
    <Page>
      <Note>
        Changes apply immediately. These settings are stored in this browser, so that a phone and a computer can have
        different sizes.
      </Note>
      <SettingFields
        definitions={TEXT_DEFINITIONS}
        values={{ ...values }}
        onChange={(key, value) => saveLocalSettings({ [key]: value })}
      />
      <Section title="Preview">
        <div className="chat-log preview-chat">
          <div className="line">
            <Time value={Math.floor(Date.now() / 1000)} />
            &lt;<span className="nick">Nickname</span>&gt; This is how a chat message looks.
          </div>
        </div>
      </Section>
    </Page>
  );
};

const change = (update: (colors: ColorSettings) => ColorSettings) => colorsDoc.set(update(colorsDoc.value));

const without = <T,>(record: Record<string, T>, key: string) => {
  const next = { ...record };
  delete next[key];
  return next;
};

const choosePreset = async (preset: string) => {
  const { colors, bold } = colorsDoc.value;
  const own = Object.keys(colors).length + Object.keys(bold).length;
  if (own && !(await confirm('Change the color set', 'Your own color choices are replaced. Continue?', 'Replace'))) {
    return;
  }

  colorsDoc.set({ ...DEFAULT_COLORS, preset });
};

const ColorRow = ({ def, settings }: { def: ColorDefinition; settings: ColorSettings }) => {
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
        onChange={(e) => change((c) => ({ ...c, colors: { ...c.colors, [def.key]: e.target.value } }))}
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
            onChange={(e) => change((c) => ({ ...c, bold: { ...c.bold, [def.key]: e.target.checked } }))}
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
        onClick={() => change((c) => ({ ...c, colors: without(c.colors, def.key), bold: without(c.bold, def.key) }))}
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

const Said = ({ nick, type, text = 'Hello' }: { nick: string; type: string; text?: string }) => (
  <Line>
    &lt;<span className={`nick ${type}`}>{nick}</span>&gt; {text}
  </Line>
);

const Preview = () => (
  <div className="color-preview" aria-label="Preview">
    <div className="tabbar">
      <div className="tab active">Shown tab</div>
      <div className="tab">Tab</div>
      <div className="tab unread">New messages</div>
      <div className="tab mention">Mention</div>
    </div>
    <div className="chat-log">
      <Said nick="Someone" type="" />
      <Said nick="Me" type="self" />
      <Said nick="Operator" type="op" />
      <Said nick="Bot" type="bot" />
      <Said nick="Favorite" type="favorite" />
      <Said nick="Ignored" type="ignored" />
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
  </div>
);

export const ColorsPage = () => {
  const settings = useDoc(colorsDoc);
  const groups = [...new Set(COLOR_DEFINITIONS.map((d) => d.group))];
  const own = Object.keys(settings.colors).length + Object.keys(settings.bold).length > 0;

  return (
    <Page>
      <SyncNote doc={colorsDoc} />
      <div className="field preset-field">
        <label htmlFor="color-preset">Color set</label>
        <select id="color-preset" value={settings.preset} onChange={(e) => void choosePreset(e.target.value)}>
          {Object.entries(PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={!own} onClick={() => void choosePreset(settings.preset)}>
          Remove my own colors
        </button>
      </div>
      <Preview />
      {groups.map((group) => (
        <Fragment key={group}>
          <Section title={group}>
            <div className="color-list">
              {COLOR_DEFINITIONS.filter((d) => d.group === group).map((def) => (
                <ColorRow key={def.key} def={def} settings={settings} />
              ))}
            </div>
          </Section>
        </Fragment>
      ))}
    </Page>
  );
};
