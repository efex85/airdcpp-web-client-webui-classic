import { useEffect, useState } from 'react';
import type { ConnectivityStatus } from '../../api/settingsTypes';
import type { OnlineUser } from '../../api/types';
import { useAccess } from '../../lib/access';
import { describeAddress, type AddressState, type Family, type HubAddress } from '../../lib/addresses';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';

const INTERVAL = 30_000;

export type Addresses = [Family, AddressState][];

/**
 * The IPv4 and IPv6 address: whether they are in use needs the permission to view the settings, the addresses seen
 * by the connected hubs the permission to view the hubs. Null until known, or without both permissions.
 */
export const useAddresses = (active: boolean): Addresses | null => {
  const access = useAccess();
  const settings = access('settings_view');
  const hubsView = access('hubs_view');
  const generation = useApp((s) => s.generation);
  const cid = useApp((s) => s.login?.system_info.cid);
  const connected = useApp((s) =>
    s.hubs
      .filter((h) => h.connect_state.id === 'connected')
      .map((h) => h.id)
      .join(),
  );
  const [addresses, setAddresses] = useState<Addresses | null>(null);

  useEffect(() => {
    if (!active || (!settings && !hubsView)) {
      return;
    }

    let current = true;
    const load = async () => {
      const connectivity = settings
        ? await Promise.all([
            socket.get<ConnectivityStatus>('connectivity/status'),
            socket.post<{ connection_mode_v4: number; connection_mode_v6: number }>('settings/get', {
              keys: ['connection_mode_v4', 'connection_mode_v6'],
            }),
          ])
        : null;
      const hubs = useApp.getState().hubs.filter((h) => hubsView && h.connect_state.id === 'connected');
      const seen = await Promise.all(
        hubs.map((hub) =>
          socket.get<OnlineUser>(`hubs/${hub.id}/users/${cid}`).then(
            (me): HubAddress => ({ hub: hub.identity.name || hub.hub_url, v4: me.ip4?.ip ?? '', v6: me.ip6?.ip ?? '' }),
            () => null,
          ),
        ),
      );
      const reported = seen.filter((a): a is HubAddress => !!a);
      if (current) {
        setAddresses(
          (['v4', 'v6'] as const).map((family) => [
            family,
            describeAddress(
              family,
              connectivity?.[0][`status_${family}`] ?? null,
              connectivity?.[1][`connection_mode_${family}`],
              reported,
            ),
          ]),
        );
      }
    };

    const run = () => void load().catch(() => undefined);
    run();
    const timer = setInterval(run, INTERVAL);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [active, settings, hubsView, generation, cid, connected]);

  return addresses;
};
