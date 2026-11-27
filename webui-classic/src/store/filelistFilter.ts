// The options of the file list filter: the same for every file list, remembered by the browser
import { create } from 'zustand';
import type { DupeOptions } from '../lib/filelistFilter';
import { load, save } from '../lib/storage';

export interface FilterOptions extends DupeOptions {
  /** "Exclude matches" */
  exclude: boolean;
  /** "Show above the list" */
  onTop: boolean;
  /** "Reset the string when switching directory" */
  resetOnChange: boolean;
}

const DEFAULTS: FilterOptions = {
  showShared: true,
  showQueued: true,
  partialDupes: false,
  exclude: false,
  onTop: true,
  resetOnChange: true,
};

const KEY = 'filelistFilter';

const stored = (): FilterOptions => {
  const saved = load<Partial<FilterOptions> | null>(KEY, null);
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof FilterOptions)[]) {
    if (typeof saved?.[key] === 'boolean') {
      result[key] = saved[key];
    }
  }

  return result;
};

export const useFilterOptions = create<FilterOptions>(stored);

export const setFilterOption = (key: keyof FilterOptions, value: boolean) => {
  useFilterOptions.setState({ [key]: value });
  save(KEY, useFilterOptions.getState());
};
