import { describe, expect, it } from 'vitest';
import { CONFLICT_MARKER, equal, merge, mergeText } from '../src/lib/merge';
import { sanitizeStartup, startupTabs } from '../src/lib/startup';
import { rememberWindow, windowAfterClose } from '../src/lib/windowHistory';
import { createWidget, DEFAULT_WIDGETS, moveWidget, newWidgetId, orderWidgets, sanitizeWidgets } from '../src/lib/widgets';
import {
  columnCount,
  heightPixels,
  isNormalSize,
  minUnits,
  normalHeight,
  rowSpan,
  sanitizeSizes,
  sizeOf,
  snapHeight,
  widthUnits,
} from '../src/lib/widgetSizes';
import type { HashStats } from '../src/api/settingsTypes';
import { diskFolderNames, diskIsLow, diskUsedPercent, groupDisks } from '../src/lib/disks';
import { hashingBusy, hashingProgress, hashingStatus, hashingText } from '../src/lib/hashing';
import { isRememberedSearch, recentSearches } from '../src/lib/searchHistory';
import { emptyResultText, progressIsTimed, RESULT_WAIT } from '../src/lib/searchProgress';
import { formatAge, formatChatTime, formatUptime } from '../src/lib/format';
import { nickClass } from '../src/lib/user';

