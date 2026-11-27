import { useApp } from '../../../store/app';
import { setIgnored, openPrivateChat, browseUser } from '../../../actions';
import type { IgnoredUser } from '../../../api/settingsTypes';
import { withSearch } from '../../../lib/settingsSearch';
import { ExternalLink, links, LoadError, SimpleList, useApiData } from '../data';
import { Fields, Note, Page, useRemoteForm } from '../form';
import { settingsPage } from './common';

const PROFILE_HELP: Record<number, string> = {
  0: 'The client is used in normal private/public hubs for transferring files via internet. Use this profile if unsure.',
  1: 'The client is used for transferring files that are split in RAR archives (or in other small-sized formats).',
  2: 'The client is used for transferring files in a local network (e.g. LAN parties) or in another closed network (e.g. university network).',
};

const USER_KEYS = ['nick', 'description', 'email', 'setting_profile', 'language_file'];

const User = () => {
  const form = useRemoteForm(USER_KEYS);
  return (
    <Page form={form}>
      <Fields
        form={form}
        keys={USER_KEYS}
        help={{
          setting_profile: PROFILE_HELP[form.values.setting_profile as number],
          language_file: 'The application must be restarted for the new language to take effect.',
        }}
      />
      <Note>
        To improve the translations or to translate the application into a new language, see the{' '}
        <ExternalLink href={links.translations}>instructions for translators</ExternalLink>.
      </Note>
    </Page>
  );
};

export const UserPage = withSearch(User, { keys: USER_KEYS });

const AWAY_KEYS = ['away_message', 'away_no_bots', 'away_idle_time'];

export const AwayPage = settingsPage(AWAY_KEYS);

const IgnoredUsers = () => {
  const { data, error } = useApiData<IgnoredUser[]>('users/ignores', [
    'users/ignored_user_added',
    'users/ignored_user_removed',
  ]);

  return (
    <Page>
      <LoadError error={error} />
      <SimpleList
        label="Ignored users"
        items={data}
        rowKey={(i) => i.user.cid}
        columns={[
          { title: 'User', render: (i) => i.user.nicks },
          { title: 'Hubs', render: (i) => i.user.hub_names, secondary: true },
          { title: 'Messages ignored', render: (i) => i.ignored_messages, align: 'right' },
        ]}
        actions={({ user }) => [
          { label: 'Stop ignoring', onClick: () => void setIgnored(user, false) },
          {
            label: 'Get file list',
            disabled: user.flags.includes('offline'),
            onClick: () => void browseUser(user),
          },
          {
            label: 'Send private message',
            disabled: user.flags.includes('offline'),
            onClick: () => void openPrivateChat(user),
          },
        ]}
        empty="No ignored users"
      />
    </Page>
  );
};

export const IgnoredUsersPage = withSearch(IgnoredUsers, { words: 'stop ignoring' });

const MISC_KEYS = ['auto_follow_redirects', 'disconnect_offline_users', 'disconnect_hubs_noreg', 'min_search_interval'];

/** The system encoding is used for NMDC hubs on Windows; elsewhere it can be chosen */
const miscKeys = (windows: boolean) => [...MISC_KEYS, ...(windows ? [] : ['nmdc_encoding'])];

const Misc = () => {
  const windows = useApp((s) => s.login?.system_info.platform === 'windows');
  const keys = miscKeys(windows);
  const form = useRemoteForm(keys);
  return (
    <Page form={form}>
      <Fields
        form={form}
        keys={keys}
        help={{
          nmdc_encoding:
            'Only used in NMDC hubs; ADC hubs always use UTF-8. Commonly used values: cp1250 (Central Europe), ' +
            'cp1251 (Cyrillic), cp1252 (Western Europe), cp1253 (Greek), cp1254 (Turkish), cp1256 (Hebrew).',
        }}
      />
    </Page>
  );
};

export const MiscPage = withSearch(Misc, {
  keys: () => miscKeys(useApp.getState().login?.system_info.platform === 'windows'),
});
