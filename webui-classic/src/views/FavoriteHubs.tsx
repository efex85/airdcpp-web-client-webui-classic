import { Pencil, Plug, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { connectHub, copyText } from '../actions';
import type { ShareProfile } from '../api/settingsTypes';
import type { FavoriteHub } from '../api/types';
import { DataTable, type Column } from '../components/DataTable';
import { showForm } from '../components/forms/FormDialog';
import { favoriteHubForm } from '../actions/favoriteHubForm';
import { openTab, reportError } from '../store/app';
import { useLiveList } from '../store/live';
import { favorites, socket } from '../store/session';
import { confirm } from '../store/ui';

const isOnline = (hub: FavoriteHub) => !!hub.connect_state.current_hub_id;

const open = (hub: FavoriteHub) => {
  if (isOnline(hub)) {
    openTab(`hub:${hub.connect_state.current_hub_id}`);
  } else {
    void connectHub(hub.hub_url);
  }
};

const edit = async (hub?: FavoriteHub) => {
  // The profiles can't be listed by all users; the global default is then the only choice
  const profiles = await socket.get<ShareProfile[]>('share_profiles').catch(() => [] as ShareProfile[]);
  await showForm(favoriteHubForm(profiles, hub));
};

const remove = async (hubs: FavoriteHub[]) => {
  const text = hubs.length === 1 ? `Remove "${hubs[0].name}" from the favorite hubs?` : `Remove ${hubs.length} favorite hubs?`;
  if (await confirm('Remove favorite', text, 'Remove')) {
    for (const hub of hubs) {
      await socket.delete(`favorite_hubs/${hub.id}`).catch(reportError('Remove favorite'));
    }
  }
};

const COLUMNS: Column<FavoriteHub>[] = [
  { id: 'name', title: 'Name', width: 220, value: (h) => h.name },
  {
    id: 'auto',
    title: 'Auto connect',
    width: 90,
    value: (h) => (h.auto_connect ? 'Yes' : 'No'),
    render: (h) => (
      <input
        type="checkbox"
        aria-label="Connect automatically"
        checked={h.auto_connect}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) =>
          socket.patch(`favorite_hubs/${h.id}`, { auto_connect: e.target.checked }).catch(reportError('Favorite hub'))
        }
      />
    ),
  },
  { id: 'description', title: 'Description', width: 220, value: (h) => h.hub_description },
  { id: 'nick', title: 'Nick', width: 130, value: (h) => h.nick },
  { id: 'address', title: 'Address', width: 280, mobile: 'detail', value: (h) => h.hub_url },
  { id: 'status', title: 'Status', width: 140, mobile: 'right', value: (h) => h.connect_state.str },
];

export const FavoriteHubs = () => {
  const hubs = useLiveList(favorites);
  const [selected, setSelected] = useState<number[]>([]);
  const current = hubs.filter((h) => selected.includes(h.id));

  return (
    <div className="view">
      <div className="view-main">
        <DataTable
          id="favorites"
          label="Favorite hubs"
          columns={COLUMNS}
          items={hubs}
          itemKey={(h) => String(h.id)}
          icon={(h) => <Star size={13} className={isOnline(h) ? 'i-star' : 'i-muted'} />}
          defaultSort={{ column: 'name', desc: false }}
          onSelect={(items) => setSelected(items.map((h) => h.id))}
          onActivate={open}
          onDelete={(items) => void remove(items)}
          menu={(items) => ({
            entries: [
              {
                label: items.length === 1 && isOnline(items[0]) ? 'Open' : 'Connect',
                bold: true,
                onClick: () => items.forEach(open),
              },
              { label: 'Properties…', disabled: items.length !== 1, onClick: () => void edit(items[0]) },
              { label: 'Copy address', onClick: () => void copyText(items.map((h) => h.hub_url).join('\n')) },
              'separator',
              { label: 'Remove', onClick: () => void remove(items) },
            ],
          })}
          empty="No favorite hubs"
        />
      </div>
      <div className="view-buttons">
        <button type="button" onClick={() => void edit()}>
          <Plus size={13} /> New
        </button>
        <button type="button" disabled={current.length !== 1} onClick={() => void edit(current[0])}>
          <Pencil size={13} /> Properties
        </button>
        <button type="button" disabled={!current.length} onClick={() => current.forEach(open)}>
          <Plug size={13} /> Connect
        </button>
        <button type="button" disabled={!current.length} onClick={() => void remove(current)}>
          <Trash2 size={13} /> Remove
        </button>
      </div>
    </div>
  );
};
