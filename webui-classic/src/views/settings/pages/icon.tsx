// The icon of the web interface
import { Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { IconChoice } from '../../../lib/appIcon';
import { readIcon } from '../../../lib/readIcon';
import { withSearch } from '../../../lib/settingsSearch';
import { iconPicture } from '../../../store/appIcon';
import { appIconDoc } from '../../../store/docs';
import { Note, Page, useDocForm } from '../form';
import { SyncNote } from './personal';

const CHOICES: [IconChoice, string][] = [
  ['default', 'AirDC++'],
  ['dark', 'AirDC++ dark'],
  ['own', 'Your own picture'],
];

const AppIcon = () => {
  const form = useDocForm(appIconDoc);
  const { choice, image } = form.value;
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = iconPicture(form.value).src;

  const choose = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setReading(true);
    setError('');
    try {
      const icon = await readIcon(file);
      form.update((value) => ({ ...value, choice: 'own', image: icon }));
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
        <legend>Icon</legend>
        <div className="icon-choices">
          {CHOICES.map(([id, label]) => {
            const picture = id === 'own' ? image : iconPicture({ choice: id, image }).src;
            return (
              <label key={id} className={`icon-choice${picture ? '' : ' missing'}`}>
                <input
                  type="radio"
                  name="app-icon"
                  value={id}
                  checked={choice === id}
                  disabled={!picture || reading}
                  onChange={() => {
                    setError('');
                    form.update((value) => ({ ...value, choice: id }));
                  }}
                />
                {picture ? <img src={picture} alt="" /> : <span className="icon-none" />}
                <span>{label}</span>
              </label>
            );
          })}
        </div>
        <div className="icon-preview" aria-label="Preview" role="group">
          <img className="icon-large" src={shown} alt="" />
          <img className="icon-medium" src={shown} alt="" />
          <span className="icon-tab">
            <img src={shown} alt="" />
            AirDC++ Classic
          </span>
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
              form.update((value) => ({ choice: value.choice === 'own' ? 'default' : value.choice, image: '' }));
            }}
          >
            <Trash2 size={12} /> Remove your picture
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
        For your own picture a square one looks best; others get see-through borders. It is stored with at most 192 × 192
        pixels, and an animated picture becomes a still one.
      </Note>
      <Note>
        An app made from this page, such as a web app of Firefox on the Windows taskbar or a shortcut on the home screen
        of a phone, keeps the icon that it was made with. To change it, remove the app and add it again.
      </Note>
    </Page>
  );
};

export const AppIconPage = withSearch(AppIcon, {
  words: 'favicon logo picture image',
  items: [
    {
      title: 'Icon',
      help: 'Choose the icon, or upload a picture of your own',
      words: 'app favicon upload own dark default web app taskbar',
      selector: '[data-key="app_icon"]',
    },
  ],
});
