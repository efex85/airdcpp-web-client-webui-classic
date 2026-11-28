import { describe, expect, it } from 'vitest';
import type { HubSession } from '../src/api/types';
import { hubCaption, hubTopic } from '../src/lib/hubTitle';

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
  it('has the security, the name, the topic and the address', () => {
    expect(hubCaption(hub())).toBe('[S] Hub - Welcome (adcs://hub.example:411)');
    expect(hubCaption(hub({ encryption: { str: 'TLS', trusted: false } }))).toBe(
      '[U] Hub - Welcome (adcs://hub.example:411)',
    );
    expect(hubCaption(hub({ encryption: null, hub_url: 'adc://hub.example:411' }))).toBe(
      'Hub - Welcome (adc://hub.example:411)',
    );
  });

  it('leaves out a topic that the hub has not got', () => {
    expect(hubCaption(hub({}, ''))).toBe('[S] Hub (adcs://hub.example:411)');
  });

  it('uses the address for a hub without a name', () => {
    expect(hubCaption(hub({ identity: { name: '', description: '' }, encryption: null }))).toBe(
      'adcs://hub.example:411 (adcs://hub.example:411)',
    );
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
    expect(hubCaption(offline)).toBe('Hub - Welcome (adcs://hub.example:411)');
    // Connected again: the hub has removed its topic
    expect(hubTopic({ ...online, identity: { name: 'Hub', description: '' } })).toBe('');
    // A hub that never had one
    expect(hubTopic(hub({ connect_state: { id: 'disconnected', str: '' } }, ''))).toBe('');
  });
});
