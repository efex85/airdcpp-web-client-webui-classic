// Combines changes made on two devices, based on the version both started from

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => key in b && equal((a as any)[key], (b as any)[key]))
  );
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

type Item = { id: string };

const isItemList = (value: unknown): value is Item[] =>
  Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === 'string');

/**
 * The order of this device is used, unless the other device has reordered the items. Items that are new on the
 * other side are added at the end. A removal wins, unless the other side has changed the item.
 */
const mergeLists = (base: Item[], mine: Item[], theirs: Item[]): Item[] => {
  const find = (list: Item[], id: string) => list.find((item) => item.id === id);
  // A reordering on this device is kept if the other device didn't change the order
  const commonIds = (list: Item[], within: Item[]) => list.filter((item) => find(within, item.id)).map((item) => item.id);
  const theirsReordered = !equal(commonIds(theirs, base), commonIds(base, theirs));
  const [first, second] = theirsReordered ? [theirs, mine] : [mine, theirs];
  const ids = [...first, ...second.filter((item) => !find(first, item.id))].map((item) => item.id);

  return ids.flatMap((id) => {
    const before = find(base, id);
    const a = find(mine, id);
    const b = find(theirs, id);
    if (a && b) {
      return [merge(before, a, b) as Item];
    }

    const remaining = (a ?? b)!;
    // Only on one side: either new, or removed on the other side
    return !before || !equal(before, remaining) ? [remaining] : [];
  });
};

/** Three-way merge; where both sides changed the same value, mine is used */
export const merge = <T>(base: T | undefined, mine: T, theirs: T): T => {
  if (equal(mine, theirs) || equal(theirs, base)) {
    return mine;
  }

  if (equal(mine, base)) {
    return theirs;
  }

  if (isItemList(mine) && isItemList(theirs)) {
    return mergeLists(isItemList(base) ? base : [], mine, theirs) as T;
  }

  if (isObject(mine) && isObject(theirs)) {
    const before: Record<string, unknown> = isObject(base) ? base : {};
    const keys = new Set([...Object.keys(theirs), ...Object.keys(mine)]);
    const entries = [...keys].map((key) => [key, merge(before[key], mine[key], theirs[key])]);
    return Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as T;
  }

  return mine;
};

export const CONFLICT_MARKER = '----- Also written on this device -----';

/** Texts can't be merged reliably: if both sides changed the text, both versions are kept */
export const mergeText = (base: string | undefined, mine: string, theirs: string): string => {
  if (mine === theirs || mine === base) {
    return theirs;
  }

  if (theirs === base || theirs === '') {
    return mine;
  }

  // One version already contains the other
  if (theirs.includes(mine)) {
    return theirs;
  }

  if (mine.includes(theirs)) {
    return mine;
  }

  return `${theirs}\n\n${CONFLICT_MARKER}\n${mine}`;
};
