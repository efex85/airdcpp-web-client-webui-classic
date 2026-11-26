import { File, Folder, Pause, Play, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { browseUser, copyText, openPrivateChat } from '../actions';
import { pauseAll, removeUsersFromQueue, resumeAll, shareBundles } from '../actions/queue';
import { remoteMenu } from '../actions/menus';
import type { HintedUser, QueueBundle, QueueFile } from '../api/types';
import { DataTable, type Column, type RowMenu } from '../components/DataTable';
import { Progress } from '../components/Progress';
import { Splitter } from '../components/Splitter';
import { useAccess } from '../lib/access';
import { formatDate, formatDuration, formatSize, formatSpeed, percent } from '../lib/format';
import { useIsMobile } from '../lib/useIsMobile';
import { reportError, toast, useApp } from '../store/app';
import { LiveList, useLiveList } from '../store/live';
import { bundles, socket } from '../store/session';
import { confirm, showDialog, type MenuEntry } from '../store/ui';

const PRIORITIES: [number, string][] = [
  [-1, 'Auto'],
  [6, 'Highest'],
  [5, 'High'],
  [4, 'Normal'],
  [3, 'Low'],
  [2, 'Lowest'],
  [1, 'Paused'],
  [0, 'Paused (forced)'],
];

const priorityMenu = (items: QueueBundle[], kind: 'bundles' | 'files'): MenuEntry => {
  const single = items.length === 1 ? items[0] : null;
  return {
    label: 'Priority',
    children: PRIORITIES.map(([id, label]) => ({
      label,
      checked: !!single && (id === -1 ? single.priority?.auto : !single.priority?.auto && single.priority?.id === id),
      onClick: () =>
        items.forEach((x) => void socket.post(`queue/${kind}/${x.id}/priority`, { priority: id }).catch(reportError('Priority'))),
    })),
  };
};

const searchAlternates = (items: QueueBundle[], kind: 'bundles' | 'files') => {
  Promise.all(items.map((x) => socket.post(`queue/${kind}/${x.id}/search`))).then(
    () => toast('Searching for alternative sources'),
    reportError('Search for alternates'),
  );
};

/** The content check of a finished download (e.g. by an extension) has failed */
const failedValidation = (x: QueueBundle) => x.status?.id === 'completion_validation_error';

const removeBundles = async (items: QueueBundle[]) => {
  const result = await showDialog({
    title: 'Remove from queue',
    text: items.length === 1 ? `Remove "${items[0].name}" from the queue?` : `Remove ${items.length} items from the queue?`,
    fields: [{ key: 'remove_finished', label: 'Also delete the downloaded files from disk', type: 'boolean' }],
    confirmLabel: 'Remove',
  });
  if (result) {
    for (const bundle of items) {
      await socket.post(`queue/bundles/${bundle.id}/remove`, result).catch(reportError('Remove'));
    }
  }
};

const removeFiles = async (items: QueueFile[]) => {
  const text = items.length === 1 ? `Remove "${items[0].name}" from the queue?` : `Remove ${items.length} files from the queue?`;
  if (await confirm('Remove from queue', text, 'Remove')) {
    for (const file of items) {
      await socket.post(`queue/files/${file.id}/remove`).catch(reportError('Remove'));
    }
  }
};

export const removeCompleted = () =>
  socket.post('queue/bundles/remove_completed').catch(reportError('Remove completed'));

// The daemon keeps reporting the last speed of an item after it has been paused or finished
// (priorities 0 and 1 are "paused (forced)" and "paused")
const isMoving = (x: QueueBundle) => (x.priority?.id ?? 0) > 1 && !x.status?.downloaded;
const speedOf = (x: QueueBundle) => (isMoving(x) ? x.speed : 0);
const timeLeftOf = (x: QueueBundle) => (isMoving(x) ? x.seconds_left : 0);

const itemColumns = <T extends QueueBundle>(): Column<T>[] => [
  { id: 'name', title: 'Name', width: 280, value: (x) => x.name ?? '' },
  {
    id: 'size',
    title: 'Size',
    width: 85,
    align: 'right',
    mobile: 'right',
    value: (x) => x.size,
    render: (x) => formatSize(x.size),
  },
  {
    id: 'status',
    title: 'Status',
    width: 210,
    mobile: 'detail',
    value: (x) => x.status?.str ?? '',
    render: (x) => (
      <Progress
        value={percent(x.downloaded_bytes, x.size)}
        text={x.status?.str ?? ''}
        done={x.status?.completed || x.status?.downloaded}
      />
    ),
  },
  {
    id: 'speed',
    title: 'Speed',
    width: 90,
    align: 'right',
    mobile: 'right',
    value: speedOf,
    render: (x) => formatSpeed(speedOf(x)),
  },
  {
    id: 'left',
    title: 'Time left',
    width: 70,
    align: 'right',
    value: timeLeftOf,
    render: (x) => formatDuration(timeLeftOf(x)),
  },
  { id: 'priority', title: 'Priority', width: 100, mobile: 'detail', value: (x) => x.priority?.str ?? '' },
  { id: 'sources', title: 'Sources', width: 90, mobile: 'detail', value: (x) => x.sources?.str ?? '' },
  {
    id: 'downloaded',
    title: 'Downloaded',
    width: 90,
    align: 'right',
    defaultHidden: true,
    value: (x) => x.downloaded_bytes,
    render: (x) => formatSize(x.downloaded_bytes),
  },
  { id: 'added', title: 'Added', width: 120, value: (x) => x.time_added, render: (x) => formatDate(x.time_added) },
  {
    id: 'finished',
    title: 'Finished',
    width: 120,
    defaultHidden: true,
    value: (x) => x.time_finished,
    render: (x) => formatDate(x.time_finished),
  },
  { id: 'target', title: 'Target', width: 320, value: (x) => x.target ?? '' },
];

const BUNDLE_COLUMNS = itemColumns<QueueBundle>();
const FILE_COLUMNS = itemColumns<QueueFile>();

const icon = (x: QueueBundle) =>
  x.type?.id === 'directory' ? <Folder size={13} className="i-folder" /> : <File size={13} />;

/** Files of one bundle, kept up to date */
const useBundleFiles = (bundleId: number): QueueFile[] => {
  const generation = useApp((s) => s.generation);
  const [list] = useState(() => new LiveList<QueueFile>(250));

  useEffect(() => {
    let active = true;
    const removers: (() => void)[] = [];
    const listen = (event: string, handler: (file: QueueFile) => void) =>
      socket.listen('queue', event, handler).then((remove) => (active ? removers.push(remove) : remove()));

    list.clear();
    Promise.all([
      listen('queue_file_added', (file) => file.bundle === bundleId && list.add(file)),
      listen('queue_file_updated', (file) => file.bundle === bundleId && list.update(file)),
      listen('queue_file_removed', (file) => list.remove(file.id)),
    ])
      .then(() => list.load(() => socket.get<QueueFile[]>(`queue/bundles/${bundleId}/files/0/100000`)))
      .catch((e) => active && e.code !== 404 && reportError('Failed to load the files')(e));

    return () => {
      active = false;
      removers.forEach((remove) => remove());
    };
  }, [bundleId, generation]);

  return useLiveList(list);
};

const Files = ({ bundle }: { bundle: QueueBundle }) => {
  const files = useBundleFiles(bundle.id);
  return (
    <DataTable
      id="queueFiles"
      label="Files"
      columns={FILE_COLUMNS}
      items={files}
      itemKey={(f) => String(f.id)}
      icon={() => <File size={13} />}
      defaultSort={{ column: 'name', desc: false }}
      onDelete={(items) => void removeFiles(items)}
      menu={(items) => ({
        entries: [
          { label: 'Search for alternates', onClick: () => searchAlternates(items, 'files') },
          priorityMenu(items, 'files'),
          'separator',
          { label: 'Copy name', onClick: () => void copyText(items.map((f) => f.name).join('\n')) },
          { label: 'Copy TTH', onClick: () => void copyText(items.map((f) => f.tth).join('\n')) },
          'separator',
          { label: 'Remove', onClick: () => void removeFiles(items) },
        ],
        more: () => remoteMenu('queue_file', items.map((f) => f.id)),
      })}
      empty="No files"
    />
  );
};

interface Source {
  id: string;
  user: HintedUser;
  last_speed: number;
  files?: number;
  size?: number;
}

const SOURCE_COLUMNS: Column<Source>[] = [
  { id: 'user', title: 'User', width: 180, value: (s) => s.user.nicks },
  { id: 'hub', title: 'Hub', width: 200, mobile: 'detail', value: (s) => s.user.hub_names ?? '' },
  { id: 'files', title: 'Files', width: 60, align: 'right', value: (s) => s.files ?? 0 },
  {
    id: 'size',
    title: 'Size',
    width: 90,
    align: 'right',
    mobile: 'right',
    value: (s) => s.size ?? 0,
    render: (s) => formatSize(s.size),
  },
  {
    id: 'speed',
    title: 'Last speed',
    width: 100,
    align: 'right',
    value: (s) => s.last_speed,
    render: (s) => formatSpeed(s.last_speed),
  },
];

const Sources = ({ bundle }: { bundle: QueueBundle }) => {
  const canEdit = useAccess()('queue_edit');
  const [sources, setSources] = useState<Source[]>([]);
  const [reload, setReload] = useState(0);
  const generation = useApp((s) => s.generation);
  const request = useRef(0);

  useEffect(() => {
    const current = ++request.current;
    socket.get<Source[]>(`queue/bundles/${bundle.id}/sources`).then(
      (result) => current === request.current && setSources(result),
      () => current === request.current && setSources([]),
    );
  }, [bundle.id, bundle.sources?.str, generation, reload]);

  const remove = async (items: Source[]) => {
    for (const source of items) {
      await socket.delete(`queue/bundles/${bundle.id}/sources/${source.id}`).catch(reportError('Remove source'));
    }

    setReload((n) => n + 1);
  };

  const menu = (items: Source[]): RowMenu => ({
    entries: [
      { label: 'Get file list', bold: true, disabled: items.length !== 1, onClick: () => void browseUser(items[0].user) },
      { label: 'Send private message', disabled: items.length !== 1, onClick: () => void openPrivateChat(items[0].user) },
      'separator',
      { label: 'Remove source', disabled: !canEdit, onClick: () => void remove(items) },
      {
        label: 'Remove user from queue',
        disabled: !canEdit,
        onClick: () =>
          void removeUsersFromQueue(items.map((s) => s.user)).then((removed) => removed && setReload((n) => n + 1)),
      },
    ],
  });

  return (
    <DataTable
      id="queueSources"
      label="Sources"
      columns={SOURCE_COLUMNS}
      items={sources}
      itemKey={(s) => s.id}
      menu={menu}
      onActivate={(s) => void browseUser(s.user)}
      onDelete={(items) => void remove(items)}
      mobileTap="menu"
      empty="No sources"
    />
  );
};

const Details = ({ bundle, onClose }: { bundle: QueueBundle; onClose?: () => void }) => {
  const [tab, setTab] = useState<'files' | 'sources'>('files');
  return (
    <div className="subpane">
      <div className="segmented" role="tablist">
        {(['files', 'sources'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'files' ? 'Files' : 'Sources'}
          </button>
        ))}
        <span className="subpane-title">{bundle.name}</span>
        {onClose && (
          <button type="button" className="close-details" onClick={onClose}>
            Back to the queue
          </button>
        )}
      </div>
      <div className="view-main">{tab === 'files' ? <Files bundle={bundle} /> : <Sources bundle={bundle} />}</div>
    </div>
  );
};

