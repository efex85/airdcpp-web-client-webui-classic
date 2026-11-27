// The settings pages and who may see them
import type { Permission } from '../../lib/access';
import type { SettingsComponent } from '../../lib/settingsSearch';
import { ApplicationPage, HubStatsPage, ShareStatsPage, TransferStatsPage } from './pages/about';
import {
  DetectionPage,
  EncryptionPage,
  Ipv4Page,
  Ipv6Page,
  PortsPage,
  ProxiesPage,
} from './pages/connectivity';
import {
  DownloadOptionsPage,
  LocationsPage,
  PrioritiesPage,
  SearchMatchingPage,
  SearchTypesPage,
  SkippingPage,
} from './pages/downloads';
import { EmojiPage } from './pages/emoji';
import { CatalogPage, ExtensionEnginesPage, ExtensionOptionsPage, ExtensionsPage } from './pages/extensions';
import { ColorsPage, StartupPage, TextPage } from './pages/personal';
import { ShortcutsPage } from './pages/shortcuts';
import { TabsPage } from './pages/tabs';
import { AwayPage, IgnoredUsersPage, MiscPage, UserPage } from './pages/profile';
import {
  ExcludesPage,
  HashingPage,
  ProfilesPage,
  RefreshPage,
  SharedFoldersPage,
  SharingOptionsPage,
} from './pages/sharing';
import { DownloadLimitsPage, LimiterPage, SpeedPage, UploadLimitsPage, UserLimitsPage } from './pages/speed';
import { LoggingPage, ServerAdvancedPage, UsersPage, WebServerPage } from './pages/system';
import { AppearancePage, BrowserMiscPage, EventsPage, HistoriesPage, NotificationsPage } from './pages/view';

export interface SettingsPage {
  id: string;
  title: string;
  component: SettingsComponent;
  /** Required permission; null if everyone may see the page */
  permission: Permission | null;
  advanced: boolean;
}

export interface PageGroup {
  title: string;
  pages: SettingsPage[];
}

type Entry = [id: string, title: string, component: SettingsComponent, permission?: Permission | null];

const group = (title: string, basic: Entry[], advanced: Entry[] = []): PageGroup => {
  const page =
    (isAdvanced: boolean) =>
    ([id, pageTitle, component, permission = 'settings_view']: Entry): SettingsPage => ({
      id,
      title: pageTitle,
      component,
      permission,
      advanced: isAdvanced,
    });
  return { title, pages: [...basic.map(page(false)), ...advanced.map(page(true))] };
};

export const PAGE_GROUPS: PageGroup[] = [
  group(
    'Profile',
    [
      ['user', 'User', UserPage],
      ['away', 'Away mode', AwayPage],
    ],
    [
      ['ignored', 'Ignored users', IgnoredUsersPage],
      ['profile-misc', 'Miscellaneous', MiscPage],
    ],
  ),
  group(
    'Speed and limits',
    [
      ['speed', 'Connection speed', SpeedPage],
      ['limiter', 'Bandwidth limiting', LimiterPage],
    ],
    [
      ['download-limits', 'Download limits', DownloadLimitsPage],
      ['upload-limits', 'Upload limits', UploadLimitsPage],
      ['user-limits', 'Per-user limits', UserLimitsPage],
    ],
  ),
  group(
    'Connectivity',
    [['detection', 'Auto detection', DetectionPage]],
    [
      ['ipv4', 'IPv4 connectivity (manual)', Ipv4Page],
      ['ipv6', 'IPv6 connectivity (manual)', Ipv6Page],
      ['ports', 'Ports (manual)', PortsPage],
      ['proxies', 'Proxies', ProxiesPage],
      ['encryption', 'Encryption', EncryptionPage],
    ],
  ),
  group(
    'Downloads',
    [['locations', 'Locations', LocationsPage]],
    [
      ['skipping', 'Skipping options', SkippingPage],
      ['search-matching', 'Search matching', SearchMatchingPage],
      ['download-options', 'Download options', DownloadOptionsPage],
      ['priorities', 'Priorities', PrioritiesPage],
      ['search-types', 'Search types', SearchTypesPage],
    ],
  ),
  group(
    'Sharing',
    [
      ['share', 'Shared folders', SharedFoldersPage, 'share_view'],
      ['refresh', 'Refresh options', RefreshPage],
      ['share-profiles', 'Share profiles', ProfilesPage, 'share_view'],
    ],
    [
      ['sharing-options', 'Sharing options', SharingOptionsPage],
      ['hashing', 'Hashing', HashingPage],
      ['excludes', 'Excluded paths', ExcludesPage, 'share_view'],
    ],
  ),
  group(
    'View',
    [
      ['startup', 'Home and startup', StartupPage, null],
      ['colors', 'Colors', ColorsPage, null],
      ['tabs', 'Tab highlights', TabsPage, null],
      ['text', 'Text and chat', TextPage, null],
      ['emoji', 'Emoji', EmojiPage, null],
      ['shortcuts', 'Shortcuts', ShortcutsPage, null],
      ['notifications', 'Notifications', NotificationsPage, null],
      ['histories', 'Histories', HistoriesPage],
      ['events', 'Events', EventsPage],
      ['appearance', 'Appearance', AppearancePage],
    ],
    [['browser', 'Miscellaneous', BrowserMiscPage, null]],
  ),
  group(
    'Extensions',
    [
      ['extensions', 'Manage installed', ExtensionsPage],
      ['catalog', 'Extension catalog', CatalogPage],
    ],
    [
      ['extension-options', 'Extension options', ExtensionOptionsPage],
      ['extension-engines', 'Extension engines', ExtensionEnginesPage],
    ],
  ),
  group(
    'System',
    [
      ['users', 'Users', UsersPage, 'admin'],
      ['logging', 'Logging', LoggingPage, 'admin'],
      ['web-server', 'Web server', WebServerPage, 'admin'],
    ],
    [['server-advanced', 'Advanced server settings', ServerAdvancedPage, 'admin']],
  ),
  group('About', [
    ['about', 'Application', ApplicationPage, null],
    ['transfer-stats', 'Transfer statistics', TransferStatsPage, 'transfers'],
    ['share-stats', 'Share statistics', ShareStatsPage, 'share_view'],
    ['hub-stats', 'Hub statistics', HubStatsPage, 'hubs_view'],
  ]),
];

export const visibleGroups = (permits: (permission: Permission) => boolean): PageGroup[] =>
  PAGE_GROUPS.map((g) => ({ ...g, pages: g.pages.filter((p) => !p.permission || permits(p.permission)) })).filter(
    (g) => g.pages.length,
  );
