// Where the widgets of the Home window are on large screens. A widget stays in the place it was given, however wide
// the window is; only what is above it decides how far down it is. The places are stored in each browser.

import { BOX_UNITS, GAP } from './widgetSizes';

/** `x` and `w` are in width steps, `y` and `h` in rows */
export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Layout {
  /** Pixels from one width step to the next */
  unit: number;
  items: Record<string, Position>;
}

/** A widget that is to be placed */
export interface Item {
  id: string;
  w: number;
  h: number;
  /** Without a place of its own it is put at the top left, before the others (System information) */
  first?: boolean;
}

/** A shrunk widget narrower than this many pixels is of no use: the widgets are then stacked */
export const MIN_PIXELS = 150;
/** …and the tables of System information need more, in proportion to the text size */
export const MIN_STATS_PIXELS = 200;

/** Do two boxes share a part of their width? */
const sameColumn = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w;
export const collides = (a: Box, b: Box) => sameColumn(a, b) && a.y < b.y + b.h && b.y < a.y + a.h;

const byRow = (a: Box, b: Box) => a.y - b.y || a.x - b.x;

/** The first column from top to bottom, then the next: the order of the widgets on phones */
export const columnOrder = (boxes: Box[]): string[] =>
  boxes
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((box) => box.id);

/** The right edge of the layout in width steps */
export const rightEdge = (boxes: Box[]): number => Math.max(0, ...boxes.map((box) => box.x + box.w));

/** The lowest free row below those of the boxes that share a column with this one */
const below = (box: Box, others: Box[]) =>
  others.reduce((row, other) => (sameColumn(box, other) ? Math.max(row, other.y + other.h) : row), 0);

/**
 * Moves every box up as far as it goes, below those before it in the list. A `fixed` box isn't moved, and the
 * others make way for it.
 */
export const compact = (boxes: Box[], fixed?: Box): Box[] => {
  const placed: Box[] = [];
  for (const box of boxes) {
    let y = below(box, placed);
    if (fixed && collides({ ...box, y }, fixed)) {
      y = fixed.y + fixed.h;
    }

    placed.push({ ...box, y });
  }

  return placed;
};

export const settle = (boxes: Box[]): Box[] => compact(boxes.slice().sort(byRow));

/**
 * The layout while a box is dragged to a place: it goes below the boxes whose middle is above its top, and before
 * the others.
 */
export const moveBox = (boxes: Box[], id: string, to: Position): Box[] => {
  const moving = boxes.find((box) => box.id === id);
  if (!moving) {
    return boxes;
  }

  const others = settle(boxes.filter((box) => box !== moving));
  const above = (box: Box) => box.y + box.h / 2 < to.y;
  return compact([...others.filter(above), { ...moving, ...to }, ...others.filter((box) => !above(box))]);
};

/** The layout while a box is resized: it stays in its row, and the others make way */
export const resizeBox = (boxes: Box[], resized: Box): Box[] => [
  ...compact(boxes.filter((box) => box.id !== resized.id).sort(byRow), resized),
  resized,
];

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Moves a box with the keyboard: a step to the side, or past the box above or below it */
export const nudgeBox = (boxes: Box[], id: string, direction: Direction, columns: number): Box[] => {
  const box = boxes.find((b) => b.id === id);
  if (!box) {
    return boxes;
  }

  if (direction === 'left' || direction === 'right') {
    const x = Math.max(0, Math.min(columns - box.w, box.x + (direction === 'left' ? -1 : 1)));
    return x === box.x ? boxes : moveBox(boxes, id, { x, y: box.y });
  }

  const others = boxes.filter((b) => b.id !== id && sameColumn(b, box));
  if (direction === 'up') {
    const next = others.filter((b) => b.y < box.y).sort((a, b) => b.y - a.y)[0];
    return next ? moveBox(boxes, id, { x: box.x, y: next.y }) : boxes;
  }

  const next = others.filter((b) => b.y > box.y).sort(byRow)[0];
  if (!next) {
    return boxes;
  }

  // Where that box is once this one has left its place
  const moved = settle(boxes.filter((b) => b.id !== id)).find((b) => b.id === next.id)!;
  return moveBox(boxes, id, { x: box.x, y: moved.y + moved.h / 2 + 0.5 });
};

/** A dragged box that comes within one step of the edge of another one is put exactly there */
export const snapColumn = (others: Box[], x: number, width: number, columns: number): number => {
  const limit = Math.max(0, columns - width);
  const wanted = Math.max(0, Math.min(limit, x));
  const nearest = (edges: number[]) =>
    edges
      .filter((edge) => edge >= 0 && edge <= limit && Math.abs(edge - wanted) <= 1)
      .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0];
  // Below or above another box first, then beside one
  return nearest(others.map((b) => b.x)) ?? nearest(others.map((b) => b.x + b.w)) ?? wanted;
};

