// The icon of the web UI: one of those that come with it, or a picture of the user's own

/** The coloured AirDC++ icon, the dark one, or the uploaded picture */
export type IconChoice = 'default' | 'dark' | 'own';

export interface AppIconSettings {
  choice: IconChoice;
  /** The user's own picture as a PNG data address, kept also while another icon is chosen; empty if there is none */
  image: string;
}

export const APP_ICON_DEFAULTS: AppIconSettings = { choice: 'default', image: '' };

const PREFIX = 'data:image/png;base64,';

/** Width and height that large pictures are stored with */
export const ICON_SIZE = 192;

/**
 * Longest address that is stored. A PNG of that size stays below it whatever it shows, and the client accepts 256 KiB
 * for each item of user data.
 */
export const MAX_ICON_LENGTH = 200_000;

export const isIcon = (image: unknown): image is string =>
  typeof image === 'string' &&
  image.length <= MAX_ICON_LENGTH &&
  image.startsWith(PREFIX) &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(image.slice(PREFIX.length));

export const sanitizeAppIcon = (value: unknown): AppIconSettings => {
  const stored = value as Partial<AppIconSettings> | null | undefined;
  const image = isIcon(stored?.image) ? stored.image : '';
  // Until there was a choice only a picture was stored, and it was used when there was one
  const choice = stored?.choice ?? 'own';
  return { choice: choice === 'dark' ? 'dark' : choice === 'own' && image ? 'own' : 'default', image };
};

/** Width and height of a PNG data address, as its header states them; 0 if it can't be read */
export const pngSize = (address: string): { width: number; height: number } => {
  try {
    // Signature (8 bytes), length and name of the first block (8), then width and height (4 each): 32 characters
    const bytes = atob(address.slice(PREFIX.length, PREFIX.length + 32));
    const number = (at: number) => [0, 1, 2, 3].reduce((sum, i) => sum * 256 + bytes.charCodeAt(at + i), 0);
    return bytes.slice(12, 16) === 'IHDR' ? { width: number(16), height: number(20) } : { width: 0, height: 0 };
  } catch {
    return { width: 0, height: 0 };
  }
};

/**
 * The web app manifest as a data address. Browsers read it when the web UI is added as an app with its own window and
 * icon (Firefox takes the icon from it, not from the tab). It states no "display", so that browsers behave as they
 * did before in everything else.
 *
 * @param start the address of the web UI; a manifest of this kind needs complete addresses
 * @param icon address of the picture, with its size
 */
export const webManifest = (start: string, icon: { src: string; width: number; height: number }): string => {
  const manifest = {
    name: 'AirDC++ Classic',
    short_name: 'AirDC++',
    start_url: start,
    scope: start,
    icons: [
      {
        src: icon.src,
        ...(icon.width && icon.height ? { sizes: `${icon.width}x${icon.height}` } : {}),
        type: 'image/png',
      },
    ],
  };
  return `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
};

/** The size that a picture is stored with: it isn't enlarged beyond its longer side */
export const iconSide = (width: number, height: number): number =>
  Math.min(ICON_SIZE, Math.max(1, Math.round(Math.max(width, height))));

/** Where a picture goes in a square: as large as possible, in the middle, with its proportions */
export const fitSquare = (width: number, height: number, side: number) => {
  const scale = side / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { x: Math.round((side - w) / 2), y: Math.round((side - h) / 2), width: w, height: h };
};
