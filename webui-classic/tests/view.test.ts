import { describe, expect, test } from 'vitest';
import type { HintedUser } from '../src/api/types';
import { dupeLabel } from '../src/lib/dupe';
import { formatExactSize } from '../src/lib/format';
import { tidySeparators } from '../src/lib/menu';
import { canFindNfo, canViewFrom, decodeText, MEDIA_LIMIT, TEXT_LIMIT, viewKind } from '../src/lib/viewFile';

const user = (...flags: string[]): HintedUser => ({ cid: 'A', nicks: 'a', hub_url: 'adc://h', flags });

describe('viewing files', () => {
  test('the way of opening follows the content type and the size', () => {
    expect(viewKind('picture', 1000)).toBe('image');
    expect(viewKind('audio', 1000)).toBe('audio');
    expect(viewKind('video', MEDIA_LIMIT - 1)).toBe('video');
    expect(viewKind('video', MEDIA_LIMIT)).toBeNull();
    expect(viewKind('document', TEXT_LIMIT - 1)).toBe('text');
    expect(viewKind('', 10)).toBe('text');
    expect(viewKind(null, TEXT_LIMIT)).toBeNull();
  });

  test('files need a source: a user who can send them, or the own share', () => {
    expect(canViewFrom(user(), null)).toBe(true);
    expect(canViewFrom(user('self'), null)).toBe(false);
    expect(canViewFrom(user('offline'), null)).toBe(false);
    expect(canViewFrom(user('bot'), null)).toBe(false);
    expect(canViewFrom(undefined, null)).toBe(false);
    expect(canViewFrom(undefined, { id: 'share_full', paths: [] })).toBe(true);
    expect(canViewFrom(user('self'), { id: 'share_queue', paths: [] })).toBe(true);
    expect(canViewFrom(user('offline'), { id: 'queue_full', paths: [] })).toBe(false);
  });

  test('NFO files can only be looked up from users who support it', () => {
    expect(canFindNfo(user('asch'))).toBe(true);
    expect(canFindNfo(user())).toBe(false);
    expect(canFindNfo(user('asch', 'self'))).toBe(false);
    expect(canFindNfo(user('asch', 'offline'))).toBe(false);
  });

  test('text that is not valid UTF-8 is read as Western European', () => {
    const buffer = (...bytes: number[]) => new Uint8Array(bytes).buffer;
    expect(decodeText(buffer(0xc3, 0xa5))).toBe('å');
    expect(decodeText(buffer(0xe5, 0xe4, 0xf6))).toBe('åäö');
  });
});

describe('menus and details', () => {
  test('separators left without entries are removed', () => {
    expect(tidySeparators(['separator', 'a', 'separator', 'separator', 'b', 'separator'])).toEqual(['a', 'separator', 'b']);
    expect(tidySeparators(['a', 'separator', 'separator'])).toEqual(['a']);
    expect(tidySeparators(['separator'])).toEqual([]);
  });

  test('sizes and dupe types are readable', () => {
    expect(formatExactSize(512)).toBe('512 B');
    expect(formatExactSize(1536)).toMatch(/KiB \(1,536 B\)$/);
    expect(dupeLabel({ id: 'share_queue_finished', paths: [] })).toBe('Share, queue and finished');
  });
});
