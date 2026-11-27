// Which keys and mouse buttons do what
import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { isMac } from '../../../lib/platform';
import { withSearch } from '../../../lib/settingsSearch';
import {
  assign,
  combinationLabel,
  combinationOf,
  combinationProblem,
  resetAction,
  setEnabled,
  SHORTCUT_ACTIONS,
  SHORTCUT_DEFAULTS,
  shortcutOf,
  type ShortcutAction,
  type ShortcutSettings,
  type ThumbButton,
} from '../../../lib/shortcuts';
import { equal } from '../../../lib/merge';
import { shortcutsDoc } from '../../../store/docs';
import { Note, Page, Section, useDocForm } from '../form';
import { SyncNote } from './personal';

const MOUSE_NAMES: Record<ThumbButton, string> = { back: 'Back button', forward: 'Forward button' };

interface RecorderProps {
  label: string;
  keys: string;
  disabled: boolean;
  onKeys: (keys: string) => void;
  onButton: (button: ThumbButton) => void;
  onMessage: (message: string) => void;
}

/** Shows the keys of a shortcut; click it and press new ones */
const Recorder = ({ label, keys, disabled, onKeys, onButton, onMessage }: RecorderProps) => {
  const [recording, setRecording] = useState(false);
  const stop = () => {
    setRecording(false);
    onMessage('');
  };

  return (
    <button
      type="button"
      className={`shortcut-keys${recording ? ' recording' : ''}${keys ? '' : ' unset'}`}
      data-recording={recording}
      aria-label={`Keys: ${label}`}
      disabled={disabled}
      onClick={() => setRecording(true)}
      onBlur={() => recording && stop()}
      onKeyDown={(e) => {
        const plain = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
        // Tab moves on as usual
        if (!recording || (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (plain && e.key === 'Escape') {
          stop();
          return;
        }

        if (plain && (e.key === 'Backspace' || e.key === 'Delete')) {
          stop();
          onKeys('');
          return;
        }

        const combination = combinationOf(e.nativeEvent);
        if (!combination) {
          return;
        }

        const problem = combinationProblem(combination);
        if (problem) {
          onMessage(`${combinationLabel(combination, isMac)}: ${problem}`);
        } else {
          stop();
          onKeys(combination);
        }
      }}
      // Releasing the space bar would otherwise click the button again
      onKeyUp={(e) => e.preventDefault()}
      onMouseDown={(e) => recording && (e.button === 3 || e.button === 4) && e.preventDefault()}
      onMouseUp={(e) => {
        if (recording && (e.button === 3 || e.button === 4)) {
          e.preventDefault();
          stop();
          onButton(e.button === 3 ? 'back' : 'forward');
        }
      }}
    >
      {recording ? 'Press keys… (Esc cancels)' : combinationLabel(keys, isMac) || 'None'}
    </button>
  );
};

interface RowProps {
  action: ShortcutAction;
  settings: ShortcutSettings;
  message: string;
  change: (result: { settings: ShortcutSettings; taken?: ShortcutAction[] }, taken?: string) => void;
  onMessage: (message: string) => void;
}

const Row = ({ action, settings, message, change, onMessage }: RowProps) => {
  const shortcut = shortcutOf(settings, action);
  const changed = !!settings.changes[action.id];

  return (
    <div className="shortcut" data-shortcut={action.id}>
      <label className="check-field shortcut-name">
        <input
          type="checkbox"
          aria-label={`Use the shortcut: ${action.label}`}
          checked={shortcut.enabled}
          onChange={(e) => change({ settings: setEnabled(settings, action.id, e.target.checked) })}
        />
        {action.label}
      </label>
      <Recorder
        label={action.label}
        keys={shortcut.key}
        disabled={!settings.keyboard || !shortcut.enabled}
        onKeys={(keys) => change(assign(settings, action.id, 'key', keys), combinationLabel(keys, isMac))}
        onButton={(button) => change(assign(settings, action.id, 'mouse', button), MOUSE_NAMES[button])}
        onMessage={onMessage}
      />
      <button
        type="button"
        className="icon-button"
        title="Remove the keys"
        aria-label={`Remove the keys: ${action.label}`}
        disabled={!settings.keyboard || !shortcut.enabled || !shortcut.key}
        onClick={() => change(assign(settings, action.id, 'key', ''))}
      >
        <X size={13} />
      </button>
      <select
        aria-label={`Mouse button: ${action.label}`}
        value={shortcut.mouse}
        disabled={!settings.mouse || !shortcut.enabled}
        onChange={(e) => {
          const button = e.target.value as ThumbButton | '';
          change(assign(settings, action.id, 'mouse', button), button ? MOUSE_NAMES[button] : '');
        }}
      >
        <option value="">No button</option>
        <option value="back">{MOUSE_NAMES.back}</option>
        <option value="forward">{MOUSE_NAMES.forward}</option>
      </select>
      <button
        type="button"
        className="icon-button"
        title="Back to the default"
        aria-label={`Reset: ${action.label}`}
        disabled={!changed}
        onClick={() => change(resetAction(settings, action.id), 'Its default')}
      >
        <RotateCcw size={13} />
      </button>
      {message && (
        <p className="shortcut-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
};

const Shortcuts = () => {
  const form = useDocForm(shortcutsDoc);
  const settings = form.value;
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  const toggle = (key: 'keyboard' | 'mouse', title: string) => (
    <label className="check-field" data-key={`shortcuts_${key}`}>
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => form.update((s) => ({ ...s, [key]: e.target.checked }))}
      />
      {title}
    </label>
  );

  return (
    <Page form={form}>
      <SyncNote doc={shortcutsDoc} />
      {toggle('keyboard', 'Keyboard shortcuts')}
      {toggle('mouse', 'Thumb buttons of the mouse (back and forward)')}
      <Note>
        To change the keys of a shortcut, click them and press the new ones. A thumb button that has a shortcut no
        longer goes back or forward in the history of the browser.
      </Note>
      <Section title="Shortcuts">
        <div className="shortcuts">
          {SHORTCUT_ACTIONS.map((action) => (
            <Row
              key={action.id}
              action={action}
              settings={settings}
              message={message?.id === action.id ? message.text : ''}
              onMessage={(text) => setMessage(text ? { id: action.id, text } : null)}
              change={(result, given) => {
                form.update(() => result.settings);
                const names = result.taken?.map((a) => `“${a.label}”`).join(' and ');
                setMessage(names ? { id: action.id, text: `${given || 'It'} was removed from ${names}.` } : null);
              }}
            />
          ))}
        </div>
        <div className="settings-actions">
          <button
            type="button"
            disabled={equal(settings, SHORTCUT_DEFAULTS)}
            onClick={() => {
              form.update(() => SHORTCUT_DEFAULTS);
              setMessage(null);
            }}
          >
            <RotateCcw size={13} />
            Reset all shortcuts
          </button>
        </div>
      </Section>
      <Note>
        Browsers keep some combinations for themselves, such as Ctrl+W, Ctrl+T and Ctrl+Tab, so those can’t be used.
        Shortcuts don’t work while a dialog is open.
        {isMac && ' An Option combination that is used as a shortcut no longer types its special character.'}
      </Note>
    </Page>
  );
};

export const ShortcutsPage = withSearch(Shortcuts, {
  words: 'keyboard shortcuts keys hotkeys mouse thumb buttons',
  items: [
    { title: 'Keyboard shortcuts', selector: '[data-key="shortcuts_keyboard"]' },
    { title: 'Thumb buttons of the mouse (back and forward)', selector: '[data-key="shortcuts_mouse"]' },
    ...SHORTCUT_ACTIONS.map((action) => ({
      title: action.label,
      words: 'shortcut',
      selector: `.shortcut[data-shortcut="${action.id}"]`,
    })),
  ],
});
