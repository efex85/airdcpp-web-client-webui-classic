import type { Highlight } from '../api/types';

export type TextPart = { text: string; highlight?: Highlight };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Splits message text into plain and highlighted parts. API positions are UTF-8 byte offsets. */
export const splitHighlights = (text: string, highlights: Highlight[]): TextPart[] => {
  if (!highlights.length) {
    return [{ text }];
  }

  const bytes = encoder.encode(text);
  const parts: TextPart[] = [];
  let previous = 0;
  for (const highlight of [...highlights].sort((a, b) => a.position.start - b.position.start)) {
    const { start, end } = highlight.position;
    if (start < previous || end > bytes.length || end <= start) {
      continue;
    }

    if (start > previous) {
      parts.push({ text: decoder.decode(bytes.subarray(previous, start)) });
    }

    parts.push({ text: decoder.decode(bytes.subarray(start, end)), highlight });
    previous = end;
  }

  if (previous < bytes.length) {
    parts.push({ text: decoder.decode(bytes.subarray(previous)) });
  }

  return parts;
};

export interface Magnet {
  name: string;
  tth: string;
  size: number;
}

export const parseMagnet = (url: string): Magnet | null => {
  if (!url.startsWith('magnet:?')) {
    return null;
  }

  const params = new URLSearchParams(url.slice('magnet:?'.length));
  const tth = /^urn:tree:tiger:([A-Z2-7]{39})$/i.exec(params.get('xt') ?? '')?.[1];
  const size = Number(params.get('xl'));
  const name = params.get('dn') ?? '';
  return tth && name && Number.isFinite(size) && size > 0 ? { name, tth: tth.toUpperCase(), size } : null;
};

/** Only these schemes become clickable links (message text comes from other users) */
export const isSafeLink = (url: string): boolean => /^(https?|ftp):\/\//i.test(url) || /^www\./i.test(url);

export const isHubLink = (url: string): boolean => /^(adcs?|dchub|nmdcs):\/\//i.test(url);
