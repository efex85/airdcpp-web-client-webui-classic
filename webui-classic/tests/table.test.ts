import { describe, expect, it } from 'vitest';
import { buildRows, scrollToRow, sortItems, visibleRange } from '../src/lib/table';
import { emptySelection, moveCursor, select, selectAll } from '../src/lib/selection';
import { addDirectory, treeRows, type Tree } from '../src/lib/tree';

describe('table', () => {
  it('sorts names with numbers in natural order and keeps ties stable', () => {
    expect(sortItems(['f10', 'f2', 'F1'], (x) => x, false)).toEqual(['F1', 'f2', 'f10']);
    const items = [{ n: 'a', s: 1 }, { n: 'b', s: 2 }, { n: 'c', s: 1 }];
    expect(sortItems(items, (x) => x.s, true).map((x) => x.n)).toEqual(['b', 'a', 'c']);
    expect(sortItems(items, undefined, false)).toBe(items);
  });

  it('lists group members under headers, hides empty groups and collapsed items', () => {
    const groups = [{ id: 'op', title: 'Operators' }, { id: 'bot', title: 'Bots' }, { id: 'user', title: 'Users' }];
    const rows = buildRows(['u1', 'o1', 'u2'], (x) => x, groups, (x) => (x[0] === 'o' ? 'op' : 'user'), new Set(['user']));
    expect(rows.map((r) => r.key)).toEqual(['group:op', 'o1', 'group:user']);
  });

  it('renders only the rows around the viewport', () => {
    expect(visibleRange(0, 100, 20, 1000, 2)).toEqual({ start: 0, end: 7 });
    expect(visibleRange(10000, 100, 20, 1000, 2)).toEqual({ start: 498, end: 507 });
    expect(visibleRange(10000, 100, 20, 3, 2)).toEqual({ start: 3, end: 3 });
  });

  it('scrolls just far enough to show a row', () => {
    expect(scrollToRow(0, 100, 100, 20)).toBe(0);
    expect(scrollToRow(10, 0, 100, 20)).toBe(120);
    expect(scrollToRow(2, 0, 100, 20)).toBe(0);
  });
});

describe('selection', () => {
  const order = ['a', 'b', 'c', 'd'];
  const keys = (s: { keys: ReadonlySet<string> }) => [...s.keys].sort();

  it('replaces, toggles and extends', () => {
    const one = select(emptySelection, order, 'b');
    expect(keys(one)).toEqual(['b']);
    expect(keys(select(one, order, 'd', { shift: true }))).toEqual(['b', 'c', 'd']);
    const two = select(one, order, 'd', { ctrl: true });
    expect(keys(two)).toEqual(['b', 'd']);
    expect(keys(select(two, order, 'b', { ctrl: true }))).toEqual(['d']);
    expect(keys(selectAll(one, order))).toEqual(order);
  });

  it('moves the cursor and stays inside the list', () => {
    const first = moveCursor(emptySelection, order, 1, false);
    expect(first.cursor).toBe('a');
    expect(moveCursor(first, order, -5, false).cursor).toBe('a');
    expect(keys(moveCursor(first, order, 2, true))).toEqual(['a', 'b', 'c']);
    expect(moveCursor(first, [], 1, false)).toBe(first);
  });
});

describe('file list tree', () => {
  const empty: Tree = new Map();

  it('adds the parents of a directory that was opened directly', () => {
    const tree = addDirectory(empty, '/Share/Music/', [{ path: '/Share/Music/Album/', name: 'Album' }]);
    const rows = treeRows(tree, new Set(['/', '/Share/', '/Share/Music/']), '/Share/Music/');
    expect(rows.map((r) => [r.node.name, r.depth])).toEqual([
      ['/', 0],
      ['Share', 1],
      ['Music', 2],
      ['Album', 3],
    ]);
  });

  it('keeps what was loaded earlier', () => {
    let tree = addDirectory(empty, '/Share/', [{ path: '/Share/Music/', name: 'Music' }]);
    tree = addDirectory(tree, '/', [{ path: '/Share/', name: 'Share' }]);
    expect(tree.get('/Share/')?.children).toEqual(['/Share/Music/']);
  });
});
