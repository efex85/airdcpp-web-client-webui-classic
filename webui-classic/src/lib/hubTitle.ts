// The title of a hub window, written as the Windows client writes it: "[S] Name - Topic (address)"

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

export const hubCaption = (hub: HubSession): string => {
  // Encrypted, with a certificate that is [S]ecure or [U]ntrusted
  const security = !hub.encryption ? '' : hub.encryption.trusted ? '[S] ' : '[U] ';
  const topic = hubTopic(hub);
  return `${security}${hub.identity.name || hub.hub_url}${topic ? ` - ${topic}` : ''} (${hub.hub_url})`;
};
