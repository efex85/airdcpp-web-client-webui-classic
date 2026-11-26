import { describe, expect, test, vi } from 'vitest';
import { rootFolderEntries } from '../src/lib/refreshMenu';
import type { MenuEntry } from '../src/store/ui';

type Item = Exclude<MenuEntry, 'separator'>;

describe('refreshing single folders', () => {
  const refresh = vi.fn();
  const entries = rootFolderEntries(
    [
      { name: 'music', paths: ['/b/', '/a/'] },
      { name: 'Films', paths: ['/films/'] },
    ],
    refresh,
  ) as Item[];

  test('lists every name once, sorted', () => {
    expect(entries.map((e) => e.label)).toEqual(['Films', 'music']);
  });

  test('refreshes the folder of a name', () => {
    entries[0].onClick!();
    expect(refresh).toHaveBeenLastCalledWith(['/films/'], 'Films');
  });

  test('lets a name with several folders be refreshed completely or folder by folder', () => {
    const children = entries[1].children!.filter((c): c is Item => c !== 'separator');
    expect(children.map((c) => c.label)).toEqual(['All 2 folders', '/a/', '/b/']);
    children[0].onClick!();
    expect(refresh).toHaveBeenLastCalledWith(['/b/', '/a/'], 'music');
    children[2].onClick!();
    expect(refresh).toHaveBeenLastCalledWith(['/b/'], '/b/');
  });
});
