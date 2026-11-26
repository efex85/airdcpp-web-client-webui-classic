// What can happen in a hub or private chat while its window isn't shown, and how its tab is marked then

import type { MessageCounts } from '../api/types';

export type TabEventId =
  | 'hub_mention'
  | 'hub_message'
  | 'hub_bot'
  | 'hub_status'
  | 'hub_join'
  | 'pm'
  | 'pm_bot'
  | 'pm_status';

export type ChatPlace = 'hub' | 'pm';

type Unread = MessageCounts['unread'];

export interface TabEvent {
  id: TabEventId;
  place: ChatPlace;
  label: string;
  help?: string;
  /** The names of its colors: "<colors>_bg" and "<colors>_text" */
  colors: string;
  /** The colors that are used for those that haven't been set */
  fallback?: TabEventId;
  /** Mentions and private messages also mark the menu on phones and the title of the page */
  level: 'mention' | 'unread';
  defaultOn: boolean;
  /** How many unread messages of this kind there are */
  count: (unread: Unread) => number;
}

/** The first one that has happened (and is marked) counts */
export const TAB_EVENTS: TabEvent[] = [
  {
    id: 'hub_mention',
    place: 'hub',
    label: 'My nick is mentioned',
    help: 'These colors are also used for errors and warnings in the system log.',
    colors: 'tab_mention',
    level: 'mention',
    defaultOn: true,
    count: (u) => u.mention ?? 0,
  },
  {
    id: 'hub_message',
    place: 'hub',
    label: 'Someone writes',
    help: 'These colors are also used for the system log, file lists and viewed files.',
    colors: 'tab_unread',
    level: 'unread',
    defaultOn: true,
    count: (u) => u.user ?? 0,
  },
  {
    id: 'hub_bot',
    place: 'hub',
    label: 'A bot writes',
    colors: 'tab_bot',
    fallback: 'hub_message',
    level: 'unread',
    defaultOn: true,
    count: (u) => u.bot ?? 0,
  },
  {
    id: 'hub_status',
    place: 'hub',
    label: 'Status message',
    help: 'Such as a lost connection or a message from the client about the hub.',
    colors: 'tab_status',
    fallback: 'hub_message',
    level: 'unread',
    defaultOn: false,
    count: (u) => u.status ?? 0,
  },
  {
    id: 'hub_join',
    place: 'hub',
    label: 'Joins, parts and other detail messages',
    help: 'Joins and parts only count when the hub shows them in the chat.',
    colors: 'tab_join',
    fallback: 'hub_message',
    level: 'unread',
    defaultOn: false,
    count: (u) => u.verbose ?? 0,
  },
  {
    id: 'pm',
    place: 'pm',
    label: 'Someone writes',
    colors: 'tab_pm',
    fallback: 'hub_mention',
    level: 'mention',
    defaultOn: true,
    count: (u) => u.user ?? 0,
  },
  {
    id: 'pm_bot',
    place: 'pm',
    label: 'A bot writes',
    colors: 'tab_pm_bot',
    fallback: 'pm',
    level: 'mention',
    defaultOn: true,
    count: (u) => u.bot ?? 0,
  },
  {
    id: 'pm_status',
    place: 'pm',
    label: 'Status message',
    colors: 'tab_pm_status',
    fallback: 'hub_message',
    level: 'unread',
    defaultOn: true,
    count: (u) => (u.status ?? 0) + (u.verbose ?? 0),
  },
];

export const tabEvent = (id: TabEventId): TabEvent => TAB_EVENTS.find((e) => e.id === id)!;

/** The choices that differ from the defaults */
export type TabHighlights = Partial<Record<TabEventId, boolean>>;

export const isMarked = (highlight: TabHighlights, id: TabEventId): boolean => highlight[id] ?? tabEvent(id).defaultOn;

export const currentTabEvent = (
  place: ChatPlace,
  unread: Unread | undefined,
  highlight: TabHighlights,
): TabEvent | null =>
  (unread && TAB_EVENTS.find((e) => e.place === place && isMarked(highlight, e.id) && e.count(unread) > 0)) || null;

/** The event and those whose colors it uses for what hasn't been set */
export const colorChain = (id: TabEventId): TabEvent[] => {
  const event = tabEvent(id);
  return [event, ...(event.fallback ? colorChain(event.fallback) : [])];
};

const cssName = (colors: string, part: 'bg' | 'text') => `--${colors.replaceAll('_', '-')}-${part}`;

const variableChain = (id: TabEventId, part: 'bg' | 'text', last: string): string =>
  colorChain(id).reduceRight((rest, e) => `var(${cssName(e.colors, part)}${rest && `, ${rest}`})`, last);

/** The variables that the style sheet uses for a marked tab */
export const tabEventStyle = (id: TabEventId): Record<string, string> => ({
  '--event-bg': variableChain(id, 'bg', ''),
  '--event-text': variableChain(id, 'text', 'var(--text)'),
  '--event-weight': `var(${cssName(tabEvent(id).colors, 'bg')}-weight, 400)`,
});