describe('window history', () => {
  it('returns to the window that was used before', () => {
    // First hub, then the queue is opened and closed (it is the last tab)
    let history: string[] = [];
    for (const key of ['home', 'hub:1', 'queue']) {
      history = rememberWindow(history, key);
    }

    const remaining = ['home', 'hub:1', 'hub:2'];
    expect(windowAfterClose(history.filter((k) => k !== 'queue'), remaining, 3)).toBe('hub:1');
  });

  it('moves a window that is used again to the end', () => {
    expect(rememberWindow(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });

  it('skips windows that are gone and falls back to the neighbour', () => {
    expect(windowAfterClose(['a', 'gone'], ['a', 'b'], 2)).toBe('a');
    expect(windowAfterClose([], ['a', 'b', 'c'], 2)).toBe('b');
    expect(windowAfterClose([], ['b'], 0)).toBe('b');
    expect(windowAfterClose([], [], 0)).toBe('');
  });
});

describe('startup windows', () => {
  it('opens Home first and the system log second', () => {
    expect(startupTabs(['queue', 'syslog'], sanitizeStartup(null))).toEqual(['home', 'syslog', 'queue']);
  });

  it('leaves out disabled windows, even if they were open before', () => {
    const settings = { home_enabled: false, open_syslog_at_start: false };
    expect(startupTabs(['home', 'syslog', 'favorites'], settings)).toEqual(['favorites']);
  });

  it('ignores invalid stored settings', () => {
    expect(sanitizeStartup({ home_enabled: 'no', open_syslog_at_start: false })).toEqual({
      home_enabled: true,
      open_syslog_at_start: false,
    });
  });
});

describe('combining changes of two devices', () => {
  it('compares values regardless of the key order', () => {
    expect(equal({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(equal({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(equal([], {})).toBe(false);
  });

  it('keeps the changes of both sides in objects', () => {
    const base = { preset: 'classic', colors: { a: '1', b: '2' } as Record<string, string> };
    const mine = { preset: 'classic', colors: { a: 'mine', b: '2' } };
    const theirs = { preset: 'black', colors: { a: '1', c: '3' } };
    expect(merge(base, mine, theirs)).toEqual({ preset: 'black', colors: { a: 'mine', c: '3' } });
  });

  it('prefers this device when both changed the same value', () => {
    expect(merge({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
  });

  const list = (...ids: string[]) => ids.map((id) => ({ id, title: id }));

  it('keeps widgets added on both sides and honours removals', () => {
    expect(merge(list('a', 'b'), list('a', 'b', 'mine'), list('b', 'theirs'))).toEqual(list('b', 'mine', 'theirs'));
  });

  it('keeps a changed widget that the other side removed', () => {
    const changed = [{ id: 'a', title: 'renamed' }];
    expect(merge(list('a'), changed, [])).toEqual(changed);
  });

  it('keeps the order that was changed', () => {
    expect(merge(list('a', 'b'), list('b', 'a'), list('a', 'b', 'c'))).toEqual(list('b', 'a', 'c'));
    expect(merge(list('a', 'b'), list('a', 'b', 'c'), list('b', 'a'))).toEqual(list('b', 'a', 'c'));
  });

  it('keeps both texts of a note that was written on two devices', () => {
    expect(mergeText('x', 'x', 'theirs')).toBe('theirs');
    expect(mergeText('x', 'mine', 'x')).toBe('mine');
    expect(mergeText('x', 'mine', 'theirs')).toBe(`theirs\n\n${CONFLICT_MARKER}\nmine`);
    expect(mergeText('x', 'x and more', 'x and')).toBe('x and more');
    expect(mergeText('x', '', 'theirs')).toBe('theirs');
  });
});

describe('widgets', () => {
  it('can all be removed', () => {
    expect(sanitizeWidgets({ list: [] }).list).toEqual([]);
  });

  it('can be added several times, except the statistics', () => {
    const widgets = sanitizeWidgets({
      list: [
        createWidget('rss', 'a'),
        createWidget('rss', 'b'),
        createWidget('notes', 'c'),
        createWidget('notes', 'd'),
        createWidget('stats', 'e'),
        createWidget('stats', 'f'),
        createWidget('notes', 'a'),
        { id: 'bad id', type: 'notes' },
        { id: 'g', type: 'toString' },
      ],
    });
    expect(widgets.list.map((w) => w.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('keeps one list of recent private chats and one of recent searches', () => {
    const saved = ['pms', 'pms', 'searches', 'searches'].map((type, i) => ({ id: `w${i}`, type }));
    expect(sanitizeWidgets({ list: saved }).list.map((w) => w.id)).toEqual(['w0', 'w2']);
  });

  it('uses the defaults if nothing sensible is stored', () => {
    expect(sanitizeWidgets(null)).toBe(DEFAULT_WIDGETS);
    // Whether the order has been taken from a large screen
    expect(sanitizeWidgets({ list: [], ordered: true })).toEqual({ list: [], ordered: true });
    expect(sanitizeWidgets({ list: [], ordered: 'yes' })).toEqual({ list: [] });
  });

  it('can be reordered', () => {
    const ids = (offset: -1 | 1, id: string) => moveWidget(DEFAULT_WIDGETS.list, id, offset).map((w) => w.id);
    expect(ids(1, 'stats')).toEqual(['rss1', 'stats', 'notes1']);
    expect(ids(-1, 'stats')).toEqual(['stats', 'rss1', 'notes1']);
  });

  it('get IDs that the client accepts as part of a name', () => {
    expect(newWidgetId()).toMatch(/^[a-z0-9]{10}$/);
  });
});

describe('formatting', () => {
  it('formats uptimes and ages', () => {
    expect(formatUptime(5)).toBe('00:00:05');
    expect(formatUptime(3 * 86400 + 4 * 3600 + 5 * 60 + 9)).toBe('3 days 04:05:09');
    expect(formatUptime(86400)).toBe('1 day 00:00:00');
    expect(formatAge(1000, 1030)).toBe('just now');
    expect(formatAge(1000, 1000 + 7200)).toBe('2 hours ago');
  });

  it('formats timestamps as chosen', () => {
    expect(formatChatTime(0, 'none')).toBe('');
    expect(formatChatTime(0, 'minutes')).toMatch(/^\d\d:\d\d$/);
    expect(formatChatTime(0, 'seconds')).toMatch(/^\d\d:\d\d:\d\d$/);
  });

  it('marks nicks with their groups', () => {
    expect(nickClass(['op', 'favorite'])).toBe('nick op favorite');
    expect(nickClass(['self', 'op'])).toBe('nick self');
    expect(nickClass([])).toBe('nick');
  });
});

describe('widget sizes', () => {
  const [stats, feed] = [createWidget('stats', 'stats'), createWidget('rss', 'a')];

  it('has four width steps for every box that fits side by side', () => {
    expect([200, 380, 767, 768, 1155, 1156].map(columnCount)).toEqual([4, 4, 4, 8, 8, 12]);
  });

  it('keeps heights in whole rows, with the space below the box', () => {
    expect(snapHeight(340)).toBe(342);
    expect((snapHeight(347) + 8) % 10).toBe(0);
    expect(snapHeight(10)).toBe(112);
    expect(snapHeight(99999)).toBe(3992);
    expect(rowSpan(342)).toBe(35);
    // The normal height never gets smaller than what's needed
    expect(normalHeight(340)).toBe(342);
    expect(normalHeight(343)).toBe(352);
  });

  it('keeps the width of a box, which has a smallest one', () => {
    expect(widthUnits({})).toBe(4);
    expect(widthUnits({ w: 10 })).toBe(10);
    expect(widthUnits({ w: 2 })).toBe(2);
    expect(widthUnits({ w: 2 }, minUnits('stats'))).toBe(3);
    expect(widthUnits({ w: 2 }, minUnits('notes'))).toBe(2);
  });

  it('gives preset heights in normal boxes, and own heights in pixels', () => {
    expect(heightPixels({}, 342)).toBe(342);
    expect(heightPixels({ rows: 2 }, 342)).toBe(692);
    expect(heightPixels({ rows: 3 }, 342)).toBe(1042);
    expect(heightPixels({ h: 202, w: 6 }, 342)).toBe(202);
    expect(isNormalSize({})).toBe(true);
    expect(isNormalSize({ rows: 1 })).toBe(true);
    expect(isNormalSize({ w: 4 })).toBe(false);
  });

  it('starts with the height that was saved for all devices until the browser has its own', () => {
    const tall = { ...feed, rows: 2 };
    expect(sizeOf({}, tall)).toEqual({ rows: 2 });
    expect(sizeOf({ a: {} }, tall)).toEqual({});
    expect(sizeOf({ a: { w: 6 } }, tall)).toEqual({ w: 6 });
    expect(sizeOf({}, stats)).toEqual({});
  });

  it('drops unusable stored sizes', () => {
    expect(sanitizeSizes(null)).toEqual({});
    expect(sanitizeSizes([1])).toEqual({});
    expect(sanitizeSizes({ a: { w: 6.4, h: '300', rows: 9, x: 1 }, b: 5, c: { h: NaN } })).toEqual({
      a: { w: 6, rows: 3 },
      c: {},
    });
  });

  it('keeps heights saved by earlier versions and drops unusable ones', () => {
    const saved = [
      { id: 'a', type: 'rss', rows: 3 },
      { id: 'b', type: 'notes', rows: 2 },
      { id: 'c', type: 'notes', rows: 99 },
      { id: 'd', type: 'notes', rows: '2' },
      { id: 'stats', type: 'stats', rows: 2 },
    ];
    expect(sanitizeWidgets({ list: saved }).list.map((w) => w.rows)).toEqual([3, 2, undefined, undefined, undefined]);
  });
});

describe('progress of a search', () => {
  it('counts down while the search is queued', () => {
    const queued = { phase: 'queued', startsAt: 10_000 } as const;
    expect(emptyResultText(queued, 1000)).toBe('Waiting for the hubs: the search starts in about 9 s');
    expect(emptyResultText(queued, 10_500)).toBe('Searching…');
    expect(progressIsTimed(queued, 1000)).toBe(true);
    expect(progressIsTimed(queued, 10_500)).toBe(false);
  });

  it('only reports no results some time after the search was sent', () => {
    const sent = { phase: 'sent', sentAt: 1000 } as const;
    expect(emptyResultText(sent, 1100)).toBe('Waiting for results…');
    expect(emptyResultText(sent, 1000 + RESULT_WAIT)).toBe('No results');
    expect(progressIsTimed(sent, 1000 + RESULT_WAIT)).toBe(false);
  });

  it('describes the other states', () => {
    expect(emptyResultText({ phase: 'idle' }, 0)).toBe('Enter a search term');
    expect(emptyResultText({ phase: 'sending' }, 0)).toBe('Searching…');
    expect(emptyResultText({ phase: 'failed' }, 0)).toBe('The search failed');
  });
});

describe('hashing in the statistics', () => {
  const idle: HashStats = {
    hash_speed: 0,
    hash_bytes_left: 0,
    hash_files_left: 0,
    hash_bytes_added: 0,
    hash_files_added: 0,
    hashers: 0,
    pause_forced: false,
    max_hash_speed: 0,
  };
  const running = {
    ...idle,
    hash_speed: 1024 * 1024,
    hash_bytes_left: 60 * 1024 * 1024,
    hash_files_left: 3,
    hash_bytes_added: 80 * 1024 * 1024,
    hash_files_added: 4,
    hashers: 1,
  };

  it('is idle without files', () => {
    expect(hashingBusy(idle)).toBe(false);
    expect(hashingStatus(idle)).toBe('Idle');
    expect(hashingText(idle)).toBe('Nothing to hash');
    expect(hashingProgress(idle)).toBe(0);
  });

  it('shows the speed, the time left and the progress', () => {
    expect(hashingStatus(running)).toBe('1.00 MiB/s, 1:00 left');
    expect(hashingText(running)).toBe('3 files, 60.00 MiB left');
    expect(hashingProgress(running)).toBe(25);
    expect(hashingText({ ...running, hash_files_left: 1 })).toBe('1 file, 60.00 MiB left');
    expect(hashingStatus({ ...running, hash_speed: 0 })).toBe('Running');
  });

  it('says when it pauses after the current file, and when it is paused', () => {
    expect(hashingStatus({ ...running, pause_forced: true })).toBe('Pausing after this file');
    const paused = { ...running, hashers: 0, hash_speed: 0, pause_forced: true };
    expect(hashingStatus(paused)).toBe('Paused');
    expect(hashingBusy(paused)).toBe(true);
    expect(hashingStatus({ ...idle, pause_forced: true })).toBe('Paused');
  });
});

describe('disk space', () => {
  const GiB = 1024 ** 3;
  const folders = ['Download folder', 'Music', 'Films', 'Books', 'Other'].map((name, i) => ({ name, path: `/${i}/` }));
  const info = (free: number, total: number) => ({ path: '', free_space: free, total_space: total });

  it('shows folders with the same numbers on one line', () => {
    const disks = groupDisks(folders, [
      info(10 * GiB, 100 * GiB),
      info(10 * GiB - 4096, 100 * GiB),
      info(500 * GiB, 1000 * GiB),
      info(9 * GiB, 100 * GiB),
      info(10 * GiB, 100 * GiB),
    ]);
    expect(disks.map((d) => d.folders.map((f) => f.name))).toEqual([
      ['Download folder', 'Music', 'Other'],
      ['Films'],
      ['Books'],
    ]);
  });

  it('handles folders without numbers', () => {
    const disks = groupDisks(folders.slice(0, 3), [info(-1, -1), info(0, 0)]);
    expect(disks).toHaveLength(1);
    expect(disks[0]).toMatchObject({ free: 0, total: 0 });
    expect(diskUsedPercent(disks[0]!)).toBe(0);
    expect(diskIsLow(disks[0]!)).toBe(false);
  });

  it('names the folders and warns about a full disk', () => {
    expect(diskFolderNames(folders)).toBe('Download folder, Music, Films + 2 more');
    expect(diskFolderNames([folders[1]!, folders[1]!])).toBe('Music');
    expect(diskUsedPercent({ folders, free: 25, total: 100 })).toBe(75);
    expect(diskIsLow({ folders, free: 9, total: 100 })).toBe(true);
    expect(diskIsLow({ folders, free: 10, total: 100 })).toBe(false);
  });
});

describe('recent searches', () => {
  it('remembers words, not hashes', () => {
    expect(isRememberedSearch('ubuntu iso', 'any')).toBe(true);
    expect(isRememberedSearch('LWPNACQDBZRYXW3VHJVCJ64QBZNGHOHHHZWCLNQ', 'tth')).toBe(false);
    expect(isRememberedSearch('  ', 'any')).toBe(false);
  });

  it('lists the newest first', () => {
    const history = ['old', 'new'];
    expect(recentSearches(history)).toEqual(['new', 'old']);
    expect(history).toEqual(['old', 'new']);
  });
});

describe('the order of widgets', () => {
  it('follows the given IDs, with other widgets at the end', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => createWidget('notes', id));
    expect(orderWidgets(list, ['c', 'a']).map((w) => w.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(orderWidgets(list, [])).toEqual(list);
  });
});
