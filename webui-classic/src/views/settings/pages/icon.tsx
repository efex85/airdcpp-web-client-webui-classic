// The icon of the web interface
import { RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { readIcon } from '../../../lib/readIcon';
import { withSearch } from '../../../lib/settingsSearch';
import { standardIcon } from '../../../store/appIcon';
import { appIconDoc } from '../../../store/docs';
import { Note, Page, useDocForm } from '../form';
import { SyncNote } from './personal';

const AppIcon = () => {
  const form = useDocForm(appIconDoc);
  const { image } = form.value;
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = image || standardIcon();

  const choose = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setReading(true);
    setError('');
    try {
      const icon = await readIcon(file);
      form.update((value) => ({ ...value, image: icon }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  return (
    <Page form={form}>
      <SyncNote doc={appIconDoc} />
      <fieldset className="field" data-key="app_icon">
        <legend>Your own icon</legend>
        <div className="icon-preview" aria-label="Preview" role="group">
          <img className="icon-large" src={shown} alt="" />
          <img className="icon-medium" src={shown} alt="" />
          <span className="icon-tab">
            <img src={shown} alt="" />
            AirDC++ Classic
          </span>
          <span className="muted">{image ? 'Your picture' : 'Standard icon'}</span>
        </div>
        <div className="settings-actions">
          <button type="button" disabled={reading} onClick={() => input.current?.click()}>
            <Upload size={12} /> Upload a picture…
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*,.ico"
            hidden
            aria-label="Picture file"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              // Choosing the same file again counts as well
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={!image || reading}
            onClick={() => {
              setError('');
              form.update((value) => ({ ...value, image: '' }));
            }}
          >
            <RotateCcw size={12} /> Use the standard icon
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Note>
        The icon is shown on the browser tab and with the notifications of the browser, after you press “Save changes”.
        A square picture looks best; others get see-through borders. It is stored with at most 192 × 192 pixels, and an
        animated picture becomes a still one. Whether a phone uses it for a shortcut on its home screen depends on the
        phone's browser, and a shortcut that exists already may keep its old icon.
      </Note>
    </Page>
  );
};

export const AppIconPage = withSearch(AppIcon, {
  words: 'favicon logo picture image',
  items: [
    {
      title: 'Your own icon',
      help: 'Upload a picture for the browser tab',
      words: 'app favicon',
      selector: '[data-key="app_icon"]',
    },
  ],
});
