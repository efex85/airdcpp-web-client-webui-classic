import { describe, expect, it } from 'vitest';
import { CONFLICT_MARKER, equal, merge, mergeText } from '../src/lib/merge';
import { sanitizeStartup, startupTabs } from '../src/lib/startup';
import { rememberWindow, windowAfterClose } from '../src/lib/windowHistory';
import { createWidget, DEFAULT_WIDGETS, moveWidget, newWidgetId, sanitizeWidgets } from '../src/lib/widgets';
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

  it('uses the defaults if nothing sensible is stored', () => {
    expect(sanitizeWidgets(null)).toBe(DEFAULT_WIDGETS);
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
