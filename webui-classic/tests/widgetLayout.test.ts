import { describe, expect, it } from 'vitest';
import {
  arrange,
  collides,
  columnOrder,
  fittingUnit,
  moveBox,
  nudgeBox,
  resizeBox,
  sanitizeLayout,
  settle,
  snapColumn,
  tooNarrow,
  type Box,
  type Item,
} from '../src/lib/widgetLayout';

const box = (id: string, x: number, y: number, w = 4, h = 35): Box => ({ id, x, y, w, h });
const at = (boxes: Box[]) => Object.fromEntries(boxes.map((b) => [b.id, [b.x, b.y]]));
const places = (boxes: Box[]) => Object.fromEntries(boxes.map(({ id, x, y }) => [id, { x, y }]));
const overlapping = (boxes: Box[]) => boxes.some((a, i) => boxes.slice(i + 1).some((b) => collides(a, b)));

// Seven widgets as they may look on a window of 16 width steps
const items: Item[] = [
  { id: 'stats', w: 4, h: 50, first: true },
  { id: 'episodes', w: 3, h: 72 },
  { id: 'missing', w: 3, h: 35 },
  { id: 'notes', w: 5, h: 35 },
  { id: 'pms', w: 3, h: 35 },
  { id: 'searches', w: 5, h: 35 },
  { id: 'releases', w: 4, h: 35 },
];

describe('arranging widgets for the first time', () => {
  it('goes row by row, filling free places, as earlier versions did', () => {
    expect(at(arrange(items, {}, 16, false))).toEqual({
      stats: [0, 0],
      episodes: [4, 0],
      missing: [7, 0],
      notes: [10, 0],
      releases: [0, 50],
      pms: [7, 35],
      searches: [10, 35],
    });
  });

  it('then counts column by column, from top to bottom', () => {
    expect(columnOrder(arrange(items, {}, 16, false))).toEqual([
      'stats',
      'releases',
      'episodes',
      'missing',
      'pms',
      'notes',
      'searches',
    ]);
  });

  it('keeps that arrangement when it is arranged by that order', () => {
    const first = arrange(items, {}, 16, false);
    const sorted = columnOrder(first).map((id) => items.find((item) => item.id === id)!);
    const again = arrange(sorted, {}, 16, true);
    expect(columnOrder(again)).toEqual(columnOrder(first));
    expect(overlapping(again)).toBe(false);
  });

  it('fills columns one after the other', () => {
    const same = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, w: 4, h: 35 }));
    expect(at(arrange(same, {}, 12, true))).toEqual({
      a: [0, 0],
      b: [0, 35],
      c: [4, 0],
      d: [4, 35],
      e: [8, 0],
      f: [8, 35],
    });
    expect(Object.values(at(arrange(same, {}, 4, true))).map(([x]) => x)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('makes wide boxes narrower to have room for the columns beside them', () => {
    const wide = [
      { id: 'a', w: 4, h: 35 },
      { id: 'b', w: 6, h: 35 },
    ];
    expect(arrange(wide, {}, 8, true).map(({ x, w }) => [x, w])).toEqual([
      [0, 4],
      [4, 4],
    ]);
    expect(arrange(wide, {}, 10, true).map(({ w }) => w)).toEqual([4, 6]);
    // …but not where there is one column anyway
    expect(arrange(wide, {}, 4, true).map(({ w }) => w)).toEqual([4, 4]);
  });

  it('never goes past the window', () => {
    const wide = [
      { id: 'a', w: 10, h: 35 },
      { id: 'b', w: 10, h: 35 },
      { id: 'c', w: 20, h: 35 },
    ];
    for (const byColumns of [true, false]) {
      const boxes = arrange(wide, {}, 12, byColumns);
      expect(boxes.every((b) => b.x + b.w <= 12)).toBe(true);
      expect(overlapping(boxes)).toBe(false);
    }
  });
});

