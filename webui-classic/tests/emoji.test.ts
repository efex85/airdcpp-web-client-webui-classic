import { describe, expect, it } from 'vitest';
import { decodeAlphaBmp, keyOutCorner, readBmpHeader } from '../src/lib/bmp';
import {
  createMatcher,
  insertEmoji,
  packPicker,
  parsePack,
  sanitizeEmoji,
  splitEmoticons,
  STANDARD_EMOTICONS,
  STANDARD_PICKER,
  type EmojiPart,
} from '../src/lib/emoji';

const standard = createMatcher(STANDARD_EMOTICONS);
const show = (parts: EmojiPart[]) => parts.map((p) => (typeof p === 'string' ? p : (p.emoji ?? `[${p.code}]`))).join('');
const convert = (text: string, before = '', after = '') => show(splitEmoticons(text, standard, before, after));

describe('text codes in messages', () => {
  it('shows codes that are words of their own', () => {
    expect(convert(':)')).toBe('🙂');
    expect(convert('hi :) and ;-) bye :D')).toBe('hi 🙂 and 😉 bye 😃');
    expect(convert('great :), really :D! (see :P) <3')).toBe('great 🙂, really 😃! (see 😛) ❤️');
    expect(convert('line\n:(\nline')).toBe('line\n🙁\nline');
    expect(convert(':):D;)')).toBe('🙂😃😉');
  });

  it('leaves addresses, paths, words and times alone', () => {
    for (const text of [
      'http://example.com/a',
      'C:\\Users\\x',
      'D:/Share',
      'smile:)',
      ':Dave',
      'ratio 1:D2',
      'x <30',
      'std::string',
      'B) second item',
      'FooXD',
    ]) {
      expect(convert(text)).toBe(text);
    }
  });

  it('takes the characters around the text into account', () => {
    expect(convert(':)', 'x')).toBe(':)');
    expect(convert(':)', ' ')).toBe('🙂');
    expect(convert('see :)', '', 'h')).toBe('see :)');
    expect(convert('see :)', '', ' ')).toBe('see 🙂');
  });

  it('prefers the longest code and stops at the limit', () => {
    const matcher = createMatcher([{ code: ':)' }, { code: ':)))' }, { code: ':))' }]);
    expect(show(splitEmoticons('a :))) b :)) c :)', matcher))).toBe('a [:)))] b [:))] c [:)]');
    const many = splitEmoticons(':) '.repeat(60), standard);
    expect(many.filter((p) => typeof p !== 'string')).toHaveLength(48);
    expect(show(many)).toBe('🙂 '.repeat(48) + ':) '.repeat(12));
  });

  it('keeps the text complete', () => {
    const text = 'a :) b http://x :( c<3 :';
    expect(splitEmoticons(text, standard).map((p) => (typeof p === 'string' ? p : p.code)).join('')).toBe(text);
    expect(splitEmoticons('', standard)).toEqual([]);
  });
});

describe('emoticon packs', () => {
  // Written like the files of the Windows client, which aren't valid XML
  const XML = `<?xml version="1.0" encoding="windows-1252"?>
Title
<Emoticons>
  <Emoticon PasteText=" :D" Bitmap="Pack\\a.bmp"/>
  <Emoticon PasteText=" <:o)" Bitmap="Pack\\b.bmp"/>
  <Emoticon PasteText=" :0" Expression=":*\\0+" Bitmap="Pack\\c.bmp"/>
  <Emoticon Expression="(x)" Bitmap="Pack/d.gif" />
  <Emoticon PasteText="&lt;3 &amp;" Bitmap='My Pack\\e.png'></Emoticon>
  <!-- <Emoticon PasteText="(off)" Bitmap="Pack\\off.bmp"/> -->
  <Emoticon PasteText=" :D" Bitmap="Pack\\second.bmp"/>
  <Emoticon PasteText="(up)" Bitmap="..\\..\\DCPlusPlus.xml"/>
  <Emoticon PasteText="(none)" Bitmap=""/>
  <Emoticon PasteText="" Bitmap="Pack\\empty.bmp"/>
  <Emoticon PasteText="(abs)" Bitmap="\\Pack\\f.bmp"/>
</Emoticons>`;

  it('reads the list of a pack', () => {
    expect(parsePack(XML)).toEqual([
      { code: ':D', file: 'Pack/a.bmp' },
      { code: '<:o)', file: 'Pack/b.bmp' },
      { code: ':0', file: 'Pack/c.bmp' },
      { code: '(x)', file: 'Pack/d.gif' },
      { code: '<3&', file: 'My Pack/e.png' },
      { code: '(abs)', file: 'Pack/f.bmp' },
    ]);
    expect(parsePack('<html><body>nothing</body></html>')).toEqual([]);
  });

  it('offers every picture once', () => {
    const image = (url: string) => ({ url, width: 1, height: 1 });
    const [group] = packPicker([
      { code: ':)', image: image('a') },
      { code: ':-)', image: image('a') },
      { code: ':(', image: image('b') },
    ]);
    expect(group!.items.map((i) => i.insert)).toEqual([':)', ':(']);
  });
});

