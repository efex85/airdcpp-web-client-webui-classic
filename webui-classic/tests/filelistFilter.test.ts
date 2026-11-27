import { describe, expect, it } from 'vitest';
import type { FilelistItem } from '../src/api/types';
import {
  chooseColumn,
  chooseMethod,
  clearText,
  dupeShown,
  emptyFilter,
  filelistMatcher,
  methodsFor,
  typeText,
  type FilterColumn,
  type FilterMethod,
} from '../src/lib/filelistFilter';
import { formatDate } from '../src/lib/format';

const NOW = 1_800_000_000;
const DAY = 86400;

const file = (name: string, size: number, daysOld: number, tth = 'AAAA'): FilelistItem => ({
  id: 0,
  name,
  type: { id: 'file', content_type: 'other', str: name.split('.').pop()! },
  size,
  time: daysOld < 0 ? 0 : NOW - daysOld * DAY,
  path: `/${name}`,
  tth,
  dupe: null,
  complete: true,
});

const folder: FilelistItem = {
  ...file('Linux Images', 5 * 1024 ** 3, 10, ''),
  type: { id: 'directory', str: '3 files', files: 3, directories: 0 },
};

const items = [
  folder,
  file('debian-13-netinst.iso', 700 * 1024 ** 2, 1, 'QWERTY234'),
  file('Debian notes.txt', 1500, 40, 'ZZZZ'),
  file('readme.NFO', 0, 400, 'KKKK'),
];

const names = (text: string, column: FilterColumn = 'any', method: FilterMethod = 'partial', exclude = false) => {
  const matcher = filelistMatcher({ text, column, method, typed: false }, exclude, NOW);
  return matcher && items.filter(matcher).map((i) => i.name);
};

const [DIR, ISO, TXT, NFO] = items.map((i) => i.name);
const ALL = [DIR, ISO, TXT, NFO];

describe('text matching', () => {
  it('shows everything without a text, also when excluding', () => {
    expect(names('')).toEqual(ALL);
    expect(names('', 'name', 'partial', true)).toEqual(ALL);
    expect(names('', 'size', '>')).toEqual(ALL);
  });

  it('partial: every word, in any order and case', () => {
    expect(names('debian')).toEqual([ISO, TXT]);
    expect(names('NOTES debian')).toEqual([TXT]);
    expect(names('debian missing')).toEqual([]);
  });

  it('searches one column or any of them', () => {
    expect(names('iso', 'type')).toEqual([ISO]);
    expect(names('qwerty', 'tth')).toEqual([ISO]);
    expect(names('qwerty')).toEqual([ISO]);
    expect(names('qwerty', 'name')).toEqual([]);
    expect(names('3 files', 'type')).toEqual([DIR]);
    expect(names('700.00 MiB', 'size')).toEqual([ISO]);
    expect(names(formatDate(NOW - DAY).slice(0, 10), 'date')).toEqual([ISO]);
    expect(names((1500).toLocaleString(), 'exact')).toEqual([TXT]);
  });

  it('needs all words in the same column', () => {
    expect(names('debian qwerty')).toEqual([]);
  });

  it('exact: the whole value, ignoring case', () => {
    expect(names('readme.nfo', 'name', 'exact')).toEqual([NFO]);
    expect(names('readme', 'name', 'exact')).toEqual([]);
  });

  it('wildcard: the whole value, with * ? and |', () => {
    expect(names('*.iso', 'name', 'wildcard')).toEqual([ISO]);
    expect(names('debian*', 'name', 'wildcard')).toEqual([ISO, TXT]);
    expect(names('readme.n??', 'name', 'wildcard')).toEqual([NFO]);
    expect(names('*.nfo|*.txt', 'name', 'wildcard')).toEqual([TXT, NFO]);
    expect(names('debian', 'name', 'wildcard')).toEqual([]);
    expect(names('(*', 'name', 'wildcard')).toEqual([]);
  });

  it('regular expressions are case sensitive, and an invalid one is reported', () => {
    expect(names('^debian', 'name', 'regex')).toEqual([ISO]);
    expect(names('^[Dd]ebian', 'name', 'regex')).toEqual([ISO, TXT]);
    expect(names('(', 'name', 'regex')).toBeNull();
  });

  it('never matches an empty value', () => {
    expect(names('.*', 'tth', 'regex')).toEqual([ISO, TXT, NFO]);
  });

  it('excludes the matches', () => {
    expect(names('debian', 'any', 'partial', true)).toEqual([DIR, NFO]);
  });
});

