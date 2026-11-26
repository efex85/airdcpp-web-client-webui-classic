// Row ordering, grouping and virtualization math of the list view

export type SortValue = string | number;

export interface SortState {
  column: string;
  desc: boolean;
}

export interface Group {
  id: string;
  title: string;
}

export type Row<T> =
  | { kind: 'group'; key: string; group: Group; count: number; collapsed: boolean }
  | { kind: 'item'; key: string; item: T };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const compareValues = (a: SortValue, b: SortValue): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));

/** Stable sort by the column value; the sort values are computed only once per item */
export const sortItems = <T>(items: T[], value: ((item: T) => SortValue) | undefined, desc: boolean): T[] => {
  if (!value) {
    return items;
  }

  const direction = desc ? -1 : 1;
  return items
    .map((item, index) => ({ item, index, value: value(item) }))
    .sort((a, b) => compareValues(a.value, b.value) * direction || a.index - b.index)
    .map((x) => x.item);
};

/** Items of the same group are listed under a header, in the order of the given groups */
export const buildRows = <T>(
  items: T[],
  key: (item: T) => string,
  groups?: Group[],
  groupOf?: (item: T) => string,
  collapsed: ReadonlySet<string> = new Set(),
): Row<T>[] => {
  if (!groups || !groupOf) {
    return items.map((item) => ({ kind: 'item', key: key(item), item }));
  }

  const members = new Map<string, T[]>(groups.map((g) => [g.id, []]));
  for (const item of items) {
    members.get(groupOf(item))?.push(item);
  }

  const rows: Row<T>[] = [];
  for (const group of groups) {
    const list = members.get(group.id)!;
    if (!list.length) {
      continue;
    }

    const isCollapsed = collapsed.has(group.id);
    rows.push({ kind: 'group', key: `group:${group.id}`, group, count: list.length, collapsed: isCollapsed });
    if (!isCollapsed) {
      for (const item of list) {
        rows.push({ kind: 'item', key: key(item), item });
      }
    }
  }

  return rows;
};

/** Range of rows to render, [start, end) */
export const visibleRange = (scrollTop: number, height: number, rowHeight: number, count: number, overscan = 8) => {
  const start = Math.max(0, Math.min(count, Math.floor(scrollTop / rowHeight) - overscan));
  const end = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  return { start, end: Math.max(start, end) };
};

/** New scroll position that brings a row into view */
export const scrollToRow = (index: number, scrollTop: number, viewHeight: number, rowHeight: number): number => {
  const top = index * rowHeight;
  if (top < scrollTop) {
    return top;
  }

  return top + rowHeight > scrollTop + viewHeight ? top + rowHeight - viewHeight : scrollTop;
};
