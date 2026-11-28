import { describe, expect, it } from 'vitest';
import type { HubSession } from '../src/api/types';
import { hubCaption, hubTooltip, hubTopic } from '../src/lib/hubTitle';

let ids = 0;
const hub = (changes: Partial<HubSession> = {}, description = 'Welcome'): HubSession => ({
  id: ++ids,
  identity: { name: 'Hub', description },
  connect_state: { id: 'connected', str: 'Connected' },
  hub_url: 'adcs://hub.example:411',
  favorite_hub: 0,
  message_counts: { total: 0, unread: {} },
  encryption: { str: 'TLS', trusted: true },
  ...changes,
});

describe('the title of a hub window', () => {
  it('has the program, the name and the topic', () => {
    expect(hubCaption(hub())).toBe('AirDC++ | Hub | Welcome');
    // Neither the encryption nor the address is a part of it
    expect(hubCaption(hub({ encryption: null, hub_url: 'adc://hub.example:411' }))).toBe('AirDC++ | Hub | Welcome');
  });

  it('leaves out a topic that the hub has not got', () => {
    expect(hubCaption(hub({}, ''))).toBe('AirDC++ | Hub');
  });

  it('uses the address for a hub without a name', () => {
    expect(hubCaption(hub({ identity: { name: '', description: '' } }))).toBe('AirDC++ | adcs://hub.example:411');
  });

  it('has the address, the state and the topic in the text of the tab', () => {
    expect(hubTooltip(hub())).toBe('adcs://hub.example:411: Connected\nTopic: Welcome');
    expect(hubTooltip(hub({}, ''))).toBe('adcs://hub.example:411: Connected');
  });

  it('keeps the last topic while the hub is offline', () => {
    const online = hub();
    expect(hubTopic(online)).toBe('Welcome');
    const offline: HubSession = {
      ...online,
      identity: { name: 'Hub', description: '' },
      connect_state: { id: 'disconnected', str: 'Disconnected' },
      encryption: null,
    };
    expect(hubCaption(offline)).toBe('AirDC++ | Hub | Welcome');
    expect(hubTooltip(offline)).toBe('adcs://hub.example:411: Disconnected\nTopic: Welcome');
    // Connected again: the hub has removed its topic
    expect(hubTopic({ ...online, identity: { name: 'Hub', description: '' } })).toBe('');
    // A hub that never had one
    expect(hubTopic(hub({ connect_state: { id: 'disconnected', str: '' } }, ''))).toBe('');
  });
});
