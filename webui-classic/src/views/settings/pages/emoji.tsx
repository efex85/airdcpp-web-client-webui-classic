// Emoji in chats. Changes apply immediately.
import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { MessageText } from '../../../components/MessageText';
import { emojiDoc, useDoc } from '../../../store/docs';
import { loadPack, loadPackNames, useEmoji, useEmojiStore } from '../../../store/emoji';
import { Note, Page, Section } from '../form';
import { SyncNote } from './personal';

const reload = (pack: string) => {
  void loadPackNames();
  if (pack) {
    void loadPack(pack);
  }
};

const PackStatus = ({ pack }: { pack: string }) => {
  const state = useEmojiStore((s) => s.packs[pack]);
  if (!state || state.status === 'loading') {
    return <p className="settings-note">Loading the pack…</p>;
  }

  if (state.status === 'error') {
    return (
      <p className="error" role="alert">
        The pack “{pack}” can't be used: {state.error}. The emoji of your device are shown instead.
      </p>
    );
  }

  const shown = state.failed.slice(0, 5).join(', ');
  return (
    <p className="settings-note">
      {state.emoticons.length} text codes loaded.
      {state.failed.length > 0 &&
        ` ${state.failed.length} listed pictures couldn't be read: ${shown}${state.failed.length > 5 ? ', …' : ''}`}
    </p>
  );
};

export const EmojiPage = () => {
  const settings = useDoc(emojiDoc);
  const names = useEmojiStore((s) => s.names);
  const namesError = useEmojiStore((s) => s.namesError);
  const { active } = useEmoji();

  useEffect(() => {
    void loadPackNames();
  }, []);

  const missing = !!settings.pack && !!names && !names.includes(settings.pack);
  return (
    <Page>
      <SyncNote doc={emojiDoc} />
      <label className="check-field">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => emojiDoc.set({ ...emojiDoc.value, enabled: e.target.checked })}
        />
        Show emoji in chats
      </label>
      <p className="field-help">
        Text codes such as :) are shown as emoji, and a button for inserting them appears next to the message box. Only
        the display changes: messages are sent as they are written.
      </p>
      <div className="field preset-field">
        <label htmlFor="emoji-pack">Emoji set</label>
        <select
          id="emoji-pack"
          disabled={!settings.enabled}
          value={settings.pack}
          onChange={(e) => emojiDoc.set({ ...emojiDoc.value, pack: e.target.value })}
        >
          <option value="">Emoji of your device</option>
          {names?.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {missing && <option value={settings.pack}>{settings.pack} (not found)</option>}
          {!names && settings.pack && <option value={settings.pack}>{settings.pack}</option>}
        </select>
        <button type="button" disabled={!settings.enabled} onClick={() => reload(settings.pack)}>
          <RefreshCw size={12} /> Reload
        </button>
      </div>
      {namesError && (
        <p className="error" role="alert">
          {namesError}
        </p>
      )}
      {settings.enabled && settings.pack && <PackStatus pack={settings.pack} />}
      <Note>
        Emoticon packs are made like those of the Windows client: copy a file such as Name.xml, together with the folder
        of its pictures, into the folder EmoPacks in the configuration directory of the client (./config/EmoPacks with
        the example docker-compose.yml). Then press Reload.
      </Note>
      <Section title="Preview">
        <div className="chat-log preview-chat">
          <div className="line">
            <MessageText text="Hi :) Nice share :D ;) <3" highlights={[]} emoji={active?.matcher} />
          </div>
        </div>
      </Section>
    </Page>
  );
};
