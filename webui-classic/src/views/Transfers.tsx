import { ArrowDown, ArrowUp } from 'lucide-react';
import { browseUser, copyText, userMenu } from '../actions';
import { remoteMenu } from '../actions/menus';
import { removeQueuedFiles, removeUsersFromQueue } from '../actions/queue';
import type { Transfer } from '../api/types';
import { DataTable, type Column, type RowMenu } from '../components/DataTable';
import { hasAccess } from '../lib/access';
import { formatDuration, formatSize, formatSpeed, percent } from '../lib/format';
import { reportError } from '../store/app';
import { useLiveList } from '../store/live';
import { socket, transfers } from '../store/session';
import type { MenuEntry } from '../store/ui';
import { Progress } from '../components/Progress';

const COLUMNS: Column<Transfer>[] = [
  { id: 'user', title: 'User', width: 150, value: (t) => t.user?.nicks ?? '' },
  { id: 'name', title: 'Bundle/Filename', width: 250, mobile: 'detail', value: (t) => t.name ?? '' },
  { id: 'hub', title: 'Hub', width: 150, value: (t) => t.user?.hub_names ?? '' },
  {
    id: 'status',
    title: 'Status',
    width: 190,
    mobile: 'detail',
    value: (t) => t.status?.str ?? '',
    render: (t) =>
      t.status?.id === 'running' && t.size > 0 ? (
        <Progress value={percent(t.bytes_transferred, t.size)} text={t.status.str} upload={!t.download} />
      ) : (
        (t.status?.str ?? '')
      ),
  },
  {
    id: 'left',
    title: 'Time left',
    width: 70,
    align: 'right',
    value: (t) => (t.status?.id === 'running' ? t.seconds_left : -1),
    render: (t) => (t.status?.id === 'running' ? formatDuration(t.seconds_left) : ''),
  },
  {
    id: 'speed',
    title: 'Speed',
    width: 90,
    align: 'right',
    mobile: 'right',
    value: (t) => t.speed,
    render: (t) => formatSpeed(t.speed),
  },
  {
    id: 'size',
    title: 'Size',
    width: 85,
    align: 'right',
    mobile: 'right',
    value: (t) => t.size,
    render: (t) => formatSize(t.size),
  },
  { id: 'path', title: 'Path', width: 280, value: (t) => t.target ?? '' },
  { id: 'ip', title: 'IP', width: 110, value: (t) => t.ip?.str ?? '' },
  {
    id: 'transferred',
    title: 'Transferred',
    width: 90,
    align: 'right',
    defaultHidden: true,
    value: (t) => t.bytes_transferred,
    render: (t) => formatSize(t.bytes_transferred),
  },
  { id: 'encryption', title: 'Encryption', width: 200, defaultHidden: true, value: (t) => t.encryption?.str ?? '' },
];

const action = (items: Transfer[], name: 'force' | 'disconnect', title: string) =>
  items.forEach((t) => void socket.post(`transfers/${t.id}/${name}`).catch(reportError(title)));

/** Downloads that can still be removed from the queue */
const queued = (items: Transfer[]) => items.filter((t) => t.download && t.status?.id !== 'finished');

const queueEntries = (items: Transfer[]): MenuEntry[] => {
  if (!hasAccess('queue_edit')) {
    return [];
  }

  const downloads = queued(items);
  const files = downloads.filter((t) => t.queue_file_id && t.target);
  const users = downloads.flatMap((t) => (t.user ? [t.user] : []));
  return [
    { label: 'Remove file from queue', disabled: !files.length, onClick: () => void removeQueuedFiles(files) },
    { label: 'Remove user from queue', disabled: !users.length, onClick: () => void removeUsersFromQueue(users) },
  ];
};

const menu = (items: Transfer[]): RowMenu => ({
  entries: [
    ...(items.length === 1 && items[0].user ? userMenu(items[0].user) : []),
    'separator',
    {
      label: 'Force connection attempt',
      disabled: !items.some((t) => t.download),
      onClick: () => action(items.filter((t) => t.download), 'force', 'Force'),
    },
    { label: 'Disconnect', onClick: () => action(items, 'disconnect', 'Disconnect') },
    'separator',
    ...queueEntries(items),
    'separator',
    { label: 'Copy path', onClick: () => void copyText(items.map((t) => t.target).join('\n')) },
  ],
  more: () => remoteMenu('transfer', items.map((t) => t.id)),
});

export const Transfers = () => {
  const items = useLiveList(transfers);
  return (
    <DataTable
      id="transfers"
      label="Transfers"
      columns={COLUMNS}
      items={items}
      itemKey={(t) => String(t.id)}
      icon={(t) =>
        t.download ? (
          <ArrowDown size={13} className="i-down" aria-label="Download" />
        ) : (
          <ArrowUp size={13} className="i-up" aria-label="Upload" />
        )
      }
      menu={menu}
      onActivate={(t) => t.user && !t.user.flags.includes('self') && void browseUser(t.user)}
      mobileTap="menu"
      empty="No transfers"
    />
  );
};
