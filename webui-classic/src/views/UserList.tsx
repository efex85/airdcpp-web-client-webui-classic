import { Bot, Shield, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { grantSlot, matchQueue, openUser, userMenu } from '../actions';
import { remoteMenu } from '../actions/menus';
import type { OnlineUser } from '../api/types';
import { DataTable, type Column, type RowMenu } from '../components/DataTable';
import { formatSize, formatSpeed } from '../lib/format';
import type { Group } from '../lib/table';
import { FILTER_FIELDS, FILTER_METHODS, userMatcher, type FilterField, type FilterMethod } from '../lib/userFilter';
import { nickClass, toHinted } from '../lib/user';

const GROUPS: Group[] = [
  { id: 'op', title: 'Operators' },
  { id: 'bot', title: 'Bots' },
  { id: 'user', title: 'Users' },
];

const groupOf = (u: OnlineUser) => (u.flags.includes('bot') ? 'bot' : u.flags.includes('op') ? 'op' : 'user');

const icon = (u: OnlineUser) => {
  const Icon = u.flags.includes('bot') ? Bot : u.flags.includes('op') ? Shield : User;
  const state = ['away', 'passive', 'noconnect', 'ignored'].filter((f) => u.flags.includes(f)).join(' ');
  return (
    <span title={state || undefined}>
      <Icon size={13} className={`i-user ${groupOf(u)} ${state}`} />
    </span>
  );
};

const COLUMNS: Column<OnlineUser>[] = [
  {
    id: 'nick',
    title: 'Nick',
    width: 170,
    value: (u) => u.nick,
    render: (u) => <span className={nickClass(u.flags)}>{u.nick}</span>,
  },
  {
    id: 'shared',
    title: 'Shared',
    width: 80,
    align: 'right',
    mobile: 'right',
    value: (u) => u.share_size,
    render: (u) => formatSize(u.share_size),
  },
  {
    id: 'exact',
    title: 'Exact share',
    width: 120,
    align: 'right',
    value: (u) => u.share_size,
    render: (u) => `${u.share_size.toLocaleString()} B`,
  },
  { id: 'description', title: 'Description', width: 130, mobile: 'detail', value: (u) => u.description ?? '' },
  { id: 'tag', title: 'Tag', width: 220, mobile: 'detail', value: (u) => u.tag ?? '' },
  {
    id: 'speed',
    title: 'Upload speed',
    width: 90,
    align: 'right',
    defaultHidden: true,
    value: (u) => u.upload_speed,
    render: (u) => formatSpeed(u.upload_speed),
  },
  { id: 'slots', title: 'Slots', width: 50, align: 'right', defaultHidden: true, value: (u) => u.upload_slots },
  { id: 'files', title: 'Files', width: 70, align: 'right', defaultHidden: true, value: (u) => u.file_count },
  { id: 'ip', title: 'IP', width: 120, defaultHidden: true, value: (u) => u.ip4?.str || u.ip6?.str || '' },
  { id: 'email', title: 'E-mail', width: 140, defaultHidden: true, value: (u) => u.email ?? '' },
];

export const UserList = ({ hubId, users }: { hubId: number; users: OnlineUser[] }) => {
  const [filter, setFilter] = useState('');
  const [field, setField] = useState<FilterField>('any');
  const [method, setMethod] = useState<FilterMethod>('partial');

  const matcher = useMemo(() => userMatcher(filter, field, method), [filter, field, method]);
  const shown = useMemo(() => (matcher ? users.filter(matcher) : users), [users, matcher]);

  const menu = (targets: OnlineUser[]): RowMenu => {
    const ids = targets.map((u) => u.id);
    const single = targets.length === 1 ? toHinted(targets[0]) : null;
    const others = targets.map(toHinted).filter((u) => !u.flags.includes('self'));
    return {
      entries: single
        ? userMenu(single)
        : [
            { label: 'Match queue', disabled: !others.length, onClick: () => others.forEach((u) => void matchQueue(u)) },
            { label: 'Grant extra slot', disabled: !others.length, onClick: () => others.forEach((u) => void grantSlot(u)) },
          ],
      more: () => remoteMenu('hub_user', ids, hubId),
    };
  };

  return (
    <div className="user-list">
      <DataTable
        id="users"
        label="Users"
        columns={COLUMNS}
        items={shown}
        itemKey={(u) => String(u.id)}
        icon={icon}
        rowClass={(u) => (u.flags.includes('away') ? 'away' : undefined)}
        groups={GROUPS}
        groupOf={groupOf}
        defaultSort={{ column: 'nick', desc: false }}
        menu={menu}
        onActivate={(u) => !u.flags.includes('self') && void openUser(toHinted(u))}
        mobileTap="menu"
        empty={users.length ? 'No matching users' : 'No users'}
      />
      <div className="user-filter">
        <input
          type="search"
          placeholder="Filter..."
          aria-label="Filter users"
          aria-invalid={!matcher}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select aria-label="Filter field" value={field} onChange={(e) => setField(e.target.value as FilterField)}>
          {FILTER_FIELDS.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select aria-label="Match type" value={method} onChange={(e) => setMethod(e.target.value as FilterMethod)}>
          {FILTER_METHODS.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
