// The settings window: the page tree of the classic clients and the selected page
import { Fragment, useEffect, useRef, useState } from 'react';
import { useAccess } from '../../lib/access';
import { useIsMobile } from '../../lib/useIsMobile';
import { showSettingsPage, useSettingsNav } from '../../store/settingsNav';
import { visibleGroups, type PageGroup } from './pages';
import { SearchBox, SearchResults, useSettingsSearch, useShowTarget, type Target } from './search';
import type { SearchEntry } from '../../lib/settingsSearch';

const Tree = ({ groups, current }: { groups: PageGroup[]; current: string }) => (
  <nav className="settings-tree" aria-label="Settings pages">
    {groups.map((group) => (
      <div key={group.title}>
        <h2>{group.title}</h2>
        {group.pages.map((page, index) => (
          <Fragment key={page.id}>
            {page.advanced && !group.pages[index - 1]?.advanced && <h3>Advanced</h3>}
            <button
              type="button"
              className={page.advanced ? 'advanced' : ''}
              aria-current={page.id === current ? 'page' : undefined}
              onClick={() => void showSettingsPage(page.id)}
            >
              {page.title}
            </button>
          </Fragment>
        ))}
      </div>
    ))}
  </nav>
);

const Picker = ({ groups, current }: { groups: PageGroup[]; current: string }) => (
  <select aria-label="Settings page" value={current} onChange={(e) => void showSettingsPage(e.target.value)}>
    {groups.map((group) => (
      <optgroup key={group.title} label={group.title}>
        {group.pages.map((page) => (
          <option key={page.id} value={page.id}>
            {group.title}: {page.title}
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

export const SettingsView = () => {
  const access = useAccess();
  const mobile = useIsMobile();
  const selected = useSettingsNav((s) => s.page);
  const dirty = useSettingsNav((s) => s.dirty);
  const groups = visibleGroups(access);
  const pages = groups.flatMap((g) => g.pages.map((page) => ({ group: g.title, page })));
  const current = pages.find((p) => p.page.id === selected) ?? pages[0];

  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const search = useSettingsSearch(groups, access, query);
  const searching = !!query.trim();
  useShowTarget(pageRef, current?.page.id ?? '', target);

  const select = async (page: string, entry?: SearchEntry) => {
    // The page that is shown instead of a stored one that may not be seen
    if (page !== current?.page.id && !(await showSettingsPage(page))) {
      return;
    }

    setTarget(entry ? { page, entry } : null);
    // On phones the results cover the page
    if (mobile) {
      setQuery('');
    }
  };

  const selectFirst = () => {
    const first = search.results[0];
    if (first) {
      void select(first.page.id, first.entries[0]);
    }
  };

  // Ask before the browser tab is closed with unsaved changes
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!current) {
    return <div className="view-empty">No settings are available</div>;
  }

  const Content = current.page.component;
  const box = <SearchBox query={query} onChange={setQuery} onEnter={selectFirst} />;
  const results = searching && (
    <SearchResults {...search} current={current.page.id} onSelect={(page, entry) => void select(page, entry)} />
  );
  return (
    <div className="view settings">
      {mobile ? (
        <>
          <div className="settings-picker">
            {box}
            {!searching && <Picker groups={groups} current={current.page.id} />}
          </div>
          {results}
        </>
      ) : (
        <div className="settings-side">
          {box}
          {results || <Tree groups={groups} current={current.page.id} />}
        </div>
      )}
      {/* Kept while the results are shown: the page may have unsaved changes */}
      <div className={`settings-page${mobile && searching ? ' hidden' : ''}`} ref={pageRef}>
        {!mobile && (
          <div className="settings-title">
            {current.group} › {current.page.title}
          </div>
        )}
        <Content key={current.page.id} />
      </div>
    </div>
  );
};
