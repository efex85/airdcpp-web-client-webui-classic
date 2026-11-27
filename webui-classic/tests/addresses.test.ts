import { describe, expect, it } from 'vitest';
import { describeAddress, type HubAddress } from '../src/lib/addresses';

const status = (changes: object = {}) => ({
  auto_detect: true,
  enabled: true,
  text: 'Status text',
  bind_address: 'undefined',
  external_ip: 'undefined',
  ...changes,
});

const hub = (name: string, v4 = '', v6 = ''): HubAddress => ({ hub: name, v4, v6 });

const ips = (state: ReturnType<typeof describeAddress>) => state.addresses?.map((a) => a.ip);

describe('IP addresses', () => {
  it('says that a protocol is switched off, also when a hub still reports an address', () => {
    const state = describeAddress('v6', status({ enabled: false }), -1, [hub('One', '', '2001:db8::1')]);
    expect(state).toMatchObject({ addresses: null, text: 'Disabled' });
  });

  it('says that the automatic detection switched a protocol off', () => {
    const state = describeAddress('v6', status({ text: 'No public IPv6 address' }), -1, []);
    expect(state).toEqual({ addresses: null, text: 'Disabled by auto detection', detail: 'No public IPv6 address' });
  });

  it('shows the address that the hubs report, once, with the hubs that report it', () => {
    const hubs = [hub('One', '203.0.113.5'), hub('Two', '203.0.113.5'), hub('Three')];
    expect(describeAddress('v4', status({ external_ip: '192.0.2.1' }), 1, hubs)).toEqual({
      addresses: [{ ip: '203.0.113.5', detail: 'Reported by One, Two' }],
    });
  });

  it('shows each different address', () => {
    const hubs = [hub('One', '203.0.113.5'), hub('Lan', '10.0.0.2')];
    expect(ips(describeAddress('v4', status(), 1, hubs))).toEqual(['203.0.113.5', '10.0.0.2']);
  });

  it('keeps the two protocols apart', () => {
    const hubs = [hub('One', '203.0.113.5', '2001:db8::1')];
    expect(ips(describeAddress('v6', status(), 1, hubs))).toEqual(['2001:db8::1']);
  });

  it('falls back to the external address of the client', () => {
    const hubs = [hub('One', '0.0.0.0', '::')];
    expect(ips(describeAddress('v4', status({ external_ip: '192.0.2.1' }), 1, hubs))).toEqual(['192.0.2.1']);
  });

  it('says that an address is not known', () => {
    for (const external_ip of ['', 'undefined', '0.0.0.0']) {
      expect(describeAddress('v4', status({ external_ip }), 1, [])).toMatchObject({
        addresses: null,
        text: 'Not known',
      });
    }
  });

  it('works without the permission to view the settings', () => {
    expect(ips(describeAddress('v4', null, undefined, [hub('One', '203.0.113.5')]))).toEqual(['203.0.113.5']);
    expect(describeAddress('v6', null, undefined, [])).toMatchObject({ addresses: null, text: 'Not known' });
  });
});
