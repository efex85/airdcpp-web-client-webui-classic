// The emoticons that are in use: those of the device, or a pack that the client has in its configuration folder

import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { getBasePath } from '../api/socket';
import { decodeAlphaBmp, keyOutCorner, readBmpHeader, type Pixels } from '../lib/bmp';
import {
  createMatcher,
  packPicker,
  parsePack,
  STANDARD_EMOTICONS,
  STANDARD_PICKER,
  type EmojiSettings,
  type Emoticon,
  type EmoticonMatcher,
  type PickerGroup,
} from '../lib/emoji';
import { decodeXml } from '../lib/proxy';
import { emojiDoc, useDoc } from './docs';
import { useApp } from './app';

export type PackState =
  | { status: 'loading' }
  | { status: 'ready'; emoticons: Emoticon[]; /** Listed pictures that couldn't be read */ failed: string[] }
  | { status: 'error'; error: string };

interface PackStore {
  /** Names of the packs that the client has; null before they have been asked for */
  names: string[] | null;
  namesError: string | null;
  packs: Record<string, PackState>;
}

export const useEmojiStore = create<PackStore>(() => ({ names: null, namesError: null, packs: {} }));

/** Loads of an earlier login or from before a reload must not overwrite newer ones */
let generation = 0;

export const resetEmoji = () => {
  generation++;
  useEmojiStore.setState({ names: null, namesError: null, packs: {} });
};

const request = async (path: string): Promise<Response> => {
  const login = useApp.getState().login;
  const response = await fetch(`${getBasePath(window.location.pathname)}emopacks${path}`, {
    cache: 'no-store',
    headers: {
      // The standard Authorization header may be used by a reverse proxy
      'X-Authorization': `${login?.token_type ?? 'Bearer'} ${login?.auth_token ?? ''}`,
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Request failed (${response.status})`), { status: response.status });
  }

  return response;
};

export const loadPackNames = async () => {
  const current = generation;
  try {
    const names: unknown = await (await request('')).json();
    if (current === generation) {
      useEmojiStore.setState({
        names: Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [],
        namesError: null,
      });
    }
  } catch (e) {
    if (current === generation) {
      // A client without the patch answers that there is no such file
      const missing = (e as { status?: number }).status === 404;
      useEmojiStore.setState({
        names: [],
        namesError: missing ? "This client can't read emoticon packs" : (e as Error).message,
      });
    }
  }
};

const MIME: Record<string, string> = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Not a picture'));
    image.src = url;
  });

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const draw = (pixels: Pixels) => {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const data = new ImageData(pixels.width, pixels.height);
  data.data.set(pixels.data);
  canvas.getContext('2d')!.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
};

const loadPicture = async (file: string): Promise<NonNullable<Emoticon['image']>> => {
  const type = MIME[file.slice(file.lastIndexOf('.') + 1).toLowerCase()];
  if (!type) {
    throw new Error('Unsupported file type');
  }

  const data = await (await request(`/${file.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer();
  const alpha = decodeAlphaBmp(data);
  if (alpha) {
    return { url: draw(alpha), width: alpha.width, height: alpha.height };
  }

  const url = await toDataUrl(new Blob([data], { type }));
  const image = await loadImage(url);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!readBmpHeader(data)) {
    return { url, width, height }; // Unchanged, so that animations keep running
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  keyOutCorner(pixels);
  context.putImageData(pixels, 0, 0);
  return { url: canvas.toDataURL('image/png'), width, height };
};

const PARALLEL = 6;

const readPack = async (name: string): Promise<PackState> => {
  const response = await request(`/${encodeURIComponent(name)}.xml`);
  const entries = parsePack(decodeXml(await response.arrayBuffer(), ''));
  const files = [...new Set(entries.map((e) => e.file))];
  const pictures = new Map<string, NonNullable<Emoticon['image']>>();
  const failed: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < files.length) {
        const file = files[next++]!;
        try {
          pictures.set(file, await loadPicture(file));
        } catch {
          failed.push(file);
        }
      }
    }),
  );

  const emoticons = entries.flatMap(({ code, file }) => {
    const image = pictures.get(file);
    return image ? [{ code, image }] : [];
  });
  if (!emoticons.length) {
    return {
      status: 'error',
      error: entries.length ? 'None of its pictures could be read' : 'The file lists no emoticons',
    };
  }

  return { status: 'ready', emoticons, failed: failed.sort() };
};

export const loadPack = async (name: string) => {
  const current = generation;
  const set = (state: PackState) =>
    current === generation && useEmojiStore.setState((s) => ({ packs: { ...s.packs, [name]: state } }));

  set({ status: 'loading' });
  try {
    set(await readPack(name));
  } catch (e) {
    const missing = (e as { status?: number }).status === 404;
    set({ status: 'error', error: missing ? 'The pack was not found' : (e as Error).message });
  }
};

export interface ActiveEmoji {
  matcher: EmoticonMatcher;
  picker: PickerGroup[];
}

const STANDARD: ActiveEmoji = { matcher: createMatcher(STANDARD_EMOTICONS), picker: STANDARD_PICKER };

/**
 * What chats use: null if emoji are switched off, or while a pack is being loaded. The emoji of the device are used
 * instead of a pack that can't be loaded.
 */
export const useEmoji = (): { enabled: boolean; active: ActiveEmoji | null } => useEmojiWith(useDoc(emojiDoc));

/** The same for other than the saved settings (the preview of the settings page) */
export const useEmojiWith = ({ enabled, pack }: EmojiSettings): { enabled: boolean; active: ActiveEmoji | null } => {
  const state = useEmojiStore((s) => (pack ? s.packs[pack] : undefined));

  useEffect(() => {
    // Looked up when it starts, so that several chats don't load it at the same time
    if (enabled && pack && !useEmojiStore.getState().packs[pack]) {
      void loadPack(pack);
    }
  }, [enabled, pack, state]);

  const active = useMemo(() => {
    if (!enabled) {
      return null;
    }

    if (!pack || state?.status === 'error') {
      return STANDARD;
    }

    return state?.status === 'ready'
      ? { matcher: createMatcher(state.emoticons), picker: packPicker(state.emoticons) }
      : null;
  }, [enabled, pack, state]);

  return { enabled, active };
};
