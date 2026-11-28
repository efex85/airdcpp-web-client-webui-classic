// Data formats of the AirDC++ Web API (the fields this UI uses)

export type Id = number | string;

export interface LoginResponse {
  session_id: number;
  auth_token: string;
  refresh_token?: string;
  token_type?: string;
  user: { id: number; username: string; permissions: string[] };
  system_info: {
    client_version: string;
    hostname: string;
    cid: string;
    path_separator: string;
    platform: string;
    api_version: number;
    api_feature_level: number;
    client_started: number;
    /** Added by daemon-system-uptime.patch; 0 if unknown */
    system_started?: number;
  };
}

export interface HintedUser {
  cid: string;
  nicks: string;
  hub_url: string;
  hub_names?: string;
  flags: string[];
}

export interface OnlineUser {
  id: number;
  nick: string;
  cid: string;
  share_size: number;
  description: string;
  tag: string;
  upload_speed: number;
  download_speed: number;
  ip4: { str: string; ip: string } | null;
  ip6: { str: string; ip: string } | null;
  email: string;
  file_count: number;
  hub_session_id: number;
  hub_url: string;
  hub_name: string;
  flags: string[];
  upload_slots: number;
}

export interface Highlight {
  id: number;
  text: string;
  type: 'bold' | 'user' | 'link_url' | 'link_text';
  tag: string;
  position: { start: number; end: number }; // UTF-8 byte offsets
  dupe: Dupe | null;
  /** Of magnet links */
  content_type?: string | null;
}

export interface ChatMessage {
  id: number;
  text: string;
  from: OnlineUser;
  to?: OnlineUser;
  reply_to?: OnlineUser;
  time: number;
  is_read: boolean;
  third_person: boolean;
  highlights: Highlight[];
  has_mention: boolean;
}

export type Severity = 'notify' | 'verbose' | 'info' | 'warning' | 'error';

export interface LogMessage {
  id: number;
  text: string;
  time: number;
  severity: Severity;
  label: string;
  is_read: boolean;
  highlights: Highlight[];
  type: string;
}

export interface MessageWrapper {
  chat_message?: ChatMessage;
  log_message?: LogMessage;
}

export interface MessageCounts {
  total: number;
  unread: { mention?: number; user?: number; bot?: number; status?: number; verbose?: number };
}

export interface ConnectState {
  id: 'connected' | 'connecting' | 'disconnected' | 'password' | 'redirect' | 'keyprint_mismatch';
  str: string;
  data?: { hub_url: string };
}

export interface HubSession {
  id: number;
  identity: { name: string; description: string };
  connect_state: ConnectState;
  hub_url: string;
  favorite_hub: number;
  message_counts: MessageCounts;
  encryption: { str: string; trusted: boolean } | null;
  /** Effective settings of the hub */
  settings?: { use_main_chat_notify: boolean; show_joins: boolean };
}

export interface PrivateChatSession {
  id: string;
  user: HintedUser;
  ccpm_state: { id: string; str: string; encryption: { str: string; trusted: boolean } | null };
  message_counts: MessageCounts;
}

export interface Dupe {
  id: string;
  paths: string[];
}

export type ItemType =
  | { id: 'file'; content_type: string; str: string }
  | { id: 'directory'; str: string; files?: number; directories?: number };

export interface FilelistItem {
  id: number;
  name: string;
  type: ItemType;
  size: number;
  time: number;
  path: string;
  tth: string;
  dupe: Dupe | null;
  complete: boolean;
  /** Result folders of ADL Search and what they hold; the path is that of the matched item, '' for result folders */
  adl?: { path: string } | null;
}

export type AdlSourceType = 'file' | 'directory' | 'full_path';
export type AdlSizeUnit = 'B' | 'KiB' | 'MiB' | 'GiB';

export interface AdlSearch {
  pattern: string;
  regex: boolean;
  source_type: AdlSourceType;
  destination: string;
  /** -1 for no limit */
  min_size: number;
  max_size: number;
  size_unit: AdlSizeUnit;
  comment: string;
  active: boolean;
  /** Matching files are added to the queue */
  download: boolean;
}