export const Queue = () => {
  const items = useLiveList(bundles);
  const mobile = useIsMobile();
  const canEdit = useAccess()('queue_edit');
  const [selected, setSelected] = useState<number | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const shownId = mobile ? details : selected;
  const shown = items.find((b) => b.id === shownId);

  const menu = (targets: QueueBundle[]): RowMenu => ({
    entries: [
      ...(mobile && targets.length === 1
        ? [{ label: 'Files and sources', bold: true, onClick: () => setDetails(targets[0].id) } as MenuEntry]
        : []),
      { label: 'Search for alternates', onClick: () => searchAlternates(targets, 'bundles') },
      priorityMenu(targets, 'bundles'),
      'separator',
      ...(canEdit && targets.some(failedValidation)
        ? [
            { label: 'Rescan for errors', onClick: () => void shareBundles(targets.filter(failedValidation), false) },
            { label: 'Force in share', onClick: () => void shareBundles(targets.filter(failedValidation), true) },
          ]
        : []),
      'separator',
      { label: 'Copy name', onClick: () => void copyText(targets.map((b) => b.name).join('\n')) },
      { label: 'Copy target path', onClick: () => void copyText(targets.map((b) => b.target).join('\n')) },
      'separator',
      { label: 'Remove', onClick: () => void removeBundles(targets) },
    ],
    more: () => remoteMenu('queue_bundle', targets.map((b) => b.id)),
  });

  const list = (
    <DataTable
      id="queue"
      label="Download queue"
      columns={BUNDLE_COLUMNS}
      items={items}
      itemKey={(b) => String(b.id)}
      icon={icon}
      defaultSort={{ column: 'added', desc: true }}
      onSelect={(s) => setSelected(s.length === 1 ? s[0].id : null)}
      onDelete={(s) => void removeBundles(s)}
      menu={menu}
      mobileTap="menu"
      empty="The queue is empty"
    />
  );

  return (
    <div className="view">
      <div className="view-main">
        {mobile ? (
          shown ? (
            <Details key={shown.id} bundle={shown} onClose={() => setDetails(null)} />
          ) : (
            list
          )
        ) : (
          <Splitter
            id="queueDetails"
            direction="column"
            initial={220}
            first={list}
            second={shown ? <Details key={shown.id} bundle={shown} /> : null}
          />
        )}
      </div>
      <div className="view-buttons queue-buttons">
        <span className="grow">
          {items.length} item(s), {formatSize(items.reduce((sum, b) => sum + Math.max(0, b.size), 0))}
        </span>
        <button
          type="button"
          disabled={!canEdit || !items.length}
          onClick={() => void pauseAll()}
          title="Pause all downloads in the queue"
        >
          <Pause size={13} /> Pause all
        </button>
        <button
          type="button"
          disabled={!canEdit || !items.length}
          onClick={() => void resumeAll()}
          title="Resume all downloads with automatic priority"
        >
          <Play size={13} /> Resume all
        </button>
        <button
          type="button"
          disabled={!shown}
          onClick={() => shown && searchAlternates([shown], 'bundles')}
          title="Search for alternates"
        >
          <Search size={13} /> Alternates
        </button>
        <button type="button" disabled={!items.some((b) => b.status?.completed)} onClick={() => void removeCompleted()}>
          <Trash2 size={13} /> Remove completed
        </button>
      </div>
    </div>
  );
};
