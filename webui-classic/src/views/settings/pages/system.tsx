import { Plus, RotateCw } from 'lucide-react';
import type { SettingDefinition, SettingValues, WebUser } from '../../../api/settingsTypes';
import { showForm } from '../../../components/forms/FormDialog';
import { useAccess } from '../../../lib/access';
import { formatDate } from '../../../lib/format';
import { PERMISSIONS } from '../../../lib/permissions';
import { reportError, toast, useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { confirm } from '../../../store/ui';
import { ExternalLink, links, LoadError, SimpleList, useApiData } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';

const editUser = (user?: WebUser) => {
  const self = !!user && user.username === useApp.getState().login?.user.username;
  const definitions = (values: SettingValues): SettingDefinition[] => {
    const admin = (values.permissions as string[] | undefined)?.includes('admin');
    return [
      { key: 'username', title: 'User name', type: 'string' },
      { key: 'password', title: user ? 'New password' : 'Password', type: 'password', optional: !!user },
      {
        key: 'permissions',
        title: 'Permissions',
        type: 'list',
        item_type: 'string',
        // An administrator can do everything
        options: PERMISSIONS.filter(([id]) => !admin || id === 'admin').map(([id, name]) => ({ id, name })),
        help: 'The Administrator permission is required for the System section of the settings',
      },
    ];
  };

  return showForm({
    title: user ? 'Edit user' : 'Add web user',
    confirmLabel: user ? 'Save' : 'Add',
    definitions,
    // The password is not known; it is only sent when a new one is entered
    saved: user && { username: user.username, password: '', permissions: user.permissions },
    initial: { permissions: [] },
    disabled: (key) => (key === 'username' && !!user) || (key === 'permissions' && self),
    save: (values) =>
      user
        ? socket.patch(`web_users/${encodeURIComponent(user.username)}`, values)
        : socket.post('web_users', values),
  });
};

export const UsersPage = () => {
  const ownName = useApp((s) => s.login?.user.username);
  const { data, error } = useApiData<WebUser[]>('web_users', [
    'web_users/web_user_added',
    'web_users/web_user_updated',
    'web_users/web_user_removed',
  ]);

  const remove = async (user: WebUser) => {
    if (await confirm('Remove user', `Remove the web user "${user.username}"?`, 'Remove')) {
      await socket.delete(`web_users/${encodeURIComponent(user.username)}`).catch(reportError('Remove user'));
    }
  };

  return (
    <Page>
      <LoadError error={error} />
      <SimpleList
        label="Web users"
        items={data}
        rowKey={(u) => u.username}
        columns={[
          { title: 'User name', render: (u) => u.username },
          {
            title: 'Permissions',
            render: (u) => (u.permissions.includes('admin') ? 'Administrator' : u.permissions.length),
          },
          { title: 'Active sessions', render: (u) => u.active_sessions, align: 'right', secondary: true },
          { title: 'Last logged in', render: (u) => (u.last_login ? formatDate(u.last_login) : 'Never') },
        ]}
        actions={(u) => [
          { label: 'Edit…', onClick: () => void editUser(u) },
          { label: 'Remove', disabled: u.username === ownName, onClick: () => void remove(u) },
        ]}
        empty="No users"
      />
      <div className="settings-actions">
        <button type="button" onClick={() => void editUser()}>
          <Plus size={13} /> Add user
        </button>
      </div>
    </Page>
  );
};

const MESSAGE_LOGS = ['main', 'pm', 'syslog', 'status'];
const TRANSFER_LOGS = ['downloads', 'uploads'];
const logKeys = (section: string) => [`log_${section}`, `log_${section}_file`, `log_${section}_format`];

export const LoggingPage = () => {
  const sections = [...MESSAGE_LOGS, ...TRANSFER_LOGS];
  const form = useRemoteForm(['log_directory', ...sections.flatMap(logKeys), 'log_list_transfers'], {
    disabled: (key, values) => {
      const match = key.match(/^(log_.+)_(file|format)$/);
      return !!match && !values[match[1]];
    },
  });

  const groups = (list: string[]) =>
    list.map((section) => (
      <div key={section} className="log-group">
        <Fields form={form} keys={logKeys(section)} />
      </div>
    ));

  return (
    <Page form={form}>
      <Fields form={form} keys={['log_directory']} />
      <Note>
        <ExternalLink href={links.variables}>Variables for the file name and format fields</ExternalLink>
      </Note>
      <Section title="Messages">{groups(MESSAGE_LOGS)}</Section>
      <Section title="Transfers">
        {groups(TRANSFER_LOGS)}
        <Fields form={form} keys={['log_list_transfers']} />
      </Section>
    </Page>
  );
};

const restartWebServer = async () => {
  const text =
    'All sessions will be disconnected; without "Keep me logged in" you have to log in again. ' +
    'If the new settings are wrong, you may not be able to connect anymore: ' +
    'only restart when you can access the server for troubleshooting (the configuration is in the .airdc++ directory).';
  if (await confirm('Restart web server', text, 'Restart')) {
    await socket.post('system/restart_web').then(() => toast('Restarting the web server'), reportError('Restart'));
  }
};

const RestartButton = () => {
  const admin = useAccess()('admin');
  return (
    <div className="settings-actions">
      <button type="button" disabled={!admin} onClick={() => void restartWebServer()}>
        <RotateCw size={13} /> Restart web server
      </button>
    </div>
  );
};

const HTTP_KEYS = ['web_plain_port', 'web_plain_bind_address'];
const HTTPS_KEYS = [
  'web_tls_port',
  'web_tls_bind_address',
  'web_tls_certificate_path',
  'web_tls_certificate_key_path',
];

export const WebServerPage = () => {
  const form = useRemoteForm([...HTTP_KEYS, ...HTTPS_KEYS]);
  return (
    <Page form={form}>
      <RestartButton />
      <Section title="HTTP">
        <Fields form={form} keys={HTTP_KEYS} />
      </Section>
      <Section title="HTTPS">
        <Fields form={form} keys={HTTPS_KEYS} />
        <Note>The default client certificate is used if the certificate paths are empty.</Note>
      </Section>
    </Page>
  );
};

const SERVER_KEYS = ['web_server_threads', 'default_idle_timeout', 'ping_interval', 'ping_timeout'];
const HOOK_KEYS = [
  'share_file_validation_hook_timeout',
  'share_directory_validation_hook_timeout',
  'new_share_file_validation_hook_timeout',
  'new_share_directory_validation_hook_timeout',
  'outgoing_chat_message_hook_timeout',
  'incoming_chat_message_hook_timeout',
  'queue_add_bundle_hook_timeout',
  'queue_add_bundle_file_hook_timeout',
  'queue_add_source_hook_timeout',
  'queue_bundle_finished_hook_timeout',
  'queue_file_finished_hook_timeout',
  'list_menuitems_hook_timeout',
];

export const ServerAdvancedPage = () => {
  const form = useRemoteForm([...SERVER_KEYS, ...HOOK_KEYS]);
  return (
    <Page form={form}>
      <RestartButton />
      <Fields form={form} keys={SERVER_KEYS} />
      <Section title="Hook timeouts">
        <Fields form={form} keys={HOOK_KEYS} />
      </Section>
    </Page>
  );
};