/** Left to right, row by row, each in the first free place: how earlier versions placed the widgets */
const rowByRow = (items: Item[], columns: number): Box[] =>
  items.reduce<Box[]>((placed, item) => {
    const box = { ...item, w: Math.min(item.w, columns), x: 0, y: 0 };
    const rows = [...new Set([0, ...placed.map((b) => b.y + b.h)])].sort((a, b) => a - b);
    for (const y of rows) {
      for (let x = 0; x <= columns - box.w; x++) {
        const candidate = { id: box.id, w: box.w, h: box.h, x, y };
        if (!placed.some((other) => collides(candidate, other))) {
          return [...placed, candidate];
        }
      }
    }

    return placed;
  }, []);

/** Narrows the widest columns until they fit side by side, but none below the width of a normal box */
const narrowed = (widths: number[], columns: number): number[] => {
  const result = widths.slice();
  const sum = () => result.reduce((total, w) => total + w, 0);
  while (sum() > columns && Math.max(...result) > BOX_UNITS) {
    result[result.indexOf(Math.max(...result))]!--;
  }

  return result;
};

/**
 * The first column from top to bottom, then the next, with columns of about the same height. Where wider widgets
 * leave no room for a column, they are made narrower.
 */
const columnByColumn = (items: Item[], columns: number): Box[] => {
  const total = items.reduce((sum, item) => sum + item.h, 0);
  for (let count = Math.max(1, Math.floor(columns / BOX_UNITS)); ; count--) {
    const groups: Item[][] = [[]];
    let height = 0;
    for (const item of items) {
      if (height && height + item.h / 2 > total / count && groups.length < count) {
        groups.push([]);
        height = 0;
      }

      groups[groups.length - 1]!.push(item);
      height += item.h;
    }

    const widest = groups.map((group) => Math.min(columns, Math.max(0, ...group.map((item) => item.w))));
    // A single column keeps the widths: there is nothing beside it to make room for
    const widths = count === 1 ? widest : narrowed(widest, columns);
    if (count === 1 || widths.reduce((sum, w) => sum + w, 0) <= columns) {
      let x = 0;
      return groups.flatMap((group, i) => {
        let y = 0;
        const boxes = group.map(({ id, w, h }) => {
          const box = { id, w: Math.min(w, widths[i]!), h, x, y };
          y += h;
          return box;
        });
        x += widths[i]!;
        return boxes;
      });
    }
  }
};

/**
 * The places of the widgets: the saved ones, and for new widgets the highest free place. If none has a saved place,
 * they are arranged for a window of `columns` width steps.
 */
export const arrange = (items: Item[], saved: Record<string, Position>, columns: number, byColumns: boolean): Box[] => {
  const place = (item: Item): Position | undefined => (Object.hasOwn(saved, item.id) ? saved[item.id] : undefined);
  if (!items.some(place)) {
    return (byColumns ? columnByColumn : rowByRow)(items, columns);
  }

  const known = items.flatMap((item) => {
    const position = place(item) ?? (item.first ? { x: 0, y: -1 } : undefined);
    return position ? [{ id: item.id, w: item.w, h: item.h, ...position }] : [];
  });
  const boxes = settle(known);
  const width = Math.max(columns, rightEdge(boxes));
  for (const { id, w, h } of items.filter((item) => !place(item) && !item.first)) {
    let best: Box | null = null;
    for (let x = 0; x <= Math.max(0, width - w); x++) {
      const box = { id, w, h, x, y: 0 };
      box.y = below(box, boxes);
      if (!best || box.y < best.y) {
        best = box;
      }
    }

    boxes.push(best!);
  }

  return boxes;
};

/** The step of a window of this width: the saved one, or less if the layout wouldn't fit */
export const fittingUnit = (unit: number, width: number, boxes: Box[]): number => {
  const edge = rightEdge(boxes);
  return edge * unit - GAP > width ? (width + GAP) / edge : unit;
};

export const tooNarrow = (boxes: Box[], unit: number, statistics: string | undefined, textScale = 1): boolean =>
  boxes.some((box) => box.w * unit - GAP < (box.id === statistics ? MIN_STATS_PIXELS * textScale : MIN_PIXELS));

export const sanitizeLayout = (value: unknown): Layout | null => {
  const { unit, items } = (value ?? {}) as Partial<Layout>;
  if (typeof unit !== 'number' || !(unit >= 20 && unit <= 2000) || !items || typeof items !== 'object') {
    return null;
  }

  const whole = (n: unknown, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : null;
  return {
    unit,
    items: Object.fromEntries(
      Object.entries(items).flatMap(([id, item]) => {
        const x = whole((item as Position | null)?.x, 400);
        const y = whole((item as Position | null)?.y, 100_000);
        return x === null || y === null ? [] : [[id, { x, y }]];
      }),
    ),
  };
};
