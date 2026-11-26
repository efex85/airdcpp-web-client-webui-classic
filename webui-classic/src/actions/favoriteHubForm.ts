// The properties of a favorite hub
import type { SettingDefinition, SettingValues, ShareProfile } from '../api/settingsTypes';
import type { FavoriteHub } from '../api/types';
import type { FormOptions } from '../components/forms/FormDialog';
import { socket } from '../store/session';

const HIDDEN_PROFILE = 1;

const isAdcAddress = (url: unknown) => /^adcs?:\/\//i.test(String(url ?? '').trim());

const CONNECTION_MODES = [
  { id: null, name: 'Global default' },
  { id: -1, name: 'Disabled' },
  { id: 0, name: 'Active mode' },
  { id: 2, name: 'Passive mode' },
];

const TRISTATE = [
  { id: null, name: 'Global default' },
  { id: true, name: 'Yes' },
  { id: false, name: 'No' },
];

const text = (key: string, title: string, optional = true): SettingDefinition => ({
  key,
  title,
  type: 'string',
  optional,
});

export const favoriteHubFields = (
  profiles: ShareProfile[],
  values: SettingValues,
  hasPassword: boolean,
): SettingDefinition[] => [
  text('name', 'Name', false),
  { key: 'hub_url', title: 'Address', type: 'string', help: 'E.g. adcs://hub.example.org:1511' },
  text('hub_description', 'Description'),
  {
    key: 'share_profile',
    title: 'Share profile',
    type: 'number',
    // Other profiles than hiding the share can only be chosen for ADC hubs
    options: [
      { id: null, name: 'Global default' },
      ...profiles
        .filter((p) => isAdcAddress(values.hub_url) || p.id === HIDDEN_PROFILE)
        .map((p) => ({ id: p.id, name: p.str })),
    ],
    help: isAdcAddress(values.hub_url)
      ? undefined
      : 'Custom share profiles can be selected after entering the address of an ADC hub',
  },
  { key: 'auto_connect', title: 'Connect automatically', type: 'boolean' },
  { key: 'password', title: hasPassword ? 'New password' : 'Password', type: 'password', optional: true },
  ...(hasPassword ? [{ key: 'remove_password', title: 'Remove the password', type: 'boolean' } as const] : []),
  text('nick', 'Nick'),
  text('user_description', 'User description'),
  { key: 'connection_mode_v4', title: 'Connectivity (IPv4)', type: 'number', options: CONNECTION_MODES },
  text('connection_ip_v4', 'External IP (IPv4)'),
  { key: 'connection_mode_v6', title: 'Connectivity (IPv6)', type: 'number', options: CONNECTION_MODES },
  text('connection_ip_v6', 'External IP (IPv6)'),
  { key: 'use_main_chat_notify', title: 'Chat notifications', type: 'boolean', options: TRISTATE },
  { key: 'show_joins', title: 'Show joins/parts', type: 'boolean', options: TRISTATE },
  { key: 'away_message', title: 'Away message', type: 'text', optional: true },
];

/** The password fields of the form as the API expects them */
export const favoriteHubData = (values: SettingValues): SettingValues => {
  const { password, remove_password, ...data } = values;
  return remove_password ? { ...data, password: '' } : password ? { ...data, password } : data;
};

export const favoriteHubForm = (profiles: ShareProfile[], hub?: FavoriteHub): FormOptions => ({
  title: hub ? 'Favorite hub properties' : 'New favorite hub',
  confirmLabel: hub ? 'Save' : 'Add',
  definitions: (values) => favoriteHubFields(profiles, values, !!hub?.has_password),
  saved: hub && {
    ...hub,
    share_profile: hub.share_profile?.id ?? null,
    password: '',
    remove_password: false,
  },
  initial: { auto_connect: true },
  onChange: (key, values) =>
    key === 'hub_url' && !isAdcAddress(values.hub_url) && values.share_profile !== HIDDEN_PROFILE
      ? { share_profile: null }
      : undefined,
  save: (values) => {
    const data = favoriteHubData(values);
    return hub ? socket.patch(`favorite_hubs/${hub.id}`, data) : socket.post('favorite_hubs', data);
  },
});