describe('numbers', () => {
  it('compares sizes with units', () => {
    expect(names('>=700 MiB', 'size', '>=')).toEqual([DIR, ISO]);
    expect(names('>700MiB', 'size', '>')).toEqual([DIR]);
    expect(names('<1.5kb', 'size', '<')).toEqual([NFO]);
    expect(names('<=1,5kb', 'exact', '<=')).toEqual([TXT, NFO]);
    expect(names('=1500', 'size', '=')).toEqual([TXT]);
    expect(names('!=1500', 'size', '!=')).toEqual([DIR, ISO, NFO]);
    expect(names('1gib', 'size', '>')).toEqual([DIR]);
  });

  it('compares ages: larger means older', () => {
    expect(names('>30d', 'date', '>')).toEqual([TXT, NFO]);
    expect(names('<30d', 'date', '<')).toEqual([DIR, ISO]);
    expect(names('>1y', 'date', '>')).toEqual([NFO]);
    expect(names('<2w', 'date', '<')).toEqual([DIR, ISO]);
    expect(names('<=1d', 'date', '<=')).toEqual([ISO]);
    expect(names('>2m', 'date', '>')).toEqual([NFO]);
    expect(names('<100000min', 'date', '<')).toEqual([DIR, ISO, TXT]);
  });

  it('matches the rest as text when a text method is chosen after typing an operator', () => {
    expect(names('>gib', 'any', 'partial')).toEqual([DIR]);
  });

  it('uses the unit with "Any" and an operator', () => {
    expect(names('>1gib', 'any', '>')).toEqual([DIR]);
    expect(names('>30d', 'any', '>')).toEqual([TXT, NFO]);
    expect(names('>100', 'any', '>')).toEqual([]);
  });

  it('can exclude', () => {
    expect(names('>1gib', 'size', '>', true)).toEqual([ISO, TXT, NFO]);
  });
});

describe('choosing how to match', () => {
  it('offers operators for numbers only', () => {
    expect(methodsFor('name').map(([id]) => id)).toEqual(['partial', 'regex', 'wildcard', 'exact']);
    expect(methodsFor('any').map(([, title]) => title)).toEqual([
      'Partial match',
      'RegEx',
      'Wildcard',
      'Exact match',
      '=',
      '>=',
      '<=',
      '>',
      '<',
      '!=',
    ]);
  });

  it('selects a typed operator and goes back when it is removed', () => {
    let filter = typeText(emptyFilter, '>');
    expect(filter.method).toBe('>');
    filter = typeText(filter, '>=');
    expect(filter.method).toBe('>=');
    filter = typeText(filter, '==5');
    expect(filter.method).toBe('=');
    filter = typeText(filter, '5');
    expect(filter.method).toBe('partial');
  });

  it('keeps a chosen method while typing', () => {
    const filter = typeText(chooseMethod(emptyFilter, 'wildcard'), '*.iso');
    expect(filter.method).toBe('wildcard');
    expect(clearText(filter)).toMatchObject({ text: '', method: 'wildcard' });
  });

  it('resets a typed operator with the text', () => {
    expect(clearText(typeText(emptyFilter, '>1gib'))).toMatchObject({ text: '', method: 'partial' });
  });

  it('drops operators for a text column, and takes the typed one again for numbers', () => {
    const typed = typeText(emptyFilter, '>1gib');
    const name = chooseColumn(typed, 'name');
    expect(name.method).toBe('partial');
    expect(chooseColumn(name, 'size').method).toBe('>');
    expect(chooseColumn(chooseMethod(emptyFilter, '<'), 'tth').method).toBe('partial');
  });
});

describe('dupe checkboxes', () => {
  const ids = [
    'share_partial',
    'share_full',
    'queue_partial',
    'queue_full',
    'finished_partial',
    'finished_full',
    'share_queue',
    'share_finished',
    'queue_finished',
    'share_queue_finished',
  ];
  const hidden = (showShared: boolean, showQueued: boolean, partialDupes: boolean) =>
    ids.filter((id) => !dupeShown(id, { showShared, showQueued, partialDupes }));

  it('shows everything when both are ticked, and never hides other items', () => {
    expect(hidden(true, true, false)).toEqual([]);
    expect(hidden(true, true, true)).toEqual([]);
    expect(dupeShown(undefined, { showShared: false, showQueued: false, partialDupes: true })).toBe(true);
  });

  it('hides exact dupes only by default', () => {
    expect(hidden(false, true, false)).toEqual(['share_full']);
    expect(hidden(true, false, false)).toEqual(['queue_full', 'finished_full']);
    expect(hidden(false, false, false)).toEqual(['share_full', 'queue_full', 'finished_full']);
  });

  it('hides partial and mixed dupes when they count like exact ones', () => {
    expect(hidden(false, true, true)).toEqual([
      'share_partial',
      'share_full',
      'share_queue',
      'share_finished',
      'share_queue_finished',
    ]);
    expect(hidden(true, false, true)).toEqual([
      'queue_partial',
      'queue_full',
      'finished_partial',
      'finished_full',
      'share_queue',
      'share_finished',
      'queue_finished',
      'share_queue_finished',
    ]);
    expect(hidden(false, false, true)).toEqual(ids);
  });
});
