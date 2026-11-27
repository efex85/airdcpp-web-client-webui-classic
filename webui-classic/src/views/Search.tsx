import { File, Folder, Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { browseUser, copyText, openPrivateChat, openSearch } from '../actions';
import { directoryDownload, downloadAll, downloadMenu, fileDownload, type Downloadable } from '../actions/download';
import { remoteMenu } from '../actions/menus';
import { viewEntries } from '../actions/view';
import type { SearchResult, UserSearchResult } from '../api/types';
import { DataTable, type Column, type RowMenu } from '../components/DataTable';
import { Splitter } from '../components/Splitter';
import { dupeClass } from '../lib/dupe';
import { formatDate, formatSize, formatSpeed } from '../lib/format';
import { magnetLink } from '../lib/magnet';
import { parentPath } from '../lib/path';
import { isRememberedSearch, SEARCH_HISTORY_PATH } from '../lib/searchHistory';
import { emptyResultText, progressIsTimed } from '../lib/searchProgress';
import { useIsMobile } from '../lib/useIsMobile';
import { reportError, useApp } from '../store/app';
import { useLiveList } from '../store/live';
import { getSearch, type SearchModel } from '../store/search';
import { socket } from '../store/session';

const FILE_TYPES: [string, string][] = [
  ['any', 'Any'],
  ['audio', 'Audio'],
  ['compressed', 'Compressed'],
  ['document', 'Document'],
  ['executable', 'Executable'],
  ['picture', 'Picture'],
  ['video', 'Video'],
  ['directory', 'Folder'],
  ['file', 'File'],
  ['tth', 'TTH'],
];

const UNITS: [number, string][] = [
  [1, 'B'],
  [1024, 'KiB'],
  [1024 ** 2, 'MiB'],
  [1024 ** 3, 'GiB'],
];

const WAITING_FOR_HUB = 'The search starts when a hub is connected';

const typeIcon = (r: { type: SearchResult['type'] }) =>
  r.type?.id === 'directory' ? <Folder size={13} className="i-folder" /> : <File size={13} />;

const COLUMNS: Column<SearchResult>[] = [
  { id: 'name', title: 'Name', width: 280, value: (r) => r.name },
  { id: 'hits', title: 'Hits', width: 45, align: 'right', value: (r) => r.hits },
  {
    id: 'users',
    title: 'User',
    width: 150,
    mobile: 'detail',
    value: (r) => (r.users.count > 1 ? `${r.users.count} users` : r.users.user.nicks),
  },
  { id: 'type', title: 'Type', width: 110, value: (r) => r.type?.str ?? '' },
  {
    id: 'size',
    title: 'Size',
    width: 85,
    align: 'right',
    mobile: 'right',
    value: (r) => r.size,
    render: (r) => formatSize(r.size),
  },
  { id: 'path', title: 'Path', width: 300, mobile: 'detail', value: (r) => r.path },
  {
    id: 'slots',
    title: 'Slots',
    width: 55,
    align: 'right',
    mobile: 'right',
    value: (r) => r.slots.free,
    render: (r) => r.slots.str,
  },
  {
    id: 'connection',
    title: 'Connection',
    width: 90,
    align: 'right',
    value: (r) => r.connection,
    render: (r) => formatSpeed(r.connection),
  },
  { id: 'date', title: 'Date', width: 120, value: (r) => r.time, render: (r) => formatDate(r.time) },
  {
    id: 'relevance',
    title: 'Relevance',
    width: 70,
    align: 'right',
    defaultHidden: true,
    value: (r) => r.relevance,
    render: (r) => r.relevance.toFixed(2),
  },
  { id: 'tth', title: 'TTH', width: 300, defaultHidden: true, value: (r) => r.tth },
];

/** One user's result of a grouped result */
const SOURCE_COLUMNS: Column<UserSearchResult>[] = [
  { id: 'user', title: 'User', width: 160, value: (r) => r.user.nicks },
  { id: 'hub', title: 'Hub', width: 160, value: (r) => r.user.hub_names ?? '' },
  {
    id: 'slots',
    title: 'Slots',
    width: 55,
    align: 'right',
    mobile: 'right',
    value: (r) => r.slots.free,
    render: (r) => r.slots.str,
  },
  {
    id: 'connection',
    title: 'Connection',
    width: 90,
    align: 'right',
    value: (r) => r.connection,
    render: (r) => formatSpeed(r.connection),
  },
  { id: 'ip', title: 'IP', width: 110, value: (r) => r.ip?.str ?? '' },
  { id: 'path', title: 'Path', width: 340, mobile: 'detail', value: (r) => r.path },
];

const Sources = ({ model, result }: { model: SearchModel; result: SearchResult }) => {
  const [sources, setSources] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    let current = true;
    socket.get<UserSearchResult[]>(`search/${model.instanceId}/results/${result.id}/children`).then(
      (children) => current && setSources(children),
      (e) => current && e.code !== 404 && reportError('Failed to load the sources')(e),
    );
    return () => {
      current = false;
    };
  }, [result.id, result.hits]);

  const download = (r: UserSearchResult): Downloadable =>
    r.type?.id === 'directory' ? directoryDownload(r.user, r.path, r.name) : fileDownload(r.user, r);

  const browse = (r: UserSearchResult) =>
    void browseUser(r.user, r.type?.id === 'directory' ? r.path : parentPath(r.path));

  return (
    <DataTable
      id="searchSources"
      label="Sources"
      columns={SOURCE_COLUMNS}
      items={sources}
      itemKey={(r) => String(r.id)}
      menu={(items): RowMenu => ({
        entries: [
          ...downloadMenu(items.map(download)),
          'separator',
          ...(items.length === 1 ? viewEntries(items[0], items[0].user) : []),
          { label: 'Browse', disabled: items.length !== 1, onClick: () => browse(items[0]) },
          { label: 'Send private message', disabled: items.length !== 1, onClick: () => void openPrivateChat(items[0].user) },
        ],
      })}
      onActivate={browse}
      mobileTap="menu"
      empty="No sources"
    />
  );
};

