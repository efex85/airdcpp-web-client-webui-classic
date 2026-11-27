// Emoji in chats: text codes such as :) are shown as pictures. Only the display changes; messages are sent and
// stored as they were written. The pictures are the emoji of the device, or those of an emoticon pack laid out like
// the packs of the Windows client (<name>.xml and the picture files that it lists).

export interface EmojiSettings {
  enabled: boolean;
  /** Name of the emoticon pack; empty for the emoji of the device */
  pack: string;
}

export const EMOJI_DEFAULTS: EmojiSettings = { enabled: true, pack: '' };

export const sanitizeEmoji = (value: unknown): EmojiSettings => {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : EMOJI_DEFAULTS.enabled,
    pack: typeof v.pack === 'string' && v.pack.length <= 200 && !/[/\\\0]/.test(v.pack) ? v.pack : '',
  };
};

/** A text code and what it is shown as */
export interface Emoticon {
  code: string;
  /** An emoji of the device */
  emoji?: string;
  image?: { url: string; width: number; height: number };
}

/** As in the Windows client; the rest of a message stays as text */
export const MAX_PER_MESSAGE = 48;
const MAX_PACK_ENTRIES = 2000;

// ---------------------------------------------------------------------------------------------------------------------
// Matching

export type EmoticonMatcher = Map<string, Emoticon[]>;

/** The codes by their first character, the longest first */
export const createMatcher = (emoticons: Emoticon[]): EmoticonMatcher => {
  const matcher: EmoticonMatcher = new Map();
  const seen = new Set<string>();
  for (const emoticon of emoticons) {
    if (!emoticon.code || seen.has(emoticon.code)) {
      continue; // The first one wins
    }

    seen.add(emoticon.code);
    const first = emoticon.code[0]!;
    const list = matcher.get(first);
    if (list) {
      list.push(emoticon);
    } else {
      matcher.set(first, [emoticon]);
    }
  }

  for (const list of matcher.values()) {
    list.sort((a, b) => b.code.length - a.code.length);
  }

  return matcher;
};

const candidates = (matcher: EmoticonMatcher, text: string, at: number) =>
  (matcher.get(text[at]!) ?? []).filter((e) => text.startsWith(e.code, at));

const SPACE = /\s/;
const MAY_FOLLOW = /[\s.,!?:;)\]"]/;

export type EmojiPart = string | Emoticon;

/**
 * Splits a text into plain text and emoticons. A code must start a word (or directly follow another emoticon) and end
 * one, so that for example addresses and words that happen to contain a code stay as they are.
 * @param before The character in front of the text; empty at the start of a message
 * @param after The character behind the text; empty at the end of a message
 */
export const splitEmoticons = (
  text: string,
  matcher: EmoticonMatcher,
  before = '',
  after = '',
  limit = MAX_PER_MESSAGE,
): EmojiPart[] => {
  const parts: EmojiPart[] = [];
  let plainFrom = 0;
  let previousEnd = -1;
  let count = 0;

  for (let i = 0; i < text.length && count < limit; i++) {
    const previous = i ? text[i - 1]! : before;
    if (previousEnd !== i && previous !== '' && !SPACE.test(previous)) {
      continue;
    }

    const found = candidates(matcher, text, i).find((e) => {
      const end = i + e.code.length;
      const next = end < text.length ? text[end]! : after;
      return next === '' || MAY_FOLLOW.test(next) || candidates(matcher, text, end).length > 0;
    });
    if (!found) {
      continue;
    }

    if (i > plainFrom) {
      parts.push(text.slice(plainFrom, i));
    }

    parts.push(found);
    count++;
    previousEnd = plainFrom = i + found.code.length;
    i = previousEnd - 1;
  }

  if (plainFrom < text.length) {
    parts.push(text.slice(plainFrom));
  }

  return parts;
};

// ---------------------------------------------------------------------------------------------------------------------
// Emoticon packs

export interface PackEntry {
  code: string;
  /** Path of the picture below the folder of the packs, with forward slashes */
  file: string;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

const unescapeXml = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }

    return ENTITIES[name] ?? match;
  });

/**
 * The emoticons listed by a pack file. The files of the Windows client aren't always valid XML (codes contain "<"),
 * so the elements are read one by one.
 */
