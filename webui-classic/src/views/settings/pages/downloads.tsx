import { Plus } from 'lucide-react';
import type { FavoriteDirectory, SearchType, SettingDefinition } from '../../../api/settingsTypes';
import { showForm } from '../../../components/forms/FormDialog';
import { useAccess } from '../../../lib/access';
import { fsName } from '../../../lib/fsPath';
import { reportError, useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { confirm } from '../../../store/ui';
import { ExternalLink, links, LoadError, SimpleList, useApiData } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';

const editDirectory = async (all: FavoriteDirectory[], item?: FavoriteDirectory) => {
  const separator = useApp.getState().login?.system_info.path_separator ?? '/';
  await showForm({
    title: item ? 'Edit favorite directory' : 'Add favorite directory',
    confirmLabel: item ? 'Save' : 'Add',
    definitions: [
      { key: 'path', title: 'Path', type: 'directory_path' },
      { key: 'name', title: 'Name', type: 'string' },
    ],
    saved: item && { path: item.path, name: item.name },
    disabled: (key) => key === 'path' && !!item,
    suggestions: { name: [...new Set(all.map((d) => d.name))] },
    // Suggest the name of the chosen directory
    onChange: (key, values) =>
      key === 'path' && !item ? { name: fsName(String(values.path), separator) } : undefined,
    save: (values) =>
      item ? socket.patch(`favorite_directories/${item.id}`, values) : socket.post('favorite_directories', values),
  });
};

const FavoriteDirectories = () => {
  const { data, error } = useApiData<FavoriteDirectory[]>('favorite_directories', [
    'favorite_directories/favorite_directories_updated',
  ]);
  const canEdit = useAccess()('settings_edit');

  const remove = async (item: FavoriteDirectory) => {
    if (await confirm('Remove favorite directory', `Remove "${item.name}" (${item.path})?`, 'Remove')) {
      await socket.delete(`favorite_directories/${item.id}`).catch(reportError('Remove directory'));
    }
  };

  return (
    <Section title="Favorite download directories">
      <LoadError error={error} />
      <SimpleList
        label="Favorite download directories"
        items={data}
        rowKey={(d) => d.id}
        columns={[
          { title: 'Name', render: (d) => d.name },
          { title: 'Path', render: (d) => d.path },
        ]}
        actions={
          canEdit
            ? (d) => [
                { label: 'Edit…', onClick: () => void editDirectory(data ?? [], d) },
                { label: 'Remove', onClick: () => void remove(d) },
              ]
            : undefined
        }
        empty="No favorite directories"
      />
      <div className="settings-actions">
        <button type="button" disabled={!canEdit} onClick={() => void editDirectory(data ?? [])}>
          <Plus size={13} /> Add directory
        </button>
      </div>
    </Section>
  );
};

export const LocationsPage = () => {
  const keys = ['download_directory'];
  const form = useRemoteForm(keys);
  return (
    <Page form={form}>
      <Fields form={form} keys={keys} />
      <Note>
        <ExternalLink href={links.variables}>Available path variables</ExternalLink>
      </Note>
      <FavoriteDirectories />
    </Page>
  );
};

type Group = [title: string | undefined, keys: string[]];

/** Pages that only contain settings */
const groupedPage = (groups: Group[]) => () => {
  const form = useRemoteForm(groups.flatMap(([, keys]) => keys));
  return (
    <Page form={form}>
      {groups.map(([title, keys]) => (
        <Section key={title ?? keys[0]} title={title}>
          <Fields form={form} keys={keys} />
        </Section>
      ))}
    </Page>
  );
};

export const SkippingPage = groupedPage([
  [undefined, ['dont_download_shared', 'dont_download_queued', 'download_dupe_min_size']],
  ['Skiplist', ['download_skiplist', 'download_skiplist_regex']],
]);

export const SearchMatchingPage = groupedPage([
  [
    undefined,
    [
      'auto_add_sources',
      'alt_search_auto',
      'alt_search_max_sources',
      'alt_search_min_interval',
      'max_sources_match_queue',
      'allow_match_full_list',
    ],
  ],
]);

export const DownloadOptionsPage = groupedPage([
  [undefined, ['allow_slow_overlap', 'finished_remove_exit', 'use_partial_sharing']],
  ['Segments', ['segmented_downloads', 'min_segment_size']],
  ['Compression', ['compress_transfers', 'max_compression']],
  ['Buffers', ['socket_read_buffer', 'socket_write_buffer', 'buffer_size']],
]);

export const PrioritiesPage = groupedPage([
  ['File priorities', ['prio_highest_size', 'prio_high_size', 'prio_normal_size', 'prio_auto_default']],
  ['High priority files', ['prio_high_files_to_highest', 'prio_high_files', 'prio_high_files_regex']],
]);

const searchTypeFields: SettingDefinition[] = [
  { key: 'name', title: 'Name', type: 'string' },
  { key: 'extensions', title: 'File extensions', type: 'list', item_type: 'string' },
];

const editSearchType = (item?: SearchType) =>
  showForm({
    title: item ? 'Edit search type' : 'Add search type',
    // The list of extensions has an "Add" button of its own
    confirmLabel: item ? 'Save' : 'Create',
    definitions: searchTypeFields,
    // Default types are identified by their translated name
    saved: item && { name: item.default_type ? item.str : item.name, extensions: item.extensions },
    disabled: (key) => key === 'name' && !!item?.default_type,
    save: (values) => (item ? socket.patch(`search/types/${item.id}`, values) : socket.post('search/types', values)),
  });

export const SearchTypesPage = () => {
  const { data, error } = useApiData<SearchType[]>('search/types', ['search/search_types_updated']);
  const canEdit = useAccess()('settings_edit');

  const remove = async (item: SearchType) => {
    if (await confirm('Remove search type', `Remove the search type "${item.str}"?`, 'Remove')) {
      await socket.delete(`search/types/${item.id}`).catch(reportError('Remove search type'));
    }
  };

  return (
    <Page>
      <Note>
        Custom search types are only used in ADC hubs. In NMDC hubs the default types use fixed extensions and custom
        types match any file.
      </Note>
      <LoadError error={error} />
      <SimpleList
        label="Search types"
        items={data}
        rowKey={(t) => t.id}
        columns={[
          { title: 'Name', render: (t) => t.str },
          { title: 'Extensions', render: (t) => t.extensions.join(', ') },
          { title: 'Default', render: (t) => (t.default_type ? 'Yes' : 'No'), secondary: true },
        ]}
        actions={
          canEdit
            ? (t) => [
                { label: 'Edit…', onClick: () => void editSearchType(t) },
                { label: 'Remove', disabled: t.default_type, onClick: () => void remove(t) },
              ]
            : undefined
        }
        empty="No search types"
      />
      <div className="settings-actions">
        <button type="button" disabled={!canEdit} onClick={() => void editSearchType()}>
          <Plus size={13} /> Add search type
        </button>
      </div>
    </Page>
  );
};
