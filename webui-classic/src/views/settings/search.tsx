// The search box of the settings: results, and showing the chosen result on its page
import { Search } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react';
import type { SettingDefinition } from '../../api/settingsTypes';
import type { Permission } from '../../lib/access';
import { searchKeys, searchSettings, type SearchEntry, type SearchPage, type SearchResult } from '../../lib/settingsSearch';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';
import type { PageGroup } from './pages';

/** Longer lists, such as the languages, would be found by almost anything */
const MAX_SEARCHED_OPTIONS = 12;

/** The names of the settings of the client, in its language; loaded when a search is made */
const useSettingNames = (keys: string[], wanted: boolean) => {
  const generation = useApp((s) => s.generation);
  const request = keys.join(' ');
  const [result, setResult] = useState<{ for: string; definitions?: SettingDefinition[]; error?: string }>({ for: '' });
  const id = `${generation} ${request}`;

  useEffect(() => {
    if (!wanted || !request) {
      return;
    }

    let active = true;
    socket.post<SettingDefinition[]>('settings/definitions', { keys: request.split(' ') }).then(
      (definitions) => active && setResult({ for: id, definitions }),
      (e: Error) => active && setResult({ for: id, error: e.message }),
    );
    return () => {
      active = false;
    };
  }, [wanted, request, id]);

  return {
    definitions: result.definitions ?? [],
    loading: wanted && !!request && result.for !== id,
    error: result.for === id ? result.error : undefined,
  };
};

export const useSettingsSearch = (groups: PageGroup[], permits: (permission: Permission) => boolean, query: string) => {
  const pages = groups.flatMap((group) => group.pages.map((page) => ({ group: group.title, page })));
  const keys = [...new Set(pages.flatMap(({ page }) => searchKeys(page.component.search)))];
  const wanted = !!query.trim();
  const { definitions, loading, error } = useSettingNames(keys, wanted);

  if (!wanted) {
    return { results: [], loading: false, error: undefined };
  }

  const named = new Map(definitions.map((def) => [def.key, def]));
  const index: SearchPage[] = pages.map(({ group, page }) => {
    const info = page.component.search;
    const settings = searchKeys(info).flatMap((key): SearchEntry[] => {
      const def = named.get(key);
      if (!def) {
        return [];
      }

      const own = info?.describe?.(key, def.title, (other) => named.get(other)?.title ?? other);
      const options = def.options && def.options.length <= MAX_SEARCHED_OPTIONS ? def.options : [];
      return [
        {
          title: own?.title ?? def.title,
          help: def.help,
          words: [own?.words, ...options.map((o) => o.name)].filter(Boolean).join(' '),
          selector: `[data-key="${key}"]`,
        },
      ];
    });
    return {
      id: page.id,
      title: page.title,
      group,
      words: info?.words,
      entries: [...settings, ...(info?.items ?? []).filter((item) => !item.permission || permits(item.permission))],
    };
  });

  return { results: searchSettings(index, query), loading, error };
};

export const SearchBox = ({
  query,
  onChange,
  onEnter,
}: {
  query: string;
  onChange: (query: string) => void;
  onEnter: () => void;
}) => (
  <div className="settings-search">
    <Search size={14} aria-hidden="true" />
    <input
      type="search"
      aria-label="Search settings"
      placeholder="Search settings"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="search"
      value={query}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onEnter();
        } else if (e.key === 'Escape') {
          onChange('');
        }
      }}
    />
  </div>
);

export const SearchResults = ({
  results,
  loading,
  error,
  current,
  onSelect,
}: {
  results: SearchResult[];
  loading: boolean;
  error?: string;
  current: string;
  onSelect: (page: string, entry?: SearchEntry) => void;
}) => (
  <nav className="settings-results" aria-label="Search results">
    {error && (
      <div className="error" role="alert">
        The names of the client's settings couldn't be loaded: {error}
      </div>
    )}
    {loading && <div className="muted">Searching…</div>}
    {!loading && !results.length && <div className="muted">Nothing found</div>}
    {results.map(({ page, entries }) => (
      <Fragment key={page.id}>
        <button
          type="button"
          className="result-page"
          data-page={page.id}
          aria-current={page.id === current ? 'page' : undefined}
          onClick={() => onSelect(page.id)}
        >
          <span className="muted">{page.group} ›</span> {page.title}
        </button>
        {entries.map((entry) => (
          <button
            key={`${entry.selector ?? ''} ${entry.title}`}
            type="button"
            className="result-entry"
            data-page={page.id}
            onClick={() => onSelect(page.id, entry)}
          >
            {entry.title}
          </button>
        ))}
      </Fragment>
    ))}
  </nav>
);

/** The element of a result on the shown page */
const findEntry = (page: Element, entry: SearchEntry): Element | null => {
  if (entry.selector) {
    return page.querySelector(entry.selector);
  }

  const title = entry.title.toLowerCase();
  const candidates = [...page.querySelectorAll('h3, h4, legend, label, button, dt, a, [aria-label]')];
  const text = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase();
  return candidates.find((el) => text(el) === title) ?? candidates.find((el) => text(el).startsWith(title)) ?? null;
};

const HIGHLIGHT_TIME = 2500;
/** How long the content of a page is waited for */
const LOAD_TIME = 8000;

const reveal = (page: Element, element: Element) => {
  element.scrollIntoView({ block: 'center' });
  // A preview that stays in view mustn't cover the element
  const sticky = page.querySelector('.colors-layout > .color-preview');
  if (sticky && getComputedStyle(sticky).position === 'sticky') {
    const cover = sticky.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    if (box.top < cover.bottom && box.right > cover.left && box.left < cover.right) {
      element.closest('.settings-scroll')?.scrollBy(0, box.top - cover.bottom - 8);
    }
  }

  element.classList.add('search-hit');
  setTimeout(() => element.classList.remove('search-hit'), HIGHLIGHT_TIME);
};

export interface Target {
  page: string;
  entry: SearchEntry;
}

/** Scrolls to the chosen result and highlights it, as soon as its page has shown it */
export const useShowTarget = (container: RefObject<HTMLDivElement | null>, current: string, target: Target | null) => {
  // A result is shown once: not again when its page is opened later
  const shown = useRef<Target | null>(null);

  useEffect(() => {
    if (!target || target.page !== current || shown.current === target) {
      return;
    }

    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      const page = container.current?.querySelector('.settings-scroll');
      const element = page && findEntry(page, target.entry);
      if (element) {
        shown.current = target;
        reveal(page, element);
      } else if (Date.now() - started < LOAD_TIME) {
        timer = setTimeout(attempt, 100);
      } else {
        shown.current = target;
      }
    };

    // After the page has been laid out
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
    // A new object for every selection, also of the same result
  }, [container, current, target]);
};