export const parsePack = (xml: string): PackEntry[] => {
  const entries: PackEntry[] = [];
  const seen = new Set<string>();
  const text = xml.replace(/<!--[\s\S]*?-->/g, '');
  for (const element of text.matchAll(/<Emoticon(?=[\s/>])((?:\s*[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g)) {
    const attributes: Record<string, string> = {};
    for (const a of element[1]!.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attributes[a[1]!] = unescapeXml(a[2] ?? a[3]!);
    }

    // The same choice and removal of spaces as in the Windows client
    const code = (attributes.PasteText || attributes.Expression || '').replace(/ /g, '');
    const segments = (attributes.Bitmap ?? '').split(/[\\/]/).filter((s) => s !== '' && s !== '.');
    if (!code || code.length > 50 || !segments.length || segments.includes('..') || seen.has(code)) {
      continue;
    }

    seen.add(code);
    entries.push({ code, file: segments.join('/') });
    if (entries.length >= MAX_PACK_ENTRIES) {
      break;
    }
  }

  return entries;
};

// ---------------------------------------------------------------------------------------------------------------------
// The emoji of the device

const STANDARD_CODES: [emoji: string, codes: string][] = [
  ['🙂', ':) :-)'],
  ['😃', ':D :-D'],
  ['😄', '=D'],
  ['😊', '=) ^^ ^_^'],
  ['😆', 'XD xD'],
  ['😉', ';) ;-)'],
  ['😛', ':P :p :-P :-p'],
  ['😜', ';P ;p ;-P ;-p'],
  ['😘', ':* :-*'],
  ['😎', '8-) B-)'],
  ['😇', 'O:) O:-)'],
  ['😈', '>:) >:-)'],
  ['🙁', ':( :-('],
  ['😢', ":'( :'-("],
  ['😂', ":') :'-)"],
  ['😠', '>:( >:-('],
  ['😡', ':@ :-@'],
  ['😮', ':O :o :-O :-o'],
  ['😲', 'O_O'],
  ['🤨', 'o_O O_o'],
  ['😐', ':| :-|'],
  ['😑', '-_-'],
  ['😕', ':/ :-/ :\\ :-\\'],
  ['😖', ':S :-S'],
  ['😳', ':$ :-$'],
  ['❤️', '<3'],
  ['💔', '</3'],
];

export const STANDARD_EMOTICONS: Emoticon[] = STANDARD_CODES.flatMap(([emoji, codes]) =>
  codes.split(' ').map((code) => ({ code, emoji })),
);

const list = (emoji: string) => emoji.split(' ');

/** What the picker offers besides the emoji that have a text code */
const MORE_EMOJI: [group: string, emoji: string[]][] = [
  [
    'Faces',
    list('😀 😁 🤣 😅 😍 🥰 🤩 😋 🤪 🤗 🤭 🤫 🤔 🙄 😏 😬 😌 😴 🤤 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🥳 🤓 😟 😱 😭 😤 🤬 💀 💩 🤡 👻 👽 🤖'),
  ],
  ['Hands', list('👍 👎 👌 ✌️ 🤞 🤟 🤘 👈 👉 👆 👇 ✋ 👋 👏 🙌 🙏 🤝 💪 🫡 🤷 🤦')],
  ['Hearts and symbols', list('💕 💖 🧡 💛 💚 💙 💜 🖤 💯 ✨ ⭐ 🔥 💥 💤 ✅ ❌ ❓ ❗ ⚠️ 🔔')],
  [
    'Things',
    list('🎉 🎁 🎂 🍺 🍻 🥂 ☕ 🍕 🍔 🍿 🎬 🎵 🎮 📺 💻 📱 💾 💿 📁 📎 🔒 🔑 💡 🔧 🚀 🏆 💰 ⏳ 🌧️ ☀️ 🌙 🌍 🐶 🐱 🏴‍☠️'),
  ],
];

export interface PickerItem {
  /** What is written into the message */
  insert: string;
  /** Shown on the button */
  shown: Emoticon;
}

export interface PickerGroup {
  title: string;
  items: PickerItem[];
}

/**
 * Emoji with a text code are written as the code: it is understood by clients without emoji, and by hubs that can't
 * transfer emoji.
 */
export const STANDARD_PICKER: PickerGroup[] = [
  {
    title: 'Smileys',
    items: STANDARD_CODES.map(([emoji, codes]) => ({
      insert: codes.split(' ')[0]!,
      shown: { code: codes.split(' ')[0]!, emoji },
    })),
  },
  ...MORE_EMOJI.map(([title, emoji]) => ({
    title,
    items: emoji.map((e) => ({ insert: e, shown: { code: e, emoji: e } })),
  })),
];

/** Every picture of a pack once, written as the first code that the pack has for it */
export const packPicker = (emoticons: Emoticon[]): PickerGroup[] => {
  const seen = new Set<string>();
  const items: PickerItem[] = [];
  for (const emoticon of emoticons) {
    const key = emoticon.image?.url ?? emoticon.emoji ?? '';
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ insert: emoticon.code, shown: emoticon });
    }
  }

  return [{ title: '', items }];
};

/** Puts a code into a text at the selection, as a word of its own */
export const insertEmoji = (text: string, code: string, start: number, end: number) => {
  const head = text.slice(0, start);
  const tail = text.slice(end);
  const inserted = `${head && !/\s$/.test(head) ? ' ' : ''}${code}${/^\s/.test(tail) ? '' : ' '}`;
  return { text: head + inserted + tail, caret: head.length + inserted.length + (/^\s/.test(tail) ? 1 : 0) };
};