describe('saved places', () => {
  it('stay the same however wide the window is', () => {
    const saved = places(arrange(items, {}, 16, false));
    for (const columns of [16, 20, 28]) {
      expect(at(arrange(items, saved, columns, false))).toEqual(at(arrange(items, {}, 16, false)));
    }
  });

  it('close up when the box above is smaller or gone', () => {
    const saved = { a: { x: 0, y: 0 }, b: { x: 0, y: 35 }, c: { x: 4, y: 0 } };
    const two = [
      { id: 'a', w: 4, h: 20 },
      { id: 'b', w: 4, h: 35 },
      { id: 'c', w: 4, h: 35 },
    ];
    expect(at(arrange(two, saved, 8, false))).toEqual({ a: [0, 0], b: [0, 20], c: [4, 0] });
    expect(at(arrange(two.slice(1), saved, 8, false))).toEqual({ b: [0, 0], c: [4, 0] });
  });

  it('make way for a box that has grown', () => {
    const saved = { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
    const grown = [
      { id: 'a', w: 6, h: 35 },
      { id: 'b', w: 4, h: 35 },
    ];
    expect(at(arrange(grown, saved, 8, false))).toEqual({ a: [0, 0], b: [4, 35] });
  });

  it('put a new box in the highest free place, and statistics at the top left', () => {
    const saved = { a: { x: 0, y: 0 }, b: { x: 4, y: 0 } };
    const old = [
      { id: 'a', w: 4, h: 70 },
      { id: 'b', w: 4, h: 35 },
    ];
    expect(at(arrange([...old, { id: 'new', w: 4, h: 35 }], saved, 12, false)).new).toEqual([8, 0]);
    expect(at(arrange([...old, { id: 'new', w: 4, h: 35 }], saved, 8, false)).new).toEqual([4, 35]);
    expect(at(arrange([{ id: 'stats', w: 4, h: 35, first: true }, ...old], saved, 8, false))).toEqual({
      stats: [0, 0],
      a: [0, 35],
      b: [4, 0],
    });
  });
});

describe('moving a box', () => {
  const column = [box('a', 0, 0, 4, 10), box('b', 0, 10, 4, 40), box('c', 0, 50, 4, 10), box('d', 4, 0, 4, 20)];

  it('changes nothing when it stays in its place', () => {
    for (const b of column) {
      expect(at(moveBox(column, b.id, { x: b.x, y: b.y }))).toEqual(at(column));
    }
  });

  it('goes below the boxes whose middle is above its top', () => {
    expect(at(moveBox(column, 'b', { x: 0, y: 15 }))).toEqual({ a: [0, 0], b: [0, 10], c: [0, 50], d: [4, 0] });
    expect(at(moveBox(column, 'b', { x: 0, y: 16 }))).toEqual({ a: [0, 0], c: [0, 10], b: [0, 20], d: [4, 0] });
    expect(at(moveBox(column, 'c', { x: 0, y: 0 }))).toEqual({ c: [0, 0], a: [0, 10], b: [0, 20], d: [4, 0] });
  });

  it('moves between columns, and the others close up', () => {
    expect(at(moveBox(column, 'b', { x: 4, y: 0 }))).toEqual({ a: [0, 0], b: [4, 0], c: [0, 10], d: [4, 40] });
    expect(at(moveBox(column, 'd', { x: 8, y: 30 }))).toEqual({ a: [0, 0], b: [0, 10], c: [0, 50], d: [8, 0] });
    expect(overlapping(moveBox(column, 'b', { x: 2, y: 5 }))).toBe(false);
  });

  it('works with the arrow keys', () => {
    expect(at(nudgeBox(column, 'b', 'up', 8)).b).toEqual([0, 0]);
    expect(at(nudgeBox(column, 'b', 'down', 8))).toEqual({ a: [0, 0], c: [0, 10], b: [0, 20], d: [4, 0] });
    expect(at(nudgeBox(column, 'a', 'down', 8))).toEqual({ b: [0, 0], a: [0, 40], c: [0, 50], d: [4, 0] });
    expect(at(nudgeBox(column, 'd', 'right', 12)).d).toEqual([5, 0]);
    expect(nudgeBox(column, 'd', 'right', 8)).toBe(column);
    expect(nudgeBox(column, 'a', 'left', 8)).toBe(column);
    expect(nudgeBox(column, 'a', 'up', 8)).toBe(column);
    expect(nudgeBox(column, 'c', 'down', 8)).toBe(column);
  });

  it('snaps to the edges of the others and stays in the window', () => {
    const others = [box('a', 0, 0), box('b', 7, 0, 3)];
    expect(snapColumn(others, 6, 4, 16)).toBe(7);
    expect(snapColumn(others, 3, 4, 16)).toBe(4);
    expect(snapColumn(others, 12, 4, 16)).toBe(12);
    expect(snapColumn(others, 40, 4, 16)).toBe(12);
    expect(snapColumn(others, -3, 4, 16)).toBe(0);
  });
});

describe('resizing a box', () => {
  const row = [box('a', 0, 0), box('b', 4, 0), box('c', 4, 35)];

  it('keeps it where it is and moves the others out of its way', () => {
    expect(at(resizeBox(row, box('a', 0, 0, 6, 35)))).toEqual({ a: [0, 0], b: [4, 35], c: [4, 70] });
    expect(at(resizeBox(row, box('c', 2, 35, 6, 35)))).toEqual({ a: [0, 0], b: [4, 0], c: [2, 35] });
    expect(at(resizeBox(row, box('a', 0, 0, 4, 35)))).toEqual(at(row));
  });

  it('lets it move up afterwards if there is room', () => {
    const boxes = [box('a', 0, 0), box('b', 4, 0, 4, 10), box('c', 8, 35)];
    expect(at(settle(resizeBox(boxes, box('c', 5, 35, 7, 35)))).c).toEqual([5, 10]);
  });
});

describe('the window', () => {
  const boxes = [box('stats', 0, 0), box('a', 4, 0, 3), box('b', 10, 0, 6)];

  it('keeps the size of the widgets when it is wide enough, and shrinks them when it is not', () => {
    expect(fittingUnit(116, 3000, boxes)).toBe(116);
    expect(fittingUnit(116, 16 * 116 - 8, boxes)).toBe(116);
    expect(fittingUnit(116, 16 * 80 - 8, boxes)).toBe(80);
  });

  it('is too narrow when a widget would be of no use', () => {
    expect(tooNarrow(boxes, 60, 'stats')).toBe(false);
    expect(tooNarrow(boxes, 50, 'stats')).toBe(true);
    expect(tooNarrow(boxes.slice(1), 53, undefined)).toBe(false);
    expect(tooNarrow(boxes.slice(1), 52, undefined)).toBe(true);
    // Larger text needs wider statistics
    expect(tooNarrow(boxes, 60, 'stats', 1.4)).toBe(true);
    expect(tooNarrow(boxes, 72, 'stats', 1.4)).toBe(false);
  });
});

describe('stored places', () => {
  it('drops unusable ones', () => {
    expect(sanitizeLayout(null)).toBeNull();
    expect(sanitizeLayout({ unit: 'x', items: {} })).toBeNull();
    expect(sanitizeLayout({ unit: 5, items: {} })).toBeNull();
    expect(sanitizeLayout({ unit: 100 })).toBeNull();
    expect(
      sanitizeLayout({ unit: 116.5, items: { a: { x: 1.4, y: -3 }, b: { x: 'x', y: 0 }, c: null } }),
    ).toEqual({ unit: 116.5, items: { a: { x: 1, y: 0 } } });
  });
});
