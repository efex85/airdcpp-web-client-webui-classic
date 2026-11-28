// Gives the page the icon that the user has chosen

import { sanitizeAppIcon } from '../lib/appIcon';
import { load, save } from '../lib/storage';
import { appIconDoc, isConnected } from './docs';

const LAST_ICON = 'last-icon';

/** The icon of index.html; kept here because the page's own may be replaced */
let standard = '';

export const standardIcon = () => standard;

const link = (rel: string, href: string) => {
  const element = document.createElement('link');
  element.rel = rel;
  element.href = href;
  return element;
};

const applyIcon = (image: string) => {
  const current = document.querySelector<HTMLLinkElement>('link[rel=icon]');
  const wanted = image || standard;
  if (current?.getAttribute('href') !== wanted) {
    // A new element, as not every browser notices a changed address
    current?.remove();
    document.head.append(link('icon', wanted));
  }

  // For the home screen of phones; without an icon of the user's own the phone decides, as before
  const touch = document.querySelector<HTMLLinkElement>('link[rel=apple-touch-icon]');
  if (touch?.getAttribute('href') !== image) {
    touch?.remove();
    if (image) {
      document.head.append(link('apple-touch-icon', image));
    }
  }
};

/** Shows the icon of the logged in user and remembers it for the login page and the next start */
export const showUserIcon = () => {
  // Until the client has answered, the value may be the default of a user who has chosen an icon
  if (appIconDoc.getSnapshot().loaded) {
    const { image } = appIconDoc.value;
    applyIcon(image);
    save(LAST_ICON, image || null);
  }
};

export const initAppIcon = () => {
  standard = document.querySelector('link[rel=icon]')?.getAttribute('href') ?? '';
  // Until a user has logged in, the icon that was used last is shown
  applyIcon(sanitizeAppIcon({ image: load(LAST_ICON, '') }).image);
  appIconDoc.subscribe(() => {
    if (isConnected()) {
      showUserIcon();
    }
  });
};
