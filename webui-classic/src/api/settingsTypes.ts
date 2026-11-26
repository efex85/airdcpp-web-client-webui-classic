// Data formats used by the settings pages

export type SettingType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'text'
  | 'password'
  | 'email'
  | 'url'
  | 'file_path'
  | 'existing_file_path'
  | 'directory_path'
  | 'list'
  | 'struct'
  | 'hub_url'
  | 'hinted_user';

export type OptionId = string | number | boolean | null;

/** Describes a setting; also used by this UI for its own forms */
export interface SettingDefinition {
  key: string;
  title: string;
  type: SettingType;
  default_value?: unknown;
  help?: string;
  optional?: boolean;
  options?: { id: OptionId; name: string }[];
  min?: number;
  max?: number;
  /** Type of the list items */
  item_type?: SettingType;
  /** Fields of the list items when item_type is 'struct' */
  definitions?: SettingDefinition[];
}

export type SettingValues = Record<string, unknown>;

export interface ShareProfile {
  id: number;
  name: string;
  str: string;
  default: boolean;
  files: number;
  size: number;
}

export interface ShareRoot {
  id: string;
  path: string;
  virtual_name: string;
  profiles: { id: number; str: string }[];
  incoming: boolean;
  size: number;
  type: { str: string; files: number; directories: number };
  last_refresh_time: number;
  status: { id: string; str: string; refresh_task_id: number | null };
}

export interface FavoriteDirectory {
  id: string;
  name: string;
  path: string;
}

export interface SearchType {
  id: string;
  name: string;
  str: string;
  extensions: string[];
  default_type: boolean;
}

export interface IgnoredUser {
  user: { cid: string; nicks: string; hub_names?: string; hub_url: string; flags: string[] };
  ignored_messages: number;
}

export interface WebUser {
  id: number;
  username: string;
  permissions: string[];
  active_sessions: number;
  last_login: number;
}

export interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  homepage: string;
  running: boolean;
  managed: boolean;
  has_settings: boolean;
  private: boolean;
  disabled: boolean;
}

export interface ConnectivityProtocolStatus {
  auto_detect: boolean;
  enabled: boolean;
  text: string;
  bind_address: string;
  external_ip: string;
}

export interface ConnectivityStatus {
  status_v4: ConnectivityProtocolStatus;
  status_v6: ConnectivityProtocolStatus;
  tcp_port: string;
  tls_port: string;
  udp_port: string;
}

export interface HashStats {
  hash_speed: number;
  hash_bytes_left: number;
  hash_files_left: number;
  hash_bytes_added: number;
  hash_files_added: number;
  hashers: number;
  pause_forced: boolean;
  max_hash_speed: number;
}

export interface HashDatabaseStatus {
  maintenance_running: boolean;
  file_index_size: number;
  hash_store_size: number;
}
