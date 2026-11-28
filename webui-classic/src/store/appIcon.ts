// Gives the page the icon that the user has chosen

import { getBasePath } from '../api/socket';
import darkIcon from '../assets/icons/dark.png';
import defaultIcon from '../assets/icons/default.png';
import { pngSize, sanitizeAppIcon, webManifest, type AppIconSettings, type IconChoice } from '../lib/appIcon';
import { load, save } from '../lib/storage';
import { appIconDoc, isConnected } from './docs';

const LAST_ICON = 'last-icon';

/** The icons that come with the web UI, with the size of the files */
export const BUILT_IN_ICONS: Record<Exclude<IconChoice, 'own'>, { src: string; width: number; height: number }> = {
  default: { src: defaultIcon, width: 225, height: 225 },
  dark: { src: darkIcon, width: 512, height: 512 },
};

/** The picture of a setting */
export const iconPicture = ({ choice, image }: AppIconSettings) =>
  choice === 'own' ? { src: image, ...pngSize(image) } : BUILT_IN_ICONS[choice];

const complete = (address: string) => new URL(address, document.baseURI).href;

/** Puts a link into the head of the page, in place of any of its kind */
const setLink = (rel: string, href: string, type?: string) => {
  const current = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (current?.href !== href) {
    // A new element, as not every browser notices a changed address
    current?.remove();
    const element = document.createElement('link');
    element.rel = rel;
    if (type) {
      element.type = type;
    }

    element.href = href;
    document.head.append(element);
  }
};

const applyIcon = (settings: AppIconSettings) => {
  const picture = iconPicture(settings);
  const src = complete(picture.src);
  // The browser tab and notifications
  setLink('icon', src, 'image/png');
  // The home screen of Apple devices
  setLink('apple-touch-icon', src);
  // An app with its own window and icon
  const start = new URL(getBasePath(location.pathname), location.href).href;
  setLink('manifest', webManifest(start, { ...picture, src }));
};

/** Shows the icon of the logged in user and remembers it for the login page and the next start */
export const showUserIcon = () => {
  // Until the client has answered, the value may be the default of a user who has chosen an icon
  if (appIconDoc.getSnapshot().loaded) {
    const { choice, image } = appIconDoc.value;
    applyIcon(appIconDoc.value);
    save(LAST_ICON, choice === 'default' ? null : { choice, image: choice === 'own' ? image : '' });
  }
};

export const initAppIcon = () => {
  // Until a user has logged in, the icon that was used last is shown. Only the picture was remembered earlier.
  const last = load<unknown>(LAST_ICON, null);
  applyIcon(sanitizeAppIcon(typeof last === 'string' ? { image: last } : (last ?? { choice: 'default' })));
  appIconDoc.subscribe(() => {
    if (isConnected()) {
      showUserIcon();
    }
  });
};
