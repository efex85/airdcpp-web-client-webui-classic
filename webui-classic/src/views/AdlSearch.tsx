// The ADL Search window, as in the Windows client
import { ArrowDown, ArrowUp, CircleHelp, ListFilter, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/socket';
import type { AdlSearch, AdlState } from '../api/types';
import { showAdlSearch } from '../components/AdlSearchDialog';
import { DataTable, type Column } from '../components/DataTable';
import { useAccess } from '../lib/access';
import {
  DEFAULT_DESTINATION,
  insertRow,
  keepKeys,
  moveRows,
  newRow,
  newSearch,
  replaceRow,
  sizeLabel,
  sourceTypeLabel,
  type AdlRow,
} from '../lib/adl';
import { reportError, toast, useApp } from '../store/app';
import { socket } from '../store/session';
import { confirm, showCustomDialog } from '../store/ui';

const CHANGED_ELSEWHERE = 'The searches had been changed elsewhere. They have been loaded again: please repeat your change.';

interface Data {
  revision: number;
  rows: AdlRow[];
  settings: AdlState['settings'];
}

const Help = ({ close }: { close: () => void }) => (
  <>
    <div className="dialog-body">
      <p>
        ADL Search matches your searches against a file list. What matches appears in result folders at the top of the
        list, named after the destination of the search (<b>{`<<<${DEFAULT_DESTINATION}>>>`}</b> if it has none).
      </p>
      <p>
        A full list is matched when it is opened, if that is switched on here. <b>Match ADL</b> in a file list matches it
        at any time, also your own; for a list of which only a part is open, the full list is downloaded first. Use{' '}
        <b>Go to directory</b> on a result to see where it is in the list.
      </p>
      <p>
        <b>Source type</b> says what a search looks at: the name of a file, the name of a folder (the whole folder becomes
        a result) or the full path of a file. The file sizes apply to files only.
      </p>
      <p>
        With <b>Stop after the first match</b>, a file or folder is found by one search only, so the order matters. A
        destination called <b>discard</b> isn&apos;t shown: put such a search first, with that setting on, to leave its
        files out of all other results.
      </p>
      <p>
        <b>Download matches</b> adds the matching files of another user to the queue; folder searches don&apos;t download
        anything. The searches are kept in{' '}
        <b>ADLSearch.xml</b> in the settings folder of the client, in the same format as the Windows client.{' '}
        <b>Reload</b> reads the file again.
      </p>
    </div>
    <div className="dialog-buttons">
      <button type="button" onClick={close}>
        Close
      </button>
    </div>
  </>
);

export const AdlSearchView = ({ active }: { active: boolean }) => {
  const access = useAccess();
  const canView = access('settings_view');
  const canEdit = access('settings_edit');
  const generation = useApp((s) => s.generation);
  const [data, setData] = useState<Data | null>(null);
  const [failure, setFailure] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // The newest data also for dialogs that were opened earlier
  const latest = useRef<Data | null>(null);

  /** Rows keep their keys, so that the selection stays */
  const apply = (state: AdlState, rows?: AdlRow[]) => {
    const previous = rows ?? latest.current?.rows ?? [];
    latest.current = {
      revision: state.revision,
      settings: state.settings,
      rows: rows
        ? state.searches.map((search, i) => ({ key: rows[i]?.key ?? newRow(search).key, search }))
        : keepKeys(previous, state.searches),
    };
    setData(latest.current);
    setFailure('');
  };

  const load = async () => {
    try {
      apply(await socket.get<AdlState>('adl/searches'));
    } catch (e) {
      setFailure((e as Error).message);
    }
  };

  // Also when the window is shown again: the searches may have been changed on another device
  useEffect(() => {
    if (active && canView) {
      void load();
    }
  }, [active, canView, generation]);

  /** Saves the changed list; resolves with the reason if that fails */
  const save = async (change: (rows: AdlRow[]) => AdlRow[]): Promise<string | null> => {
    const current = latest.current;
    if (!current) {
      return 'The searches have not been loaded';
    }

    const rows = change(current.rows);
    setBusy(true);
    try {
      const state = await socket.post<AdlState>('adl/searches', {
        revision: current.revision,
        searches: rows.map((r) => r.search),
      });
      apply(state, rows);
      return null;
    } catch (e) {
      if ((e as ApiError).code !== 409) {
        return (e as Error).message;
      }

      await load();
      return CHANGED_ELSEWHERE;
    } finally {
      setBusy(false);
    }
  };

  const change = async (edit: (rows: AdlRow[]) => AdlRow[]) => {
    const problem = await save(edit);
    if (problem) {
      toast(problem, true);
    }
  };

  const setting = async (key: keyof AdlState['settings'], value: boolean) => {
    try {
      apply(await socket.post<AdlState>('adl/settings', { [key]: value }));
    } catch (e) {
      reportError('ADL Search')(e);
    }
  };

  const reload = async () => {
    try {
      apply(await socket.post<AdlState>('adl/reload'));
      toast('The searches have been read from ADLSearch.xml');
    } catch (e) {
      reportError('Reload')(e);
    }
  };

  const rows = data?.rows ?? [];
  const chosen = rows.filter((r) => selected.includes(r.key));
  const editable = canEdit && !!data && !busy;

  const add = () => {
    const row = newRow(newSearch());
    // Before the selected search, as in the Windows client
    const before = chosen[0]?.key;
    void showAdlSearch('New ADL search', row.search, (search) =>
      save((list) => insertRow(list, { ...row, search }, before)),
    );
  };

  const edit = (row: AdlRow) => {
    if (canEdit) {
      void showAdlSearch('ADL search properties', row.search, (search) =>
        save((list) => replaceRow(list, { key: row.key, search })),
      );
    }
  };

  const remove = async (targets: AdlRow[]) => {
    if (!canEdit || !targets.length) {
      return;
    }

    const text =
      targets.length === 1 ? `Remove the search "${targets[0].search.pattern}"?` : `Remove ${targets.length} searches?`;
    if (await confirm('Remove ADL search', text, 'Remove')) {
      const keys = new Set(targets.map((r) => r.key));
      await change((list) => list.filter((r) => !keys.has(r.key)));
    }
  };

  const move = (targets: AdlRow[], step: -1 | 1) =>
    change((list) => moveRows(list, new Set(targets.map((r) => r.key)), step));

  const toggle = (row: AdlRow, values: Partial<AdlSearch>) =>
    change((list) => replaceRow(list, { key: row.key, search: { ...row.search, ...values } }));

  const columns: Column<AdlRow>[] = [
    {
      id: 'pattern',
      title: 'Active search string',
      width: 280,
      value: (r) => r.search.pattern,
      render: (r) => (
        <label className="adl-name" onDoubleClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Enabled: ${r.search.pattern}`}
            checked={r.search.active}
            disabled={!editable}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => void toggle(r, { active: e.target.checked })}
          />
          <span>{r.search.pattern}</span>
        </label>
      ),
    },
    { id: 'source', title: 'Source type', width: 90, mobile: 'detail', value: (r) => sourceTypeLabel(r.search.source_type) },
    { id: 'destination', title: 'Destination', width: 130, mobile: 'detail', value: (r) => r.search.destination },
    {
      id: 'min',
      title: 'Min size',
      width: 80,
      align: 'right',
      value: (r) => sizeLabel(r.search, r.search.min_size),
    },
    {
      id: 'max',
      title: 'Max size',
      width: 80,
      align: 'right',
      value: (r) => sizeLabel(r.search, r.search.max_size),
    },
    { id: 'comment', title: 'Comment', width: 180, mobile: 'detail', value: (r) => r.search.comment },
    { id: 'regex', title: 'Regexp', width: 60, mobile: 'right', value: (r) => (r.search.regex ? 'Yes' : '') },
    { id: 'download', title: 'Download', width: 70, defaultHidden: true, value: (r) => (r.search.download ? 'Yes' : '') },
  ];

  if (!canView) {
    return <div className="view-empty">You may not view the settings of the client, which ADL Search is a part of.</div>;
  }

  return (
    <div
      className="view"
      onKeyDown={(e) => {
        if (e.key === 'Insert' && editable) {
          e.preventDefault();
          add();
        }
      }}
    >
      <div className="adl-options">
        <label className="check-field">
          <input
            type="checkbox"
            checked={!!data?.settings.match_full_lists}
            disabled={!editable}
            onChange={(e) => void setting('match_full_lists', e.target.checked)}
          />
          Match ADL when a full file list is opened
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={!!data?.settings.break_on_first}
            disabled={!editable}
            onChange={(e) => void setting('break_on_first', e.target.checked)}
          />
          Stop after the first match
        </label>
      </div>
      <div className="view-main">
        <DataTable
          id="adl"
          label="ADL searches"
          fixedOrder
          columns={columns}
          items={rows}
          itemKey={(r) => r.key}
          icon={(r) => <ListFilter size={13} className={r.search.active ? 'i-search' : 'i-muted'} />}
          rowClass={(r) => (r.search.active ? undefined : 'adl-off')}
          onSelect={(items) => setSelected(items.map((r) => r.key))}
          onActivate={edit}
          onDelete={(items) => void remove(items)}
          menu={(items) => ({
            entries: [
              {
                label: 'Properties…',
                bold: true,
                disabled: !editable || items.length !== 1,
                onClick: () => edit(items[0]),
              },
              {
                label: items.every((r) => r.search.active) ? 'Disable' : 'Enable',
                disabled: !editable,
                onClick: () => {
                  const active = !items.every((r) => r.search.active);
                  const keys = new Set(items.map((r) => r.key));
                  void change((list) =>
                    list.map((r) => (keys.has(r.key) ? { ...r, search: { ...r.search, active } } : r)),
                  );
                },
              },
              'separator',
              { label: 'Move up', disabled: !editable, onClick: () => void move(items, -1) },
              { label: 'Move down', disabled: !editable, onClick: () => void move(items, 1) },
              'separator',
              { label: 'Remove', disabled: !editable, onClick: () => void remove(items) },
            ],
          })}
          empty={failure || (data ? 'No ADL searches. Add one with New.' : 'Loading…')}
        />
      </div>
      <div className="view-buttons adl-buttons">
        <button type="button" disabled={!editable} onClick={add}>
          <Plus size={13} /> New
        </button>
        <button type="button" disabled={!editable || chosen.length !== 1} onClick={() => edit(chosen[0])}>
          <Pencil size={13} /> Properties
        </button>
        <button type="button" disabled={!editable || !chosen.length} onClick={() => void remove(chosen)}>
          <Trash2 size={13} /> Remove
        </button>
        <button type="button" disabled={!editable || !chosen.length} onClick={() => void move(chosen, -1)}>
          <ArrowUp size={13} /> Move up
        </button>
        <button type="button" disabled={!editable || !chosen.length} onClick={() => void move(chosen, 1)}>
          <ArrowDown size={13} /> Move down
        </button>
        <button type="button" disabled={!editable} onClick={() => void reload()}>
          <RefreshCw size={13} /> Reload
        </button>
        <span className="grow" />
        <button
          type="button"
          onClick={() => void showCustomDialog('ADL Search', (close) => <Help close={() => close(null)} />, true)}
        >
          <CircleHelp size={13} /> What&apos;s this?
        </button>
      </div>
    </div>
  );
};
