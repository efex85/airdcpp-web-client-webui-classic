// The settings window: the page tree of the classic clients and the selected page
import { Fragment, useEffect } from 'react';
import { useAccess } from '../../lib/access';
import { useIsMobile } from '../../lib/useIsMobile';
import { showSettingsPage, useSettingsNav } from '../../store/settingsNav';
import { visibleGroups, type PageGroup } from './pages';

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
  <div className="settings-picker">
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
  </div>
);

export const SettingsView = () => {
  const access = useAccess();
  const mobile = useIsMobile();
  const selected = useSettingsNav((s) => s.page);
  const dirty = useSettingsNav((s) => s.dirty);
  const groups = visibleGroups(access);
  const pages = groups.flatMap((g) => g.pages.map((page) => ({ group: g.title, page })));
  const current = pages.find((p) => p.page.id === selected) ?? pages[0];

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
  return (
    <div className="view settings">
      {mobile ? (
        <Picker groups={groups} current={current.page.id} />
      ) : (
        <Tree groups={groups} current={current.page.id} />
      )}
      <div className="settings-page">
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
