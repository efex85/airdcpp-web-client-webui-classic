// The IP addresses of the client, as shown by the System information widget
import type { ConnectivityProtocolStatus } from '../api/settingsTypes';

export type Family = 'v4' | 'v6';

/** What the client knows about itself on one connected hub */
export interface HubAddress {
  hub: string;
  v4: string;
  v6: string;
}

export type AddressState =
  | { addresses: { ip: string; detail: string }[] }
  | { addresses: null; text: string; detail: string };

const NONE = ['', 'undefined', '0.0.0.0', '::'];

/**
 * @param status null without the permission to view the settings ("enabled" is false when the protocol is switched
 * off in the settings, "external_ip" is "undefined" when the client has none)
 * @param mode the connection mode in use, -1 for disabled (with automatic detection it can differ from the setting)
 */
export const describeAddress = (
  family: Family,
  status: ConnectivityProtocolStatus | null,
  mode: number | undefined,
  hubs: HubAddress[],
): AddressState => {
  if (status && !status.enabled) {
    return { addresses: null, text: 'Disabled', detail: 'Switched off in the connectivity settings' };
  }

  if (status && mode === -1) {
    return { addresses: null, text: 'Disabled by auto detection', detail: status.text };
  }

  // The address that a hub reports is the one that others see
  const found = new Map<string, string[]>();
  for (const hub of hubs) {
    if (!NONE.includes(hub[family])) {
      found.set(hub[family], [...(found.get(hub[family]) ?? []), hub.hub]);
    }
  }

  if (found.size) {
    return {
      addresses: [...found].map(([ip, names]) => ({ ip, detail: `Reported by ${names.join(', ')}` })),
    };
  }

  if (status && !NONE.includes(status.external_ip)) {
    return { addresses: [{ ip: status.external_ip, detail: 'The external address that the client uses' }] };
  }

  return { addresses: null, text: 'Not known', detail: 'It is shown when a connected hub reports it' };
};
