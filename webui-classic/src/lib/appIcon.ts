// An icon of the user's own, shown instead of the standard one

export interface AppIconSettings {
  /** The picture as a PNG data address; empty for the standard icon */
  image: string;
}

export const APP_ICON_DEFAULTS: AppIconSettings = { image: '' };

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
  const image = (value as Partial<AppIconSettings> | null | undefined)?.image;
  return { image: isIcon(image) ? image : '' };
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