describe('emoji settings and picker', () => {
  it('accepts only valid settings', () => {
    expect(sanitizeEmoji(undefined)).toEqual({ enabled: true, pack: '' });
    expect(sanitizeEmoji({ enabled: false, pack: 'Atlantis' })).toEqual({ enabled: false, pack: 'Atlantis' });
    expect(sanitizeEmoji({ enabled: 'no', pack: '../x' })).toEqual({ enabled: true, pack: '' });
  });

  it('writes smileys as codes that are shown again as the same emoji', () => {
    for (const { insert, shown } of STANDARD_PICKER[0]!.items) {
      expect([insert, convert(insert)]).toEqual([insert, shown.emoji]);
    }

    const all = STANDARD_PICKER.flatMap((g) => g.items.map((i) => i.insert));
    expect(new Set(all).size).toBe(all.length);
  });

  it('inserts a code as a word of its own', () => {
    expect(insertEmoji('', ':)', 0, 0)).toEqual({ text: ':) ', caret: 3 });
    expect(insertEmoji('hi', ':)', 2, 2)).toEqual({ text: 'hi :) ', caret: 6 });
    expect(insertEmoji('hi there', ':)', 2, 2)).toEqual({ text: 'hi :) there', caret: 6 });
    expect(insertEmoji('hi XX there', ':)', 3, 5)).toEqual({ text: 'hi :) there', caret: 6 });
  });
});

/** A picture with the pixels given from the bottom row up, as in a BMP file */
const bmp = (width: number, height: number, bits: number, pixels: number[]) => {
  const data = new ArrayBuffer(54 + pixels.length);
  const view = new DataView(data);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(28, bits, true);
  new Uint8Array(data, 54).set(pixels);
  return data;
};

describe('bitmap transparency', () => {
  it('reads the transparency of 32-bit pictures', () => {
    // Blue, green, red, alpha
    const data = bmp(1, 2, 32, [1, 2, 3, 255, 4, 5, 6, 0]);
    expect(readBmpHeader(data)).toMatchObject({ width: 1, height: 2, bits: 32 });
    expect([...decodeAlphaBmp(data)!.data]).toEqual([6, 5, 4, 0, 3, 2, 1, 255]);
  });

  it('leaves other pictures to the color of the corner', () => {
    expect(decodeAlphaBmp(bmp(1, 1, 24, [1, 2, 3, 0]))).toBeNull();
    expect(decodeAlphaBmp(bmp(1, 1, 32, [1, 2, 3, 0]))).toBeNull(); // Transparency not used
    expect(decodeAlphaBmp(bmp(100, 100, 32, [1, 2, 3, 255]))).toBeNull(); // Cut off
    expect(decodeAlphaBmp(new ArrayBuffer(10))).toBeNull();

    const pixels = { width: 3, height: 1, data: new Uint8ClampedArray([9, 9, 9, 255, 1, 9, 9, 255, 9, 9, 9, 255]) };
    keyOutCorner(pixels);
    expect([...pixels.data].filter((_, i) => i % 4 === 3)).toEqual([0, 255, 0]);
  });
});
