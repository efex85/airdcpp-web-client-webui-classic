// Which files can be viewed, and how. The limits are those of the official web UI.
import type { Dupe, HintedUser } from '../api/types';

export type ViewKind = 'text' | 'image' | 'audio' | 'video';

/** Larger files can't be viewed as text */
export const TEXT_LIMIT = 256 * 1024;

/** The web server of the client reads a file into memory before sending it */
export const MEDIA_LIMIT = 200 * 1024 * 1024;

const MEDIA: Record<string, ViewKind> = { picture: 'image', audio: 'audio', video: 'video' };

/** The way a file is opened, or null if it is too large */
export const viewKind = (contentType: string | null | undefined, size: number): ViewKind | null => {
  const media = MEDIA[contentType ?? ''];
  if (media) {
    return size < MEDIA_LIMIT ? media : null;
  }

  return size < TEXT_LIMIT ? 'text' : null;
};

export const VIEW_LABELS: Record<ViewKind, string> = {
  text: 'View as text',
  image: 'View image',
  audio: 'Play audio',
  video: 'Play video',
};

/** The file is in the own share, so it can be opened without downloading it */
export const isShared = (dupe: Dupe | null | undefined): boolean => !!dupe?.id.startsWith('share_');

const isPerson = (user: HintedUser) => !user.flags.includes('bot') && !user.flags.includes('hidden');

/** Whether a file can be opened: from the own share, or by downloading it from the user */
export const canViewFrom = (user: HintedUser | undefined, dupe: Dupe | null | undefined): boolean => {
  if (isShared(dupe)) {
    return true;
  }

  return !!user && isPerson(user) && !user.flags.includes('self') && !user.flags.includes('offline');
};

/** NFO files are looked up with a search that only newer ADC clients understand ("ASCH") */
export const canFindNfo = (user: HintedUser): boolean =>
  isPerson(user) && !user.flags.includes('self') && !user.flags.includes('offline') && user.flags.includes('asch');

/** Text files are usually UTF-8 (the client converts NFO files); older ones are read as Western European */
export const decodeText = (data: ArrayBuffer): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1252').decode(data);
  }
};