export const SearchView = ({ tabKey, active }: { tabKey: string; active: boolean }) => {
  const model = getSearch(tabKey);
  const initial = useApp((s) => s.searches.find((x) => x.key === tabKey)?.initial);
  const hubs = useApp((s) => s.hubs);
  const mobile = useIsMobile();
  const results = useLiveList(model.results);
  const status = useSyncExternalStore(model.subscribe, model.getStatus);
  const progress = useSyncExternalStore(model.subscribe, model.getProgress);

  const [pattern, setPattern] = useState(initial?.pattern ?? '');
  const [fileType, setFileType] = useState(initial?.fileType ?? 'any');
  const [min, setMin] = useState({ value: '', unit: 1024 ** 2 });
  const [max, setMax] = useState({ value: '', unit: 1024 ** 2 });
  const [excluded, setExcluded] = useState('');
  const [skippedHubs, setSkippedHubs] = useState<ReadonlySet<string>>(new Set());
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  /** Result whose sources are shown instead of the list on small screens */
  const [details, setDetails] = useState<string | null>(null);

  const hubUrls = hubs.filter((h) => !skippedHubs.has(h.hub_url)).map((h) => h.hub_url);
  const current = results.find((r) => r.id === selected);

  const run = (text = pattern) => {
    const value = text.trim();
    if (!value || !hubUrls.length) {
      return;
    }

    const bytes = (size: { value: string; unit: number }) =>
      size.value.trim() && Number(size.value) >= 0 ? Math.round(Number(size.value) * size.unit) : undefined;

    useApp.setState((s) => ({
      searches: s.searches.map((x) => (x.key === tabKey ? { ...x, title: value } : x)),
    }));
    setSelected(null);
    setDetails(null);
    setShowOptions(false);
    void model.search({
      pattern: value,
      fileType,
      minSize: fileType === 'tth' ? undefined : bytes(min),
      maxSize: fileType === 'tth' ? undefined : bytes(max),
      excluded: excluded.split(/\s+/).filter(Boolean),
      hubUrls,
    });
    if (isRememberedSearch(value, fileType)) {
      // For "Recent searches" on Home; the search works without it
      void socket.post(SEARCH_HISTORY_PATH, { string: value }).catch(() => undefined);
    }
  };

  // "Search for alternates", a feed entry etc. open the window with the search already started.
  // A search without a connected hub would fail, so it waits until one is connected.
  const connected = hubs.some((h) => !skippedHubs.has(h.hub_url) && h.connect_state.id === 'connected');
  const pending = !!initial && !model.started;
  useEffect(() => {
    if (pending && connected) {
      run(initial!.pattern);
    }
  }, [pending, connected]);

  // The text of an empty list counts down while the search is waiting
  const [now, setNow] = useState(Date.now);
  const timed = !results.length && progressIsTimed(progress, Math.max(now, Date.now()));
  useEffect(() => {
    if (!active || !timed) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active, timed, progress]);

  const resultDownload = (r: SearchResult): Downloadable => ({
    name: r.name,
    run: (target) => socket.post(`search/${model.instanceId}/results/${r.id}/download`, target),
  });

  const browse = (r: SearchResult) =>
    void browseUser(r.users.user, r.type?.id === 'directory' ? r.path : parentPath(r.path));

  const menu = (items: SearchResult[]): RowMenu => {
    const single = items.length === 1 ? items[0] : null;
    const files = items.filter((r) => r.type?.id === 'file' && r.tth);
    return {
      entries: [
        ...downloadMenu(items.map(resultDownload)),
        'separator',
        ...(mobile && single && single.hits > 1
          ? [{ label: `Show sources (${single.hits})`, onClick: () => setDetails(single.id) }]
          : []),
        ...(single ? viewEntries(single, single.users.user) : []),
        { label: 'Browse', disabled: !single, onClick: () => browse(single!) },
        { label: 'Send private message', disabled: !single, onClick: () => void openPrivateChat(single!.users.user) },
        {
          label: 'Search for alternates',
          disabled: !single || !files.length,
          onClick: () => openSearch({ pattern: single!.tth, fileType: 'tth' }),
        },
        'separator',
        { label: 'Copy name', onClick: () => void copyText(items.map((r) => r.name).join('\n')) },
        { label: 'Copy path', onClick: () => void copyText(items.map((r) => r.path).join('\n')) },
        { label: 'Copy magnet link', disabled: !files.length, onClick: () => void copyText(files.map(magnetLink).join('\n')) },
      ],
      more: () => remoteMenu('grouped_search_result', items.map((r) => r.id), model.instanceId ?? undefined),
    };
  };

  const sizeField = (label: string, size: typeof min, set: (s: typeof min) => void) => (
    <label className="field">
      <span>{label}</span>
      <span className="size-field">
        <input
          type="number"
          min="0"
          step="any"
          disabled={fileType === 'tth'}
          value={size.value}
          onChange={(e) => set({ ...size, value: e.target.value })}
        />
        <select aria-label={`${label}: unit`} value={size.unit} onChange={(e) => set({ ...size, unit: Number(e.target.value) })}>
          {UNITS.map(([unit, name]) => (
            <option key={unit} value={unit}>
              {name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );

  const options = (
    <>
      <label className="field">
        <span>File type</span>
        <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
          {FILE_TYPES.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      {sizeField('At least', min, setMin)}
      {sizeField('At most', max, setMax)}
      <label className="field">
        <span>Excluded words</span>
        <input value={excluded} onChange={(e) => setExcluded(e.target.value)} />
      </label>
      <fieldset>
        <legend>Hubs</legend>
        {!hubs.length && <p className="muted">Connect to a hub to search</p>}
        {hubs.map((h) => (
          <label key={h.id} className="check-field">
            <input
              type="checkbox"
              checked={!skippedHubs.has(h.hub_url)}
              onChange={(e) => {
                const next = new Set(skippedHubs);
                if (e.target.checked) {
                  next.delete(h.hub_url);
                } else {
                  next.add(h.hub_url);
                }

                setSkippedHubs(next);
              }}
            />
            <span>{h.identity.name || h.hub_url}</span>
          </label>
        ))}
      </fieldset>
    </>
  );

  const detailed = results.find((r) => r.id === details);

  const list = (
    <DataTable
      id="search"
      label="Search results"
      columns={COLUMNS}
      items={results}
      itemKey={(r) => r.id}
      icon={typeIcon}
      rowClass={(r) => dupeClass(r.dupe)}
      defaultSort={{ column: 'relevance', desc: true }}
      onSelect={(items) => setSelected(items.length === 1 ? items[0].id : null)}
      onActivate={(r) => void downloadAll([resultDownload(r)])}
      menu={menu}
      mobileTap="menu"
      empty={pending && !connected ? WAITING_FOR_HUB : emptyResultText(progress, Date.now())}
    />
  );

  return (
    <form
      className={mobile && showOptions ? 'view search options-open' : 'view search'}
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <div className="search-panel">
        <div className="search-main">
          <input
            type="search"
            aria-label="Search for"
            placeholder="Search for…"
            enterKeyHint="search"
            autoFocus={active && !mobile && !initial}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <div className="search-actions">
            {mobile && (
              <button
                type="button"
                className="search-options"
                aria-expanded={showOptions}
                onClick={() => setShowOptions(!showOptions)}
              >
                <SlidersHorizontal size={13} /> Search options
              </button>
            )}
            <button type="submit" disabled={!pattern.trim() || !hubUrls.length}>
              <SearchIcon size={13} /> Search
            </button>
          </div>
        </div>
        {(!mobile || showOptions) && options}
      </div>
      <div className="search-results">
        <div className="view-main">
          {mobile ? (
            detailed ? (
              <div className="subpane">
                <div className="segmented">
                  <span className="subpane-title">{detailed.name}</span>
                  <button type="button" onClick={() => setDetails(null)}>
                    Back to the results
                  </button>
                </div>
                <div className="view-main">
                  <Sources key={detailed.id} model={model} result={detailed} />
                </div>
              </div>
            ) : (
              list
            )
          ) : (
            <Splitter
              id="searchSources"
              direction="column"
              initial={150}
              first={list}
              second={current && current.hits > 1 ? <Sources key={current.id} model={model} result={current} /> : null}
            />
          )}
        </div>
        <div className="view-status">
          <span className="grow">{pending && !connected ? WAITING_FOR_HUB : status}</span>
          <span>{results.length} result(s)</span>
        </div>
      </div>
    </form>
  );
};
