import { Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { remoteMenu } from '../../../actions/menus';
import type { Extension, SettingDefinition, SettingValues } from '../../../api/settingsTypes';
import { showForm } from '../../../components/forms/FormDialog';
import { useAccess } from '../../../lib/access';
import { formatDate } from '../../../lib/format';
import { fetchThroughClient } from '../../../lib/proxy';
import { withSearch } from '../../../lib/settingsSearch';
import { compareVersions } from '../../../lib/version';
import { reportError, toast, useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { confirm, openMenu } from '../../../store/ui';
import { ExternalLink, LoadError, useApiData } from '../data';
import { Note, Page } from '../form';
import { settingsPage } from './common';

const NPM = 'https://registry.npmjs.org/';
const CATALOG_URL = `${NPM}-/v1/search?text=keywords:airdcpp-extensions-public&size=100`;

interface Package {
  name: string;
  version: string;
  description?: string;
  date?: string;
  publisher?: { username: string };
}

const EVENTS = [
  'extensions/extension_added',
  'extensions/extension_removed',
  'extensions/extension_updated',
  'extensions/extension_started',
  'extensions/extension_stopped',
];

/** Downloads a package from the npm registry and installs it */
const installPackage = async (name: string) => {
  try {
    const latest = await fetchThroughClient<{ dist: { tarball: string; shasum: string } }>(`${NPM}${name}/latest`);
    await socket.post('extensions/download', { install_id: name, url: latest.dist.tarball, shasum: latest.dist.shasum });
  } catch (e) {
    reportError(`Install ${name}`)(e);
  }
};

/** Names of the packages that are being installed; reports the results */
const useInstallations = () => {
  const generation = useApp((s) => s.generation);
  const [installing, setInstalling] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const removers: (() => void)[] = [];
    const listen = (event: string, handler: (data: { install_id: string; error?: string }) => void) =>
      socket.listen('extensions', event, handler).then(
        (remove) => (active ? removers.push(remove) : remove()),
        () => undefined,
      );

    const done = (id: string) => setInstalling((list) => list.filter((x) => x !== id));
    void listen('extension_installation_started', (e) => setInstalling((list) => [...list, e.install_id]));
    void listen('extension_installation_succeeded', (e) => {
      done(e.install_id);
      toast(`Extension installed: ${e.install_id}`);
    });
    void listen('extension_installation_failed', (e) => {
      done(e.install_id);
      toast(`Installing ${e.install_id} failed: ${e.error}`, true);
    });

    return () => {
      active = false;
      removers.forEach((remove) => remove());
    };
  }, [generation]);

  return installing;
};

const configure = async (extension: Extension) => {
  try {
    const [definitions, settings] = await Promise.all([
      socket.get<SettingDefinition[]>(`extensions/${extension.name}/settings/definitions`),
      socket.get<SettingValues>(`extensions/${extension.name}/settings`),
    ]);
    await showForm({
      title: extension.name,
      definitions,
      saved: settings,
      save: (changed) => socket.patch(`extensions/${extension.name}/settings`, changed),
    });
  } catch (e) {
    reportError('Extension settings')(e);
  }
};

const ExtensionCard = ({
  name,
  author,
  description,
  installed,
  latest,
  installing,
  note,
}: {
  name: string;
  author?: string;
  description?: string;
  installed?: Extension;
  latest?: Package;
  installing: boolean;
  note?: string;
}) => {
  const access = useAccess();
  const admin = access('admin');
  const update = !!installed && !!latest && compareVersions(installed.version, latest.version) < 0;
  const run = (action: Promise<unknown>) => void action.catch(reportError(name));
  const buttons: ReactNode[] = [];

  if (latest && (!installed || (update && installed.managed))) {
    buttons.push(
      <button key="install" type="button" disabled={!admin || installing} onClick={() => void installPackage(name)}>
        {installing ? 'Installing…' : installed ? 'Update' : 'Install'}
      </button>,
    );
  }

  if (installed?.managed) {
    const action = installed.running ? 'stop' : 'start';
    buttons.push(
      <button
        key="run"
        type="button"
        disabled={!admin}
        onClick={() => run(socket.post(`extensions/${installed.name}/${action}`))}
      >
        {installed.running ? 'Stop' : 'Start'}
      </button>,
    );
  }

  if (installed?.has_settings) {
    buttons.push(
      <button
        key="configure"
        type="button"
        disabled={!access('settings_edit')}
        onClick={() => void configure(installed)}
      >
        Configure
      </button>,
    );
  }

  if (installed) {
    buttons.push(
      <button
        key="more"
        type="button"
        aria-haspopup="menu"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          openMenu(
            { x: box.left, y: box.bottom },
            installed.managed
              ? [
                  {
                    label: installed.disabled ? 'Enable' : 'Disable',
                    disabled: !admin,
                    onClick: () =>
                      run(socket.patch(`extensions/${installed.name}`, { disabled: !installed.disabled })),
                  },
                  {
                    label: 'Uninstall',
                    disabled: !admin,
                    onClick: async () => {
                      const text = `Remove the extension ${installed.name}? This also removes its settings.`;
                      if (await confirm('Uninstall extension', text, 'Remove')) {
                        run(socket.delete(`extensions/${installed.name}`));
                      }
                    },
                  },
                ]
              : [],
            () => remoteMenu('extension', [installed.name]),
          );
        }}
      >
        More…
      </button>,
    );
  }

  return (
    <li className="extension">
      <div className="extension-title">
        <strong>{name}</strong>
        {author && <span className="muted">by {author}</span>}
        {installed && (
          <span className={`badge${installed.running ? ' ok' : ''}`}>
            {installed.disabled ? 'Disabled' : installed.running ? 'Running' : 'Stopped'}
          </span>
        )}
      </div>
      {description && <div>{description}</div>}
      <div className="muted">
        {installed && (
          <span className={update ? 'outdated' : ''}>Installed version: {installed.version || 'unknown'} </span>
        )}
        {latest && (
          <span>
            Latest version: {latest.version}
            {latest.date ? ` (published ${formatDate(Date.parse(latest.date) / 1000)})` : ''}
          </span>
        )}
        {note && <span> {note}</span>}
      </div>
      <div className="settings-actions">
        {buttons}
        {latest && <ExternalLink href={`https://www.npmjs.com/package/${name}`}>Read more</ExternalLink>}
      </div>
    </li>
  );
};

