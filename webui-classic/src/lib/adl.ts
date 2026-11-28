// ADL Search: searches that are matched against file lists, as in the Windows client. The matching files and folders
// appear in result folders at the top of the list, named "<<<Destination>>>".
import type { AdlSearch, AdlSizeUnit, AdlSourceType, FilelistItem } from '../api/types';

export const SOURCE_TYPES: { value: AdlSourceType; label: string }[] = [
  { value: 'file', label: 'Filename' },
  { value: 'directory', label: 'Directory' },
  { value: 'full_path', label: 'Full path' },
];

export const SIZE_UNITS: AdlSizeUnit[] = ['B', 'KiB', 'MiB', 'GiB'];

/** The largest size that the client accepts, in any unit */
export const MAX_SIZE = 1_000_000_000;

/** Where results go when no destination is given */
export const DEFAULT_DESTINATION = 'ADLSearch';

export const sourceTypeLabel = (type: AdlSourceType) => SOURCE_TYPES.find((t) => t.value === type)?.label ?? type;

export const newSearch = (): AdlSearch => ({
  pattern: '',
  regex: false,
  source_type: 'file',
  destination: '',
  min_size: -1,
  max_size: -1,
  size_unit: 'B',
  comment: '',
  active: true,
  download: false,
});

/** A size limit as it is shown and typed: empty for none */
export const sizeText = (value: number) => (value < 0 ? '' : String(value));

/** The typed text of a size limit; null when it isn't a whole number that the client accepts */
export const parseSize = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return -1;
  }

  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  return value <= MAX_SIZE ? value : null;
};

/** Sizes aren't used by searches for folders */
export const sizeLabel = (search: AdlSearch, value: number) =>
  search.source_type === 'directory' || value < 0 ? '' : `${value} ${search.size_unit}`;

/** Why the values can't be saved */
export const searchError = (search: Pick<AdlSearch, 'pattern' | 'destination'>): string | null => {
  if (!search.pattern.trim()) {
    return 'Enter a search string';
  }

  return /[/\\]/.test(search.destination) ? 'The destination is the name of a folder and can’t contain / or \\' : null;
};

/* The list of searches. Their order matters, and a search has no ID of its own. */

export interface AdlRow {
  key: string;
  search: AdlSearch;
}

let keys = 0;
export const newRow = (search: AdlSearch): AdlRow => ({ key: `adl${++keys}`, search });

const signature = (search: AdlSearch) => JSON.stringify(Object.entries(search).sort(([a], [b]) => a.localeCompare(b)));

/** Rows for searches that were fetched again: unchanged searches keep their key, so that they stay selected */
export const keepKeys = (previous: AdlRow[], searches: AdlSearch[]): AdlRow[] => {
  const unused = new Map<string, AdlRow[]>();
  for (const row of previous) {
    const id = signature(row.search);
    unused.set(id, [...(unused.get(id) ?? []), row]);
  }

  return searches.map((search) => {
    const old = unused.get(signature(search))?.shift();
    return old ? { key: old.key, search } : newRow(search);
  });
};

/** A new search goes before the selected one, otherwise last */
export const insertRow = (rows: AdlRow[], row: AdlRow, before?: string): AdlRow[] => {
  const index = rows.findIndex((r) => r.key === before);
  return index === -1 ? [...rows, row] : [...rows.slice(0, index), row, ...rows.slice(index)];
};

export const replaceRow = (rows: AdlRow[], row: AdlRow): AdlRow[] =>
  rows.some((r) => r.key === row.key) ? rows.map((r) => (r.key === row.key ? row : r)) : [...rows, row];

/** Moves the chosen rows one step up (-1) or down (1); those that are against the end stay */
export const moveRows = (rows: AdlRow[], chosen: ReadonlySet<string>, step: -1 | 1): AdlRow[] => {
  const result = rows.slice();
  const order = result.map((_, i) => i);
  if (step === 1) {
    order.reverse();
  }

  for (const i of order) {
    const j = i + step;
    if (chosen.has(result[i].key) && result[j] && !chosen.has(result[j].key)) {
      [result[i], result[j]] = [result[j], result[i]];
    }
  }

  return result;
};

/* Results in a file list */

/** A result folder at the top of a list */
export const isResultFolder = (item: Pick<FilelistItem, 'adl' | 'type'>) =>
  !!item.adl && item.type.id === 'directory' && !item.adl.path;

/** Where a matched file or folder is in the list; undefined for everything else */
export const originPath = (item: Pick<FilelistItem, 'adl'>) => item.adl?.path || undefined;

/** The paths of result folders and everything in them */
export const isResultPath = (path: string) => path.startsWith('/<<<');

/** "<<<Name>>>" -> "Name", as folder names on disk can't contain these characters on all systems */
export const downloadName = (name: string) => /^<<<(.*)>>>$/.exec(name)?.[1] ?? name;
