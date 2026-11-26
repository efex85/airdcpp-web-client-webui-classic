import { useEffect, useState } from 'react';
import type { ConnectivityStatus, ConnectivityProtocolStatus, SettingValues } from '../../../api/settingsTypes';
import { useAccess } from '../../../lib/access';
import { reportError, useApp } from '../../../store/app';
import { socket } from '../../../store/session';
import { ExternalLink, Facts, links, LoadError, useApiData } from '../data';
import { Fields, Note, Page, Section, useRemoteForm } from '../form';

const statusText = (status: ConnectivityProtocolStatus, running: boolean) =>
  running ? 'Detecting…' : `${status.text} (${status.auto_detect ? 'auto detected' : 'manual configuration'})`;

export const DetectionPage = () => {
  const { data, error, reload } = useApiData<ConnectivityStatus>('connectivity/status');
  const generation = useApp((s) => s.generation);
  const canEdit = useAccess()('settings_edit');
  const [running, setRunning] = useState({ v4: false, v6: false });
  const [details, setDetails] = useState(false);

  useEffect(() => {
    let active = true;
    const removers: (() => void)[] = [];
    const listen = (event: string, isRunning: boolean) =>
      socket
        .listen('connectivity', event, (e: { v6: boolean }) => {
          setRunning((r) => ({ ...r, [e.v6 ? 'v6' : 'v4']: isRunning }));
          if (!isRunning) {
            void reload();
          }
        })
        .then(
          (remove) => (active ? removers.push(remove) : remove()),
          () => undefined,
        );

    void listen('connectivity_detection_started', true);
    void listen('connectivity_detection_finished', false);
    return () => {
      active = false;
      removers.forEach((remove) => remove());
    };
  }, [generation, reload]);

  return (
    <Page>
      <Section title="Current auto detection status">
        <LoadError error={error} />
        {data && (
          <>
            <Facts
              rows={[
                ['IPv4 connectivity', statusText(data.status_v4, running.v4)],
                ['IPv6 connectivity', statusText(data.status_v6, running.v6)],
                ...(details
                  ? ([
                      ['Bound interface (IPv4)', data.status_v4.bind_address],
                      ['Bound interface (IPv6)', data.status_v6.bind_address],
                      ['Transfer port', data.tcp_port],
                      ['Encrypted transfer port', data.tls_port],
                      ['Search/UDP port', data.udp_port],
                    ] as [string, string][])
                  : []),
              ]}
            />
            <div className="settings-actions">
              <button
                type="button"
                disabled={
                  !canEdit ||
                  running.v4 ||
                  running.v6 ||
                  (!data.status_v4.auto_detect && !data.status_v6.auto_detect)
                }
                onClick={() => socket.post('connectivity/detect').catch(reportError('Detect'))}
              >
                Detect now
              </button>
              <button type="button" aria-pressed={details} onClick={() => setDetails(!details)}>
                {details ? 'Hide details' : 'View all'}
              </button>
            </div>
          </>
        )}
      </Section>
      <Note>
        In case of file transfer connectivity issues, please confirm that your TCP ports are really open by using{' '}
        <ExternalLink href={links.portCheck}>an online port checker</ExternalLink>. Note that the validity of the UDP port
        (search) can't be checked online. For more information about the different connectivity modes, please visit{' '}
        <ExternalLink href={links.connectivityFaq}>DC++'s connectivity FAQ</ExternalLink>.
      </Note>
    </Page>
  );
};

const MODE_DISABLED = -1;

/** The manual settings of one IP protocol */
const ProtocolPage = ({ version }: { version: 'v4' | 'v6' }) => {
  const key = (name: string) => `${name}_${version}`;
  const keys = [
    'connection_auto',
    'connection_bind',
    'connection_mode',
    'connection_ip',
    'connection_update_ip',
    'connection_ip_override',
  ].map(key);

  const disabled = (name: string, values: SettingValues) => {
    const enabled = values[key('connection_mode')] !== MODE_DISABLED;
    const auto = !!values[key('connection_auto')];
    if (name === key('connection_auto')) {
      return !enabled;
    }

    if (name === key('connection_mode')) {
      return auto && enabled;
    }

    return !enabled || auto;
  };

  const form = useRemoteForm(keys, { manual: true, disabled });
  return (
    <Page form={form}>
      {!!form.saved?.[key('connection_auto')] && (
        <Note>
          Connectivity auto detection is currently enabled; the setting values listed on this page are not being used.
        </Note>
      )}
      <Fields form={form} keys={keys} />
    </Page>
  );
};

export const Ipv4Page = () => <ProtocolPage version="v4" />;
export const Ipv6Page = () => <ProtocolPage version="v6" />;

const PORT_KEYS = ['tcp_port', 'udp_port', 'tls_port', 'preferred_port_mapper'];

export const PortsPage = () => {
  const form = useRemoteForm(PORT_KEYS, { manual: true });
  return (
    <Page form={form}>
      <Note>Port numbers listed on this page can be overridden by port mappers (if enabled).</Note>
      <Fields
        form={form}
        keys={PORT_KEYS}
        help={{
          tcp_port: 'The TCP port is used for unencrypted transfers',
          udp_port: 'The UDP port is used for searching',
          tls_port: 'The TLS port (TCP) is used for encrypted transfers',
        }}
      />
    </Page>
  );
};

const SOCKS5 = 1;
const PROXY_KEYS = [
  'outgoing_mode',
  'socks_server',
  'socks_port',
  'socks_resolve',
  'socks_user',
  'socks_password',
  'http_proxy',
];

export const ProxiesPage = () => {
  const form = useRemoteForm(PROXY_KEYS, {
    disabled: (name, values) => name.startsWith('socks_') && values.outgoing_mode !== SOCKS5,
  });
  return (
    <Page form={form}>
      <Fields form={form} keys={PROXY_KEYS} />
    </Page>
  );
};

const ENCRYPTION_KEYS = ['always_ccpm', 'tls_mode', 'tls_allow_untrusted_clients', 'tls_allow_untrusted_hubs'];

export const EncryptionPage = () => {
  const form = useRemoteForm(ENCRYPTION_KEYS);
  return (
    <Page form={form}>
      <Fields form={form} keys={ENCRYPTION_KEYS} />
    </Page>
  );
};
