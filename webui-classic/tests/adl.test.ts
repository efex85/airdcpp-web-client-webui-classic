import { describe, expect, it } from 'vitest';
import type { AdlSearch, FilelistItem } from '../src/api/types';
import {
  downloadName,
  insertRow,
  isResultFolder,
  isResultPath,
  keepKeys,
  moveRows,
  newRow,
  newSearch,
  originPath,
  parseSize,
  replaceRow,
  searchError,
  sizeLabel,
  sizeText,
} from '../src/lib/adl';
import { addDirectory, dropResultContent, treeRows, type Tree } from '../src/lib/tree';

const search = (pattern: string, changes: Partial<AdlSearch> = {}): AdlSearch => ({ ...newSearch(), pattern, ...changes });

describe('ADL searches', () => {
  it('reads and shows size limits, with empty for none', () => {
    expect([sizeText(-1), sizeText(0), sizeText(7)]).toEqual(['', '0', '7']);
    expect(['', '  ', ' 12 ', '0', '1000000000'].map(parseSize)).toEqual([-1, -1, 12, 0, 1000000000]);
    expect(['-1', '1.5', '1e3', 'x', '1000000001'].map(parseSize)).toEqual([null, null, null, null, null]);
  });

  it('shows the sizes of file searches only', () => {
    expect(sizeLabel(search('a', { size_unit: 'MiB' }), 5)).toBe('5 MiB');
    expect(sizeLabel(search('a'), -1)).toBe('');
    expect(sizeLabel(search('a', { source_type: 'directory' }), 5)).toBe('');
  });

  it('needs a search string and a destination that is a name', () => {
    expect(searchError(search('x'))).toBeNull();
    expect(searchError(search('  '))).toBe('Enter a search string');
    expect(searchError(search('x', { destination: 'a/b' }))).toContain('destination');
    expect(searchError(search('x', { destination: 'a\\b' }))).toContain('destination');
  });
});

describe('the list of ADL searches', () => {
  const rows = ['a', 'b', 'c', 'd'].map((p) => newRow(search(p)));
  const names = (list: typeof rows) => list.map((r) => r.search.pattern).join('');
  const keys = (...patterns: string[]) => new Set(rows.filter((r) => patterns.includes(r.search.pattern)).map((r) => r.key));

  it('moves the chosen searches one step, keeping their order', () => {
    expect(names(moveRows(rows, keys('c'), -1))).toBe('acbd');
    expect(names(moveRows(rows, keys('b'), 1))).toBe('acbd');
    expect(names(moveRows(rows, keys('b', 'c'), -1))).toBe('bcad');
    expect(names(moveRows(rows, keys('b', 'c'), 1))).toBe('adbc');
    expect(names(moveRows(rows, keys('a', 'c'), -1))).toBe('acbd');
    // Against the end they stay
    expect(names(moveRows(rows, keys('a', 'b'), -1))).toBe('abcd');
    expect(names(moveRows(rows, keys('d'), 1))).toBe('abcd');
  });

  it('inserts before the selected search, and otherwise last', () => {
    const row = newRow(search('n'));
    expect(names(insertRow(rows, row, rows[1].key))).toBe('anbcd');
    expect(names(insertRow(rows, row))).toBe('abcdn');
    expect(names(insertRow(rows, row, 'gone'))).toBe('abcdn');
  });

  it('replaces a search, or adds it again if it is gone', () => {
    expect(names(replaceRow(rows, { key: rows[2].key, search: search('x') }))).toBe('abxd');
    expect(names(replaceRow(rows, { key: 'gone', search: search('x') }))).toBe('abcdx');
  });

  it('keeps the keys of unchanged searches when the list is fetched again', () => {
    // The order of the properties doesn't matter
    const reordered = Object.fromEntries(Object.entries(rows[2].search).reverse()) as unknown as AdlSearch;
    const next = keepKeys(rows, [reordered, search('new'), rows[0].search, rows[0].search]);
    expect(next[0].key).toBe(rows[2].key);
    expect(next[2].key).toBe(rows[0].key);
    expect(new Set(next.map((r) => r.key)).size).toBe(4);
    expect(rows.map((r) => r.key)).not.toContain(next[1].key);
  });
});

const item = (type: 'file' | 'directory', adl?: FilelistItem['adl']) =>
  ({ type: { id: type }, adl }) as unknown as FilelistItem;

describe('results in a file list', () => {
  it('tells result folders from what they hold', () => {
    expect(isResultFolder(item('directory', { path: '' }))).toBe(true);
    expect(isResultFolder(item('directory', { path: '/a/' }))).toBe(false);
    expect(isResultFolder(item('directory', null))).toBe(false);
    // A file in a client without ADL Search has no value at all
    expect(isResultFolder(item('directory'))).toBe(false);
    expect(originPath(item('file', { path: '/a/' }))).toBe('/a/');
    expect(originPath(item('directory', { path: '' }))).toBeUndefined();
    expect(originPath(item('file', null))).toBeUndefined();
  });

  it('leaves the marks out of the name of a downloaded result folder', () => {
    expect(downloadName('<<<Shows>>>')).toBe('Shows');
    expect(downloadName('Shows')).toBe('Shows');
    expect(isResultPath('/<<<Shows>>>/x/')).toBe(true);
    expect(isResultPath('/Shows/<<<x>>>/')).toBe(false);
  });

  const folder = (path: string) => ({ path, name: path.split('/').filter(Boolean).pop()! });
  const matched = () => {
    let tree: Tree = new Map();
    tree = addDirectory(tree, '/', ['/(first)/', '/Music/', '/<<<Zed>>>/'].map(folder));
    tree = addDirectory(tree, '/<<<Zed>>>/', [folder('/<<<Zed>>>/Found/')]);
    tree = addDirectory(tree, '/<<<Zed>>>/Found/', [folder('/<<<Zed>>>/Found/Sample/')]);
    return addDirectory(tree, '/Music/', [folder('/Music/Album/')]);
  };

  it('lists result folders first in the tree', () => {
    const shown = treeRows(matched(), new Set(['/']), '/').map((r) => r.node.name);
    expect(shown).toEqual(['/', '<<<Zed>>>', '(first)', 'Music']);
  });

  it('forgets what was inside the result folders after another matching', () => {
    const tree = dropResultContent(matched());
    expect(tree.get('/<<<Zed>>>/')).toEqual({ path: '/<<<Zed>>>/', name: '<<<Zed>>>' });
    expect(tree.has('/<<<Zed>>>/Found/')).toBe(false);
    expect(tree.has('/<<<Zed>>>/Found/Sample/')).toBe(false);
    expect(tree.get('/Music/')?.children).toEqual(['/Music/Album/']);
  });
});