export interface AdlState {
  revision: number;
  searches: AdlSearch[];
  settings: { match_full_lists: boolean; break_on_first: boolean };
}

export interface FilelistSession {
  id: string;
  user: HintedUser;
  state: { id: string; str: string };
  location: FilelistItem | null;
  partial_list: boolean;
  total_files: number;
  total_size: number;
  read: boolean;
  share_profile: { id: number; str: string } | null;
}

/** A file opened for viewing */
export interface ViewFile {
  /** Same as the TTH */
  id: string;
  tth: string;
  name: string;
  /** Opened as text */
  text: boolean;
  read: boolean;
  type: ItemType;
  mime_type: string;
  content_ready: boolean;
  time_opened: number;
  /** Not set for files of the own share */
  download_state: { id: string; str: string } | null;
}

export interface Transfer {
  id: number;
  name: string;
  target: string;
  type: ItemType | null;
  download: boolean;
  size: number;
  status: { id: 'waiting' | 'finished' | 'running' | 'failed'; str: string };
  bytes_transferred: number;
  user: HintedUser;
  time_started: number;
  speed: number;
  seconds_left: number;
  ip: { str: string; ip: string; country: string };
  flags: string[];
  encryption: { str: string; trusted: boolean } | null;
  queue_file_id: number | null;
}

export interface Priority {
  id: number;
  str: string;
  auto: boolean;
}

export interface QueueBundle {
  id: number;
  name: string;
  target: string;
  type: ItemType;
  size: number;
  status: {
    id: string;
    failed: boolean;
    downloaded: boolean;
    completed: boolean;
    str: string;
    hook_error?: { hook_name: string; str: string } | null;
  };
  downloaded_bytes: number;
  priority: Priority;
  time_added: number;
  time_finished: number;
  speed: number;
  seconds_left: number;
  sources: { online: number; total: number; str: string };
}

export interface QueueFile extends QueueBundle {
  bundle: number;
  tth: string;
}

export interface SearchResult {
  id: string;
  name: string;
  relevance: number;
  hits: number;
  users: { count: number; user: HintedUser };
  type: ItemType;
  size: number;
  time: number;
  path: string;
  connection: number;
  slots: { str: string; free: number; total: number };
  tth: string;
  dupe: Dupe | null;
}

export interface UserSearchResult {
  id: number;
  name: string;
  type: ItemType;
  tth: string;
  path: string;
  size: number;
  user: HintedUser;
  connection: number;
  slots: { str: string; free: number; total: number };
  ip: { str: string };
  time: number;
}

export interface FavoriteHub {
  id: number;
  name: string;
  hub_url: string;
  hub_description: string;
  auto_connect: boolean;
  nick: string;
  has_password: boolean;
  user_description: string;
  connect_state: { id: string | number; str: string; current_hub_id: number };
  share_profile: { id: number | null; str: string };
  connection_mode_v4: number | null;
  connection_mode_v6: number | null;
  connection_ip_v4: string;
  connection_ip_v6: string;
  /** null = the global setting */
  use_main_chat_notify: boolean | null;
  show_joins: boolean | null;
  away_message: string;
}

export interface TransferStats {
  speed_down: number;
  speed_up: number;
  limit_down: number;
  limit_up: number;
  download_bundles: number;
  uploads: number;
  downloads: number;
  queued_bytes: number;
  session_downloaded: number;
  session_uploaded: number;
}

export interface MenuItem {
  id: string;
  title: string;
  hook_id: string;
  urls: string[];
  form_definitions: FormDefinition[] | null;
  children: MenuItem[] | null;
}

export interface MenuGroup {
  id: string;
  title: string;
  items: MenuItem[];
}

export interface FormDefinition {
  key: string;
  title: string;
  type: string;
  default_value?: unknown;
  optional?: boolean;
  help?: string;
  options?: { id: unknown; name: string }[];
}
