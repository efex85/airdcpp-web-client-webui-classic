// Searching the settings: what the pages tell about themselves and how a query is matched

import type { ComponentType } from 'react';
import type { Permission } from './access';

export interface SearchEntry {
  title: string;
  help?: string;
  /** Other words that find the entry; not shown */
  words?: string;
  /** Finds the element on the page; without it, the heading, label or button with the title */
  selector?: string;
}

/** What a settings page tells about its content */
export interface SearchInfo {
  /** The settings of the client on the page; their names are asked from the client */
  keys?: string[] | (() => string[]);
  /** Everything else on the page */
  items?: (SearchEntry & { permission?: Permission })[];
  /** Other words for what the page is about */
  words?: string;
  /** Tells apart settings with the same name and adds words that their names lack */
  describe?: (key: string, name: string, nameOf: (key: string) => string) => { title?: string; words?: string };
}

export type SettingsComponent = ComponentType & { search?: SearchInfo };

export const withSearch = (component: ComponentType, search: SearchInfo): SettingsComponent =>
  Object.assign(component, { search });

export const searchKeys = (info: SearchInfo | undefined): string[] =>
  typeof info?.keys === 'function' ? info.keys() : (info?.keys ?? []);

export interface SearchPage {
  id: string;
  title: string;
  group: string;
  words?: string;
  entries: SearchEntry[];
}

export interface SearchResult {
  page: SearchPage;
  /** The matching content; empty if the page itself matches */
  entries: SearchEntry[];
}

const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ').toLowerCase();

const isWordStart = (text: string, at: number) => at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]!);

const startsWord = (text: string, term: string): boolean => {
  for (let at = text.indexOf(term); at !== -1; at = text.indexOf(term, at + 1)) {
    if (isWordStart(text, at)) {
      return true;
    }
  }

  return false;
};

/** One or two letters (such as "ip") must start a word; longer terms may be anywhere in it */
const contains = (text: string, term: string): boolean =>
  term.length > 2 ? text.includes(term) : startsWord(text, term);

/**
 * Every word of the query must be found. Words may be found in the name of the page, but an entry is only listed if
 * at least one of them is found in the entry itself. The best matches come first: those at the start of a word,
 * before those inside a word, before those in explanations.
 */
export const searchSettings = (pages: SearchPage[], query: string): SearchResult[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return [];
  }

  const found: (SearchResult & { rank: number })[] = [];
  for (const page of pages) {
    const pageText = join(page.group, page.title, page.words);
    const matches = (text: string, test = contains) =>
      terms.every((term) => test(text, term) || test(pageText, term)) && terms.some((term) => test(text, term));

    const ranked = page.entries.flatMap((entry) => {
      const title = join(entry.title);
      if (matches(title)) {
        return [{ entry, rank: matches(title, startsWord) ? 0 : 1 }];
      }

      return matches(join(entry.title, entry.help, entry.words)) ? [{ entry, rank: 2 }] : [];
    });
    ranked.sort((a, b) => a.rank - b.rank);

    const pageMatch = terms.every((term) => contains(pageText, term));
    if (pageMatch || ranked.length) {
      const named = terms.every((term) => startsWord(join(page.title), term));
      const best = ranked[0]?.rank ?? 3;
      const rank = named ? 0 : best === 0 || terms.every((term) => startsWord(pageText, term)) ? 1 : best + 1;
      found.push({ page, entries: ranked.map((r) => r.entry), rank });
    }
  }

  return found.sort((a, b) => a.rank - b.rank).map(({ page, entries }) => ({ page, entries }));
};
