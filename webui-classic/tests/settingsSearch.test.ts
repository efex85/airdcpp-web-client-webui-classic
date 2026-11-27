import { describe, expect, it } from 'vitest';
import { searchKeys, searchSettings, withSearch, type SearchPage } from '../src/lib/settingsSearch';

const pages: SearchPage[] = [
  {
    id: 'upload-limits',
    title: 'Upload limits',
    group: 'Speed and limits',
    entries: [
      { title: 'Upload slots' },
      { title: 'Minislot size (KiB)', help: 'Small files and file lists' },
    ],
  },
  { id: 'ports', title: 'Ports (manual)', group: 'Connectivity', entries: [{ title: 'Transfer port' }] },
  {
    id: 'colors',
    title: 'Colors',
    group: 'View',
    words: 'theme',
    entries: [{ title: 'Links', words: 'Chat color' }],
  },
  {
    id: 'skipping',
    title: 'Skipping options',
    group: 'Downloads',
    entries: [{ title: 'Skiplist', help: 'Files that are not downloaded' }, { title: 'Description' }],
  },
];

const found = (query: string) =>
  searchSettings(pages, query).map((r) => [r.page.id, r.entries.map((e) => e.title)] as const);

describe('settings search', () => {
  it('finds nothing for an empty query', () => {
    expect(searchSettings(pages, '')).toEqual([]);
    expect(searchSettings(pages, '   ')).toEqual([]);
    expect(found('nonsense')).toEqual([]);
  });

  it('finds settings by their name, ignoring the case', () => {
    expect(found('SLOTS')).toEqual([['upload-limits', ['Upload slots']]]);
    expect(found('minislot')).toEqual([['upload-limits', ['Minislot size (KiB)']]]);
  });

  it('requires every word, which may be part of the name of the page', () => {
    expect(found('speed slots')).toEqual([['upload-limits', ['Upload slots']]]);
    expect(found('slots port')).toEqual([]);
    expect(found('chat links')).toEqual([['colors', ['Links']]]);
  });

  it('lists a page without entries when only the page matches', () => {
    expect(found('theme')).toEqual([['colors', []]]);
    expect(found('connectivity')).toEqual([['ports', []]]);
  });

  it('also searches the explanations, after the names', () => {
    expect(found('lists')).toEqual([['upload-limits', ['Minislot size (KiB)']]]);
    expect(found('files')).toEqual([
      ['upload-limits', ['Minislot size (KiB)']],
      ['skipping', ['Skiplist']],
    ]);
  });

  it('only matches one or two letters at the start of a word', () => {
    // Not "Description" or "Skipping"
    expect(found('ip')).toEqual([]);
    expect(found('po').map(([id]) => id)).toEqual(['ports']);
    // Longer terms may be inside a word
    expect(found('list').map(([id]) => id)).toEqual(['skipping', 'upload-limits']);
    expect(found('kip')).toEqual([['skipping', ['Skiplist']]]);
  });

  it('shows matches at the start of a word before those inside a word', () => {
    const words: SearchPage[] = [
      { id: 'events', title: 'Events', group: 'View', entries: [{ title: 'Report uploads' }, { title: 'Port report' }] },
      { id: 'web', title: 'Web server', group: 'System', entries: [{ title: 'Port (HTTP)' }] },
    ];
    expect(searchSettings(words, 'port').map((r) => [r.page.id, r.entries.map((e) => e.title)])).toEqual([
      ['events', ['Port report', 'Report uploads']],
      ['web', ['Port (HTTP)']],
    ]);
    // A page that only has it inside a word comes after the others
    words[0]!.entries.pop();
    expect(searchSettings(words, 'port').map((r) => r.page.id)).toEqual(['web', 'events']);
  });

  it('shows pages whose name matches first', () => {
    expect(found('port')[0]![0]).toBe('ports');
    expect(found('skip')[0]![0]).toBe('skipping');
  });

  it('reads the keys of a page, which may depend on the client', () => {
    const page = withSearch(() => null, { keys: () => ['a'] });
    expect(searchKeys(page.search)).toEqual(['a']);
    expect(searchKeys({ keys: ['b'] })).toEqual(['b']);
    expect(searchKeys(undefined)).toEqual([]);
  });
});
