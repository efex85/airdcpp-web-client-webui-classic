// Menu entries for refreshing single folders of the own share
import type { MenuEntry } from '../store/ui';

/** Shared folders with the same name in the file list, as sent by share/grouped_root_paths */
export interface GroupedRoot {
  name: string;
  paths: string[];
}

/** One entry per name; a name with several folders opens a submenu for choosing between them */
export const rootFolderEntries = (
  roots: GroupedRoot[],
  refresh: (paths: string[], name: string) => void,
): MenuEntry[] =>
  [...roots]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, paths }): MenuEntry => {
      if (paths.length === 1) {
        return { label: name, onClick: () => refresh(paths, name) };
      }

      return {
        label: name,
        children: [
          { label: `All ${paths.length} folders`, onClick: () => refresh(paths, name) },
          'separator',
          ...[...paths].sort().map((path): MenuEntry => ({ label: path, wrap: true, onClick: () => refresh([path], path) })),
        ],
      };
    });
