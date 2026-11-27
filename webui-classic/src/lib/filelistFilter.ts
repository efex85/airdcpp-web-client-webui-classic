// The filter of the file lists. It matches like the one of the Windows client: ListFilter and StringMatch in its
// source, and the dupe checkboxes of its filtered list view.

import type { FilelistItem } from '../api/types';
import { formatDate, formatSize } from './format';

export type FilterColumn = 'name' | 'type' | 'exact' | 'size' | 'date' | 'tth' | 'any';
export type TextMethod = 'partial' | 'regex' | 'wildcard' | 'exact';
export type Operator = '=' | '>=' | '<=' | '>' | '<' | '!=';
export type FilterMethod = TextMethod | Operator;

export const FILTER_COLUMNS: [FilterColumn, string][] = [
  ['name', 'Name'],
  ['type', 'Type'],
  ['exact', 'Exact size'],
  ['size', 'Size'],
  ['date', 'Date'],
  ['tth', 'TTH'],
  ['any', 'Any'],
];

const TEXT_METHODS: [TextMethod, string][] = [
  ['partial', 'Partial match'],
  ['regex', 'RegEx'],
  ['wildcard', 'Wildcard'],
  ['exact', 'Exact match'],
];

const OPERATORS: Operator[] = ['=', '>=', '<=', '>', '<', '!='];

/** Whether values of the column can be compared as numbers */
export const isNumericColumn = (column: FilterColumn) => ['exact', 'size', 'date', 'any'].includes(column);

export const isOperator = (method: FilterMethod): method is Operator => (OPERATORS as string[]).includes(method);

export const methodsFor = (column: FilterColumn): [FilterMethod, string][] => [
  ...TEXT_METHODS,
  ...(isNumericColumn(column) ? OPERATORS.map((o): [FilterMethod, string] => [o, o]) : []),
];

export interface FilterInput {
  text: string;
  column: FilterColumn;
  method: FilterMethod;
  /** The method was chosen by typing an operator in front of the text */
  typed: boolean;
}

export const emptyFilter: FilterInput = { text: '', column: 'any', method: 'partial', typed: false };

/** ">=1 GiB" -> the operator and "1 GiB" */
export const splitOperator = (text: string): { operator: Operator | null; rest: string } => {
  const match = /^(>=|<=|==|!=|<|>|=)/.exec(text);
  if (!match) {
    return { operator: null, rest: text };
  }

  return { operator: match[1] === '==' ? '=' : (match[1] as Operator), rest: text.slice(match[1].length) };
};

/** Typing an operator selects it; removing it goes back to partial matching */
export const typeText = (filter: FilterInput, text: string): FilterInput => {
  const { operator } = splitOperator(text);
  if (operator && isNumericColumn(filter.column)) {
    return { ...filter, text, method: operator, typed: true };
  }

  return { ...filter, text, method: filter.typed ? 'partial' : filter.method };
};

export const chooseColumn = (filter: FilterInput, column: FilterColumn): FilterInput => {
  const method = !isNumericColumn(column) && isOperator(filter.method) ? 'partial' : filter.method;
  return typeText({ ...filter, column, method, typed: false }, filter.text);
};

export const chooseMethod = (filter: FilterInput, method: FilterMethod): FilterInput => ({
  ...filter,
  method,
  typed: false,
});

/** Empties the text, like switching the folder does */
export const clearText = (filter: FilterInput): FilterInput => typeText(filter, '');

/** The leading number of a text; both "1.5" and "1,5" work */
const toNumber = (text: string): number => parseFloat(text.replace(/[.,](?=[^.,]*$)/, '.')) || 0;

const SIZE_UNITS: [string, number][] = [
  ['tib', 1024 ** 4],
  ['gib', 1024 ** 3],
  ['mib', 1024 ** 2],
  ['kib', 1024],
  ['tb', 1000 ** 4],
  ['gb', 1000 ** 3],
  ['mb', 1000 ** 2],
  ['kb', 1000],
];

const DAY = 86400;
const TIME_UNITS: [string, number][] = [
  ['y', 365 * DAY],
  ['m', 30 * DAY],
  ['w', 7 * DAY],
  ['d', DAY],
  ['h', 3600],
  ['min', 60],
  ['s', 1],
];

const findUnit = (text: string, units: [string, number][]) =>
  units.find(([unit]) => text.toLowerCase().endsWith(unit));

const parseSize = (text: string): number => {
  const unit = findUnit(text, SIZE_UNITS);
  return unit ? toNumber(text.slice(0, -unit[0].length)) * unit[1] : toNumber(text);
};

/** An age such as "2d" becomes the time that long ago */
const parseTime = (text: string, now: number): number => {
  const unit = findUnit(text, TIME_UNITS);
  const age = (parseInt(text, 10) || 0) * (unit ? unit[1] : 1);
  return age > 0 ? now - age : age;
};

