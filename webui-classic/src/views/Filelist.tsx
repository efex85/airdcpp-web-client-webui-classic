import {
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  File,
  Folder,
  FolderOpen,
  FolderSync,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { matchAdl } from '../actions/adl';
import { copyText, openSearch, refreshInShare } from '../actions';
import { directoryDownload, downloadAll, downloadMenu, fileDownload, type Downloadable } from '../actions/download';
import { remoteMenu } from '../actions/menus';
import { viewEntries } from '../actions/view';
import type { FilelistItem, FilelistSession } from '../api/types';
import { DataTable, type Column, type RowMenu } from '../components/DataTable';
import { showItemDetails } from '../components/ItemDetails';
import { Splitter } from '../components/Splitter';
import { useAccess } from '../lib/access';
import { downloadName, isResultFolder, isResultPath, originPath } from '../lib/adl';
import { dupeClass } from '../lib/dupe';
import { clearText, dupeShown, emptyFilter, filelistMatcher } from '../lib/filelistFilter';
import { formatDate, formatSize } from '../lib/format';
import { magnetLink } from '../lib/magnet';
import { lastSegment, parentPath, pathChain } from '../lib/path';
import { addDirectory, dropResultContent, treeRows, type Tree } from '../lib/tree';
import { useIsMobile } from '../lib/useIsMobile';
import { reportError, useApp } from '../store/app';
import { useFilterOptions } from '../store/filelistFilter';
import { socket } from '../store/session';
import { openMenu } from '../store/ui';
import { FilelistFilterBar } from './FilelistFilterBar';

const isDirectory = (item: FilelistItem) => item.type.id === 'directory';

const COLUMNS: Column<FilelistItem>[] = [
  { id: 'name', title: 'Name', width: 320, value: (i) => i.name },
  {
    id: 'size',
    title: 'Size',
    width: 90,
    align: 'right',
    mobile: 'right',
    value: (i) => i.size,
    render: (i) => formatSize(i.size),
  },
  { id: 'type', title: 'Type', width: 150, mobile: 'detail', value: (i) => i.type.str },
  { id: 'date', title: 'Date', width: 120, mobile: 'detail', value: (i) => i.time, render: (i) => formatDate(i.time) },
  { id: 'tth', title: 'TTH', width: 300, defaultHidden: true, value: (i) => i.tth },
];

interface Listing {
  path: string;
  items: FilelistItem[];
}

const View = ({ session, active }: { session: FilelistSession; active: boolean }) => {
  const { id, user, state } = session;
  const own = user.flags.includes('self');
  const mobile = useIsMobile();
  const access = useAccess();
  const canRefresh = access('share_edit') && own;
  const generation = useApp((s) => s.generation);
  const path = session.location?.path;
  const [listing, setListing] = useState<Listing | null>(null);
  const [tree, setTree] = useState<Tree>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['/']));
  const history = useRef<{ back: string[]; current?: string; returning: boolean }>({ back: [], returning: false });
  const [canGoBack, setCanGoBack] = useState(false);
  const [filter, setFilter] = useState(emptyFilter);
  const options = useFilterOptions();
  const shownPath = useRef<string | undefined>(undefined);
  /** The IDs of the result folders, which are new after every matching */
  const results = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!path || state.id !== 'loaded') {
      return;
    }

    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = (attempt: number) => {
      socket.get<{ list_path: string; items: FilelistItem[] }>(`filelists/${id}/items/0/100000`).then(
        (result) => {
          if (current) {
            // The filter text belongs to the folder where it was typed, unless the options say otherwise
            const switched = shownPath.current !== undefined && shownPath.current !== result.list_path;
            if (switched && useFilterOptions.getState().resetOnChange) {
              setFilter(clearText);
            }

            shownPath.current = result.list_path;
            setListing({ path: result.list_path, items: result.items });

            let rematched = false;
            if (result.list_path === '/') {
              const found = result.items.filter(isResultFolder).map((i) => i.id).join();
              rematched = results.current !== undefined && results.current !== found;
              results.current = found;
            }

            setTree((t) =>
              addDirectory(rematched ? dropResultContent(t) : t, result.list_path, result.items.filter(isDirectory)),
            );
          }
        },
        (e) => {
          if (current && e.code === 503 && attempt < 20) {
            timer = setTimeout(() => load(attempt + 1), 500); // Still loading
          } else if (current && e.code !== 404) {
            reportError('Failed to load the directory')(e);
          }
        },
      );
    };

    load(0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // The client sends a new location whenever the folder has been (re)loaded, also when the path stays the same
  }, [id, path, state.id, session.location, generation]);

  useEffect(() => {
    if (!path) {
      return;
    }

    const h = history.current;
    if (h.current !== undefined && h.current !== path && !h.returning) {
      h.back.push(h.current);
    }

    h.current = path;
    h.returning = false;
    setCanGoBack(h.back.length > 0);
    // Show where we are
    setExpanded((old) => new Set([...old, ...pathChain(path).slice(0, -1)]));
  }, [path]);

  useEffect(() => {
    if (active && !session.read && state.id === 'loaded') {
      socket.post(`filelists/${id}/read`).catch(() => undefined);
    }
  }, [active, session.read, state.id]);

  const navigate = (target: string, reload = false) =>
    socket.post(`filelists/${id}/directory`, { list_path: target, reload }).catch(reportError('Open directory'));

  const goBack = () => {
    const target = history.current.back.pop();
    if (target !== undefined) {
      history.current.returning = true;
      setCanGoBack(history.current.back.length > 0);
      void navigate(target);
    }
  };

  const download = (item: FilelistItem): Downloadable =>
    isDirectory(item)
      ? // A folder that was matched is downloaded from where it is in the list
        directoryDownload(user, originPath(item) ?? item.path, downloadName(item.name))
      : fileDownload(user, item);

  /** Where an item is in the list; ADL Search shows folders in other places, too */
  const realPath = (item: FilelistItem) => (isDirectory(item) ? (originPath(item) ?? item.path) : item.path);

  const menu = (items: FilelistItem[]): RowMenu => {
    const single = items.length === 1 ? items[0] : null;
    const files = items.filter((i) => !isDirectory(i));
    const origin = single ? originPath(single) : undefined;
    const resultFolder = !!single && isResultFolder(single);
    return {
      entries: [
        ...(single && isDirectory(single) ? [{ label: 'Open', bold: own, onClick: () => void navigate(single.path) }] : []),
        ...(own ? [] : downloadMenu(items.map(download))),
        ...(origin ? [{ label: 'Go to directory', onClick: () => void navigate(origin) }] : []),
        'separator',
        // A result folder of ADL Search isn't a folder of the user, so there's nothing to look up in it
        ...(single && !resultFolder ? viewEntries({ ...single, path: realPath(single) }, user, own) : []),
        ...(canRefresh && !items.some((i) => i.adl)
          ? [
              {
                label: 'Refresh in share',
                // A file is refreshed by rescanning its folder
                onClick: () => void refreshInShare(items.map((i) => (isDirectory(i) ? i.path : parentPath(i.path)))),
              },
            ]
          : []),
        'separator',
        {
          label: 'Search for alternates',
          disabled: !single || isDirectory(single),
          onClick: () => openSearch({ pattern: single!.tth, fileType: 'tth' }),
        },
        {
          label: 'Search for the name',
          disabled: !single || resultFolder,
          onClick: () => openSearch({ pattern: single!.name, fileType: isDirectory(single!) ? 'directory' : 'any' }),
        },
        'separator',
        { label: 'Copy name', onClick: () => void copyText(items.map((i) => i.name).join('\n')) },
        { label: 'Copy path', onClick: () => void copyText(items.map(realPath).join('\n')) },
        { label: 'Copy magnet link', disabled: !files.length, onClick: () => void copyText(files.map(magnetLink).join('\n')) },
        'separator',
        { label: 'Details', disabled: !single, onClick: () => void showItemDetails(single!) },
      ],
      more: () => remoteMenu('filelist_item', items.map((i) => i.id), id),
    };
  };

  // The previous directory stays visible while the next one is being loaded
  const loading = !listing || listing.path !== path || state.id !== 'loaded';
  const items = listing?.items;
  // Typing stays responsive in folders with very many files
  const applied = useDeferredValue(filter);
  const matcher = useMemo(() => filelistMatcher(applied, options.exclude), [applied, options.exclude]);
  const shown = useMemo(
    () =>
      (items ?? []).filter(
        // Everything in the own list is shared, so the dupe checkboxes don't apply to it
        (i) => (own || dupeShown(i.dupe?.id, options)) && (!matcher || matcher(i)),
      ),
    [items, matcher, own, options.showShared, options.showQueued, options.partialDupes],
  );
  const total = items?.length ?? 0;
  const counted = shown.length === total ? `${total}` : `${shown.length}/${total}`;

  const directoryTree = (
    <div className="tree" role="tree" aria-label="Folders">
      {treeRows(tree, expanded, path ?? '/').map(({ node, depth, children, expanded: isOpen }) => (
        <div
          key={node.path}
          role="treeitem"
          aria-selected={node.path === path}
          aria-expanded={children.length ? isOpen : undefined}
          className={`tree-row${node.path === path ? ' selected' : ''}${isResultPath(node.path) ? ' adl' : ''}`}
          style={{ paddingLeft: depth * 14 + 2 }}
        >
          <button
            type="button"
            className="tree-toggle"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            onClick={() => {
              const next = new Set(expanded);
              if (!next.delete(node.path)) {
                next.add(node.path);
                if (!node.children) {
                  void navigate(node.path); // Loads the subdirectories
                }
              }

              setExpanded(next);
            }}
            // Directories without subdirectories have nothing to expand
            style={{ visibility: node.children && !node.children.length ? 'hidden' : undefined }}
          >
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <button type="button" className="tree-name" onClick={() => void navigate(node.path)}>
            {node.path === path ? <FolderOpen size={13} className="i-folder" /> : <Folder size={13} className="i-folder" />}
            <span>{node.path === '/' ? user.nicks : node.name}</span>
          </button>
        </div>
      ))}
    </div>
  );

  const table = (
    <DataTable
      id="filelist"
      label="Files"
      fitNames
      scrollKey={path}
      columns={COLUMNS}
      items={shown}
      itemKey={(i) => String(i.id)}
      icon={(i) => (isDirectory(i) ? <Folder size={13} className="i-folder" /> : <File size={13} />)}
      // Everything in the own list is shared, so there is nothing to point out
      rowClass={(i) => (isResultFolder(i) ? 'adl-result' : own ? undefined : dupeClass(i.dupe))}
      rank={(i) => (isResultFolder(i) ? -1 : isDirectory(i) ? 0 : 1)}
      defaultSort={{ column: 'name', desc: false }}
      menu={menu}
      onActivate={(i) => {
        if (isDirectory(i)) {
          void navigate(i.path);
        } else if (!own) {
          void downloadAll([download(i)]);
        }
      }}
      mobileTap={(i) => (isDirectory(i) ? 'activate' : 'menu')}
      empty={loading ? state.str : total ? 'No matching items' : 'The folder is empty'}
    />
  );

  const filterBar = <FilelistFilterBar filter={filter} onChange={setFilter} invalid={!matcher} own={own} />;
  const files = (
    <div className="filelist-files">
      {options.onTop && filterBar}
      {table}
      {!options.onTop && filterBar}
    </div>
  );

  return (
    <div className="view">
      <div className="path-bar">
        <button type="button" aria-label="Back" title="Back" disabled={!canGoBack} onClick={goBack}>
          <ArrowLeft size={13} />
        </button>
        <button
          type="button"
          aria-label="Up"
          title="Up one folder"
          disabled={!path || path === '/'}
          onClick={() => void navigate(parentPath(path!))}
        >
          <ArrowUp size={13} />
        </button>
        <button
          type="button"
          aria-label="Reload"
          title={session.partial_list ? 'Reload' : 'A full list can\u2019t be reloaded'}
          // The client only reloads folders of lists of which a part is open
          disabled={!path || !session.partial_list}
          onClick={() => void navigate(path!, true)}
        >
          <RefreshCw size={13} />
        </button>
        <nav className="breadcrumbs" aria-label="Path">
          {pathChain(path ?? '/').map((p) => (
            <button key={p} type="button" onClick={() => void navigate(p)}>
              {p === '/' ? user.nicks : lastSegment(p)}
            </button>
          ))}
        </nav>
        {canRefresh && path && !isResultPath(path) && (
          <button type="button" aria-label="Refresh in share" title="Refresh this folder in the share" onClick={() => void refreshInShare([path])}>
            <FolderSync size={13} />
          </button>
        )}
        {!own && path && path !== '/' && (
          <button
            type="button"
            title="Download this folder"
            onClick={(e) => {
              const name = downloadName(lastSegment(path));
              const entries = downloadMenu([directoryDownload(user, path, name)]);
              openMenu({ x: e.clientX, y: e.clientY }, entries, undefined, name);
            }}
          >
            <Download size={13} />
          </button>
        )}
        {access('download') && (
          <button
            type="button"
            className="match-adl"
            title="Match the ADL searches against this list"
            aria-label="Match ADL"
            disabled={state.id !== 'loaded'}
            onClick={() =>
              void matchAdl(session).then((started) => {
                if (started) {
                  // The results are at the top of the list
                  void navigate('/');
                }
              })
            }
          >
            <ListFilter size={13} />
            <span>
              <span className="match-word">Match </span>ADL
            </span>
          </button>
        )}
      </div>
      <div className="view-main">
        {mobile ? (
          files
        ) : (
          <Splitter
            id="filelistTree"
            direction="row"
            fixed="first"
            initial={260}
            min={120}
            first={directoryTree}
            second={files}
          />
        )}
      </div>
      <div className="view-status">
        <span className="grow">{loading ? state.str : `${counted} item(s) in this folder`}</span>
        <span>
          {session.total_files > 0 && `${session.total_files} files, `}
          {session.total_size >= 0 && formatSize(session.total_size)}
        </span>
        <span className="wide">{session.share_profile?.str ?? user.hub_names}</span>
      </div>
    </div>
  );
};

export const Filelist = ({ id, active }: { id: string; active: boolean }) => {
  const session = useApp((s) => s.filelists.find((l) => l.id === id));
  return session ? (
    <View session={session} active={active} />
  ) : (
    <div className="view-empty">The file list has been closed</div>
  );
};
