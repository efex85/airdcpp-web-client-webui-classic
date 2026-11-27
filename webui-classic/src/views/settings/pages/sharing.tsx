import { Pause, Play, Plus, RefreshCw, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openProfileList, refreshFolders, refreshShare } from '../../../actions';
import { remoteMenu } from '../../../actions/menus';
import type {
  HashDatabaseStatus,
  HashStats,
  SettingDefinition,
  ShareProfile,
  ShareRoot,
} from '../../../api/settingsTypes';
import { showForm } from '../../../components/forms/FormDialog';
import { browsePath } from '../../../components/FileBrowser';
import { useAccess } from '../../../lib/access';
import { formatDate, formatDuration, formatSize, formatSpeed } from '../../../lib/format';
import { fsName } from '../../../lib/fsPath';
import { withSearch } from '../../../lib/settingsSearch';
import { reportError, useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { confirm } from '../../../store/ui';
import { Facts, LoadError, SimpleList, useApiData } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';
import { settingsPage } from './common';

const HIDDEN_PROFILE = 1;

const ROOT_EVENTS = ['share_roots/share_root_created', 'share_roots/share_root_updated', 'share_roots/share_root_removed'];
const PROFILE_EVENTS = [
  'share_profiles/share_profile_added',
  'share_profiles/share_profile_updated',
  'share_profiles/share_profile_removed',
];

const editRoot = async (root?: ShareRoot) => {
  let profiles: ShareProfile[];
  let names: string[] = [];
  try {
    profiles = await socket.get<ShareProfile[]>('share_profiles');
    const grouped = await socket.get<{ name: string }[]>('share/grouped_root_paths');
    names = grouped.map((g) => g.name);
  } catch (e) {
    reportError('Shared folder')(e);
    return;
  }

  const separator = useApp.getState().login?.system_info.path_separator ?? '/';
  const definitions: SettingDefinition[] = [
    { key: 'path', title: 'Path', type: 'directory_path' },
    {
      key: 'virtual_name',
      title: 'Virtual name',
      type: 'string',
      help: 'Directories with identical virtual names are merged in the file list',
    },
    {
      key: 'profiles',
      title: 'Share profiles',
      type: 'list',
      item_type: 'number',
      options: profiles.map((p) => ({ id: p.id, name: p.str })),
      help: 'New share profiles can be created on the Share profiles page',
    },
    { key: 'incoming', title: 'Incoming', type: 'boolean' },
  ];

  await showForm({
    title: root ? 'Edit shared folder' : 'Add shared folder',
    confirmLabel: root ? 'Save' : 'Add',
    definitions,
    saved: root && { ...root, profiles: root.profiles.map((p) => p.id) },
    initial: { profiles: profiles.filter((p) => p.default).map((p) => p.id) },
    disabled: (key) => key === 'path' && !!root,
    suggestions: { virtual_name: names },
    onChange: (key, values) =>
      key === 'path' && !root ? { virtual_name: fsName(String(values.path), separator) } : undefined,
    intro: !root && (
      <p className="muted">
        New files appear in the share only after they have been hashed. The progress is shown in the system log.
      </p>
    ),
    save: (values) => (root ? socket.patch(`share_roots/${root.id}`, values) : socket.post('share_roots', values)),
  });
};

const removeRoot = async (root: ShareRoot) => {
  const text = `Remove "${root.path}" from the share? It will be removed from all share profiles. The files are not deleted.`;
  if (await confirm('Remove shared folder', text, 'Remove')) {
    await socket.delete(`share_roots/${root.id}`).catch(reportError('Remove shared folder'));
  }
};

const SharedFolders = () => {
  const access = useAccess();
  const canEdit = access('share_edit');
  const { data, error } = useApiData<ShareRoot[]>('share_roots', ROOT_EVENTS);

  return (
    <Page>
      <div className="settings-actions">
        <button type="button" disabled={!canEdit} onClick={() => void editRoot()}>
          <Plus size={13} /> Add folder
        </button>
        <button type="button" disabled={!canEdit} onClick={() => void refreshShare()}>
          <RefreshCw size={13} /> Refresh all
        </button>
        <button type="button" disabled={!canEdit} onClick={() => void refreshShare(true)}>
          Refresh incoming
        </button>
      </div>
      <LoadError error={error} />
      <SimpleList
        label="Shared folders"
        items={data && [...data].sort((a, b) => a.path.localeCompare(b.path))}
        rowKey={(r) => r.id}
        rowClass={(r) => (r.incoming ? 'incoming' : '')}
        columns={[
          {
            title: 'Path',
            render: (r) => (
              <>
                {r.path}
                {r.status.id !== 'normal' && (
                  <div className="root-status">
                    {r.status.str}
                    {r.status.refresh_task_id !== null && canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          socket
                            .delete(`share/refresh/tasks/${r.status.refresh_task_id}`)
                            .catch(reportError('Cancel refresh'))
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </>
            ),
          },
          { title: 'Virtual name', render: (r) => r.virtual_name },
          { title: 'Size', render: (r) => formatSize(r.size), align: 'right' },
          { title: 'Content', render: (r) => r.type.str, secondary: true },
          { title: 'Profiles', render: (r) => r.profiles.map((p) => p.str).join(', '), secondary: true },
          {
            title: 'Last refreshed',
            render: (r) => (r.last_refresh_time ? formatDate(r.last_refresh_time) : 'Unknown'),
            secondary: true,
          },
        ]}
        actions={
          canEdit
            ? (r) => [
                { label: 'Edit…', onClick: () => void editRoot(r) },
                { label: 'Refresh', onClick: () => void refreshFolders([r.path], r.path) },
                { label: 'Remove', onClick: () => void removeRoot(r) },
              ]
            : undefined
        }
        more={(r) => remoteMenu('share_root', [r.id])}
        empty="No shared folders"
      />
      <Note>Highlighted folders are incoming folders.</Note>
    </Page>
  );
};

export const SharedFoldersPage = withSearch(SharedFolders, {
  words: 'share directory',
  items: [
    { title: 'Add folder', permission: 'share_edit' },
    { title: 'Refresh all', permission: 'share_edit' },
    { title: 'Refresh incoming', permission: 'share_edit' },
  ],
});

const REFRESH_KEYS = ['refresh_time', 'refresh_time_incoming', 'refresh_startup', 'refresh_threading'];

export const RefreshPage = settingsPage(REFRESH_KEYS);

const askName = (title: string, confirmLabel: string, name: string, save: (name: string) => Promise<unknown>) =>
  showForm({
    title,
    confirmLabel,
    definitions: [{ key: 'name', title: 'Name', type: 'string' }],
    initial: { name },
    save: (values) => save(values.name as string),
  });

const createProfile = (name: string) => socket.post<ShareProfile>('share_profiles', { name });

/** Creates a profile that includes the same directories as the source profile */
const cloneProfile = async (source: ShareProfile, name: string) => {
  const created = await createProfile(name);
  const roots = await socket.get<ShareRoot[]>('share_roots');
  for (const root of roots) {
    const ids = root.profiles.map((p) => p.id);
    if (ids.includes(source.id)) {
      await socket.patch(`share_roots/${root.id}`, { profiles: [...ids, created.id] });
    }
  }
};

const Profiles = () => {
  const access = useAccess();
  const canEdit = access('share_edit');
  const { data, error } = useApiData<ShareProfile[]>('share_profiles', PROFILE_EVENTS);

  const remove = async (profile: ShareProfile) => {
    if (await confirm('Remove profile', `Remove the share profile "${profile.str}"?`, 'Remove')) {
      await socket.delete(`share_profiles/${profile.id}`).catch(reportError('Remove profile'));
    }
  };

  return (
    <Page>
      <LoadError error={error} />
      <SimpleList
        label="Share profiles"
        items={data}
        rowKey={(p) => p.id}
        columns={[
          { title: 'Name', render: (p) => p.str },
          { title: 'Total size', render: (p) => formatSize(p.size), align: 'right' },
          { title: 'Total files', render: (p) => p.files, align: 'right' },
        ]}
        actions={(p) => [
          { label: 'Browse files', disabled: !access('filelists_view'), onClick: () => void openProfileList(p.id) },
          {
            label: 'Rename…',
            disabled: !canEdit || p.id === HIDDEN_PROFILE,
            onClick: () =>
              void askName('Rename profile', 'Rename', p.name, (name) =>
                socket.patch(`share_profiles/${p.id}`, { name }),
              ),
          },
          {
            label: 'Clone…',
            disabled: !canEdit,
            onClick: () => void askName(`Clone of ${p.str}`, 'Create', '', (name) => cloneProfile(p, name)),
          },
          {
            label: 'Set as default',
            disabled: !canEdit || p.default,
            onClick: () =>
              void socket.post(`share_profiles/${p.id}/default`).catch(reportError('Set default profile')),
          },
          { label: 'Remove', disabled: !canEdit || p.default, onClick: () => void remove(p) },
        ]}
        empty="No share profiles"
      />
      <div className="settings-actions">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => void askName('New share profile', 'Create', '', createProfile)}
        >
          <Plus size={13} /> Add profile
        </button>
      </div>
      <Note>
        Share profiles are assigned to directories on the Shared folders page. Queued files are shared (partial file
        sharing) in all hubs where the share is not hidden.
      </Note>
    </Page>
  );
};

export const ProfilesPage = withSearch(Profiles, { items: [{ title: 'Add profile', words: 'share profile' }] });

const SHARING_KEYS = ['share_hidden', 'share_no_empty_dirs', 'share_no_zero_byte', 'share_follow_symlinks', 'share_max_size'];
const SKIPLIST_KEYS = ['share_skiplist', 'share_skiplist_regex'];

const SharingOptions = () => {
  const form = useRemoteForm([...SHARING_KEYS, ...SKIPLIST_KEYS]);
  return (
    <Page form={form}>
      <Fields form={form} keys={SHARING_KEYS} />
      <Section title="Skiplist">
        <Fields form={form} keys={SKIPLIST_KEYS} />
      </Section>
    </Page>
  );
};

export const SharingOptionsPage = withSearch(SharingOptions, {
  keys: [...SHARING_KEYS, ...SKIPLIST_KEYS],
  items: [{ title: 'Skiplist' }],
  describe: (key) => (SKIPLIST_KEYS.includes(key) ? { words: 'skiplist' } : {}),
});

const hashStatusText = (stats: HashStats) =>
  stats.pause_forced ? 'Paused' : stats.hashers > 0 ? `Running (${stats.hashers} threads)` : 'Idle';

const HashStatus = ({ canEdit }: { canEdit: boolean }) => {
  const generation = useApp((s) => s.generation);
  const [stats, setStats] = useState<HashStats>();

  const load = () => socket.get<HashStats>('hash/stats').then(setStats, () => undefined);

  useEffect(() => {
    let active = true;
    let remove: (() => void) | undefined;
    // The event contains the changed values only
    socket
      .listen('hash', 'hash_statistics', (changed: Partial<HashStats>) =>
        setStats((old) => old && { ...old, ...changed }),
      )
      .then(
        (r) => (active ? (remove = r) : r()),
        () => undefined,
      );
    void load();
    return () => {
      active = false;
      remove?.();
    };
  }, [generation]);

  if (!stats) {
    return null;
  }

  const control = (action: 'pause' | 'resume' | 'stop') =>
    socket.post(`hash/${action}`).then(load, reportError('Hashing'));

  return (
    <Section title="Hashing">
      <Facts
        rows={[
          ['Status', hashStatusText(stats)],
          ['Files left', stats.hash_files_left],
          ['Size left', formatSize(stats.hash_bytes_left)],
          ['Speed', formatSpeed(stats.hash_speed) || '-'],
          [
            'Time left',
            stats.hash_speed > 0 ? formatDuration(stats.hash_bytes_left / stats.hash_speed) || '-' : '-',
          ],
        ]}
      />
      {canEdit && (
        <div className="settings-actions">
          {stats.pause_forced ? (
            <button type="button" onClick={() => void control('resume')}>
              <Play size={13} /> Resume
            </button>
          ) : (
            <button type="button" onClick={() => void control('pause')}>
              <Pause size={13} /> Pause
            </button>
          )}
          <button
            type="button"
            disabled={!stats.hashers}
            onClick={async () => {
              if (await confirm('Stop hashing', 'Stop hashing the queued files?', 'Stop')) {
                await control('stop');
              }
            }}
          >
            <Square size={13} /> Stop
          </button>
        </div>
      )}
    </Section>
  );
};

const HashDatabase = ({ canEdit }: { canEdit: boolean }) => {
  const { data, error } = useApiData<HashDatabaseStatus>('hash/database_status', ['hash/hash_database_status']);
  const [verify, setVerify] = useState(false);

  return (
    <Section title="Hash database">
      <LoadError error={error} />
      {data && (
        <Facts
          rows={[
            ['File index size', formatSize(data.file_index_size)],
            ['Hash store size', formatSize(data.hash_store_size)],
          ]}
        />
      )}
      {canEdit && data && (
        <>
          <h4>Maintenance</h4>
          <Note>
            Optimizing deletes all hash information of the files that aren't currently in the share. Make sure that all
            shared drives are connected and the share has been refreshed before running it.
          </Note>
          <label className="check-field">
            <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
            Verify integrity of hash data
          </label>
          <div className="settings-actions">
            <button
              type="button"
              disabled={data.maintenance_running}
              onClick={async () => {
                const text = 'Delete the hash information of all files that are not in the share and optimize the database?';
                if (await confirm('Optimize hash database', text, 'Optimize')) {
                  await socket.post('hash/optimize_database', { verify }).catch(reportError('Optimize'));
                }
              }}
            >
              {data.maintenance_running ? 'Maintenance is running…' : 'Optimize now'}
            </button>
          </div>
        </>
      )}
    </Section>
  );
};

const HASH_KEYS = ['max_hash_speed', 'max_total_hashers', 'max_volume_hashers'];

const Hashing = () => {
  const access = useAccess();
  const form = useRemoteForm(HASH_KEYS);
  return (
    <Page form={form}>
      <Fields form={form} keys={HASH_KEYS} />
      {access('share_view') && (
        <>
          <HashStatus canEdit={access('share_edit')} />
          <HashDatabase canEdit={access('share_edit')} />
        </>
      )}
    </Page>
  );
};

export const HashingPage = withSearch(Hashing, {
  keys: HASH_KEYS,
  items: [
    { title: 'Hash database', permission: 'share_view' },
    { title: 'Verify integrity of hash data', permission: 'share_edit' },
    { title: 'Optimize now', words: 'hash database maintenance', permission: 'share_edit' },
  ],
});

const Excludes = () => {
  const access = useAccess();
  const canEdit = access('share_edit');
  const { data, error } = useApiData<string[]>('share/excludes', [
    'share/share_exclude_added',
    'share/share_exclude_removed',
  ]);

  const add = async () => {
    const path = await browsePath('directory');
    if (path) {
      await socket.post('share/excludes/add', { path }).catch(reportError('Exclude directory'));
    }
  };

  const remove = async (path: string) => {
    if (await confirm('Remove excluded path', `Remove "${path}" from the excluded paths?`, 'Remove')) {
      await socket.post('share/excludes/remove', { path }).catch(reportError('Remove excluded path'));
    }
  };

  return (
    <Page>
      <Note>The share must be refreshed for the changes to take effect.</Note>
      <div className="settings-actions">
        <button type="button" disabled={!canEdit} onClick={() => void add()}>
          <Plus size={13} /> Exclude a directory
        </button>
        <button type="button" disabled={!canEdit} onClick={() => void refreshShare()}>
          <RefreshCw size={13} /> Refresh share
        </button>
      </div>
      <LoadError error={error} />
      <SimpleList
        label="Excluded paths"
        items={data}
        rowKey={(path) => path}
        columns={[{ title: 'Path', render: (path) => path }]}
        actions={canEdit ? (path) => [{ label: 'Remove', onClick: () => void remove(path) }] : undefined}
        empty="No excluded paths"
      />
    </Page>
  );
};

export const ExcludesPage = withSearch(Excludes, {
  words: 'folder directory',
  items: [
    { title: 'Exclude a directory', permission: 'share_edit' },
    { title: 'Refresh share', permission: 'share_edit' },
  ],
});