const columnText = (item: FilelistItem, column: Exclude<FilterColumn, 'any'>): string => {
  switch (column) {
    case 'name':
      return item.name;
    case 'type':
      return item.type.str;
    case 'exact':
      return item.size >= 0 ? `${item.size.toLocaleString()} B` : '';
    case 'size':
      return formatSize(item.size);
    case 'date':
      return formatDate(item.time);
    case 'tth':
      return item.tth ?? '';
  }
};

const compare = (value: number, operator: Operator, wanted: number): boolean => {
  switch (operator) {
    case '=':
      return value === wanted;
    case '!=':
      return value !== wanted;
    case '>=':
      return value >= wanted;
    case '<=':
      return value <= wanted;
    case '>':
      return value > wanted;
    case '<':
      return value < wanted;
  }
};

// A larger age is an earlier time
const REVERSED: Record<Operator, Operator> = { '=': '=', '!=': '!=', '>=': '<=', '<=': '>=', '>': '<', '<': '>' };

const numericTest = (
  pattern: string,
  column: FilterColumn,
  operator: Operator,
  now: number,
): ((item: FilelistItem) => boolean) => {
  // With "Any" the unit tells what is meant; a number without one matches nothing
  const kind =
    column === 'date' || (column === 'any' && findUnit(pattern, TIME_UNITS))
      ? 'time'
      : column !== 'any' || findUnit(pattern, SIZE_UNITS)
        ? 'size'
        : null;

  if (kind === 'time') {
    const wanted = parseTime(pattern, now);
    return (item) => compare(item.time || 0, REVERSED[operator], wanted);
  }

  if (kind === 'size') {
    const wanted = parseSize(pattern);
    return (item) => compare(item.size, operator, wanted);
  }

  return () => false;
};

const escape = (text: string) => text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');

/** null for an invalid regular expression */
const textTest = (pattern: string, method: TextMethod): ((value: string) => boolean) | null => {
  const lower = pattern.toLowerCase();
  switch (method) {
    case 'partial': {
      // Every word has to be there, in any order
      const words = lower.split(' ').filter(Boolean);
      return (value) => {
        const text = value.toLowerCase();
        return words.every((w) => text.includes(w));
      };
    }
    case 'exact':
      return (value) => value.toLowerCase() === lower;
    case 'wildcard': {
      // * and ? stand for any text and any character, | separates alternatives; the whole value has to match
      const source = escape(pattern).replace(/\\\*/g, '.*').replace(/\\\?/g, '.').replace(/\\\|/g, '|');
      const expression = new RegExp(`^(${source})$`, 'i');
      return (value) => expression.test(value);
    }
    case 'regex':
      try {
        // Case matters, as in the Windows client
        const expression = new RegExp(pattern);
        return (value) => expression.test(value);
      } catch {
        return null;
      }
  }
};

/**
 * Which items to show for the text. "exclude" shows the ones that don't match instead. An empty text shows
 * everything; null means that the text is not a valid regular expression.
 */
export const filelistMatcher = (
  { text, column, method }: FilterInput,
  exclude: boolean,
  now = Math.floor(Date.now() / 1000),
): ((item: FilelistItem) => boolean) | null => {
  const pattern = isNumericColumn(column) ? splitOperator(text).rest : text;
  if (!pattern) {
    return () => true;
  }

  let test: (item: FilelistItem) => boolean;
  if (isOperator(method)) {
    test = numericTest(pattern, column, method, now);
  } else {
    const matches = textTest(pattern, method);
    if (!matches) {
      return null;
    }

    const columns =
      column === 'any' ? FILTER_COLUMNS.map(([id]) => id).filter((id) => id !== 'any') : [column];
    // An empty value never matches
    test = (item) =>
      columns.some((c) => {
        const value = columnText(item, c as Exclude<FilterColumn, 'any'>);
        return !!value && matches(value);
      });
  }

  return exclude ? (item) => !test(item) : test;
};

export interface DupeOptions {
  showShared: boolean;
  showQueued: boolean;
  /** "Treat partial dupes similar to exact dupes" */
  partialDupes: boolean;
}

const QUEUE_MIXED = ['queue_partial', 'share_queue_finished', 'share_queue', 'queue_finished'];
const FINISHED_MIXED = ['finished_partial', 'share_queue_finished', 'share_finished', 'queue_finished'];
const SHARE_MIXED = ['share_partial', 'share_queue_finished', 'share_queue', 'share_finished'];

/** The "Queued" and "Shared" checkboxes; "Queued" covers finished downloads as well */
export const dupeShown = (dupe: string | undefined, options: DupeOptions): boolean => {
  if (!dupe) {
    return true;
  }

  const { showShared, showQueued, partialDupes } = options;
  const is = (full: string, mixed: string[], partial: boolean) => dupe === full || (partial && mixed.includes(dupe));
  const shared = (partial: boolean) => is('share_full', SHARE_MIXED, partial);
  const queued = (partial: boolean) =>
    is('queue_full', QUEUE_MIXED, partial) || is('finished_full', FINISHED_MIXED, partial);

  if (!showQueued && queued(partialDupes)) {
    return showShared && shared(false);
  }

  if (!showShared && shared(partialDupes)) {
    return showQueued && queued(false);
  }

  return true;
};
