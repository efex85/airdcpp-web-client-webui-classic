// The title of a hub window, "AirDC++ | Name | Topic", and the text shown when hovering over its tab

import type { HubSession } from '../api/types';

/** The last topic of each hub, which is still shown while the hub is offline */
const topics = new Map<number, string>();

export const hubTopic = (hub: HubSession): string => {
  const { description } = hub.identity;
  if (description) {
    topics.set(hub.id, description);
    return description;
  }

  return hub.connect_state.id === 'connected' ? '' : (topics.get(hub.id) ?? '');
};

/** The title bar; a hub without a name is shown by its address */
export const hubCaption = (hub: HubSession): string =>
  ['AirDC++', hub.identity.name || hub.hub_url, hubTopic(hub)].filter(Boolean).join(' | ');

export const hubTooltip = (hub: HubSession): string => {
  const state = `${hub.hub_url}: ${hub.connect_state.str}`;
  const topic = hubTopic(hub);
  return topic ? `${state}\nTopic: ${topic}` : state;
};