const EngineWarning = () => {
  const { data } = useApiData<Record<string, string | null>>('extensions/engines/status');
  return data && !data.node ? (
    <Note>
      The default extension engine <strong>node</strong> is not installed on the system of the client.{' '}
      <ExternalLink href="https://nodejs.org">Installation instructions</ExternalLink>
    </Note>
  ) : null;
};

export const ExtensionsPage = () => {
  const { data, error } = useApiData<Extension[]>('extensions', EVENTS);
  const installing = useInstallations();
  // Information from the npm registry; null if the package could not be found
  const [packages, setPackages] = useState<Record<string, Package | string>>({});

  const names = (data ?? [])
    .filter((e) => e.managed && !e.private)
    .map((e) => e.name)
    .join(' ');
  useEffect(() => {
    let active = true;
    for (const name of names.split(' ').filter(Boolean)) {
      fetchThroughClient<Package>(`${NPM}${name}/latest`).then(
        (info) => active && setPackages((p) => ({ ...p, [name]: info })),
        (e: Error) => active && setPackages((p) => ({ ...p, [name]: e.message })),
      );
    }

    return () => {
      active = false;
    };
  }, [names]);

  return (
    <Page>
      <EngineWarning />
      <LoadError error={error} />
      {data && !data.length && (
        <div className="muted">No installed extensions. New ones can be installed from the Extension catalog page.</div>
      )}
      <ul className="extension-list">
        {data?.map((extension) => {
          const info = packages[extension.name];
          return (
            <ExtensionCard
              key={extension.name}
              name={extension.name}
              author={extension.author}
              description={extension.description}
              installed={extension}
              latest={typeof info === 'object' ? info : undefined}
              installing={installing.includes(extension.name)}
              note={
                !extension.managed
                  ? 'Unmanaged extension'
                  : extension.private
                    ? 'Non-listed extension'
                    : typeof info === 'string'
                      ? `No information from the extension directory: ${info}`
                      : undefined
              }
            />
          );
        })}
      </ul>
    </Page>
  );
};

const installFromUrl = () =>
  showForm({
    title: 'Install from URL',
    confirmLabel: 'Install',
    definitions: [{ key: 'url', title: 'Download address', type: 'url' }],
    save: (values) => socket.post('extensions/download', { install_id: values.url, url: values.url }),
  });

const Catalog = () => {
  const admin = useAccess()('admin');
  const installed = useApiData<Extension[]>('extensions', EVENTS);
  const installing = useInstallations();
  const [catalog, setCatalog] = useState<Package[]>();
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let active = true;
    fetchThroughClient<{ objects: { package: Package }[] }>(CATALOG_URL).then(
      (result) => active && setCatalog(result.objects.map((o) => o.package)),
      (e: Error) => active && setError(`Failed to load the extension catalog: ${e.message}`),
    );
    return () => {
      active = false;
    };
  }, []);

  const pattern = filter.trim().toLowerCase();
  const shown = catalog?.filter((p) => `${p.name} ${p.description ?? ''}`.toLowerCase().includes(pattern));

  return (
    <Page>
      <EngineWarning />
      <div className="settings-actions">
        <input
          type="search"
          aria-label="Filter extensions"
          placeholder="Filter extensions"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button type="button" disabled={!admin} onClick={() => void installFromUrl()}>
          <Plus size={13} /> Install from URL
        </button>
      </div>
      <LoadError error={error || installed.error} />
      {!catalog && !error && <div className="muted">Loading…</div>}
      <ul className="extension-list">
        {shown?.map((p) => (
          <ExtensionCard
            key={p.name}
            name={p.name}
            author={p.publisher?.username}
            description={p.description}
            installed={installed.data?.find((e) => e.name === p.name)}
            latest={p}
            installing={installing.includes(p.name)}
          />
        ))}
      </ul>
    </Page>
  );
};

export const CatalogPage = withSearch(Catalog, {
  items: [{ title: 'Filter extensions', words: 'search' }, { title: 'Install from URL' }],
});

export const ExtensionOptionsPage = settingsPage([
  'extensions_debug_mode',
  'extensions_auto_update',
  'extensions_init_timeout',
]);
export const ExtensionEnginesPage = settingsPage(['extension_engines']);
