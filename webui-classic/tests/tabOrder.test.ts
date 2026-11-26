import { describe, expect, test } from 'vitest';
import { mergeOrder, moveItem, orderTabs, savedIndex, savedTabId } from '../src/lib/tabOrder';

describe('rearranging tabs', () => {
  const tabs = ['home', 'syslog', 'hub:1', 'hub:2'];

  test('moves a tab to a position', () => {
    expect(moveItem(tabs, 'hub:2', 0)).toEqual(['hub:2', 'home', 'syslog', 'hub:1']);
    expect(moveItem(tabs, 'home', 2)).toEqual(['syslog', 'hub:1', 'home', 'hub:2']);
    expect(moveItem(tabs, 'home', 99)).toEqual(['syslog', 'hub:1', 'hub:2', 'home']);
  });

  test('returns the same list when nothing changes', () => {
    expect(moveItem(tabs, 'home', 0)).toBe(tabs);
    expect(moveItem(tabs, 'hub:2', 3)).toBe(tabs);
    expect(moveItem(tabs, 'missing', 0)).toBe(tabs);
  });

  test('identifies hubs by their address', () => {
    const hubs = [{ id: 7, hub_url: 'adcs://hub.example.org:1511' }];
    expect(savedTabId('hub:7', hubs)).toBe('hub:adcs://hub.example.org:1511');
    expect(savedTabId('hub:8', hubs)).toBe('hub:8');
    expect(savedTabId('pm:ABC', hubs)).toBe('pm:ABC');
  });
});

describe('restoring the tab order', () => {
  const same = (key: string) => key;

  test('uses the saved order, whatever order the windows were loaded in', () => {
    expect(orderTabs(['home', 'syslog', 'pm:a', 'hub:1'], ['hub:1', 'home', 'pm:a', 'syslog'], same)).toEqual([
      'hub:1',
      'home',
      'pm:a',
      'syslog',
    ]);
  });

  test('adds new windows at the end and ignores closed ones', () => {
    expect(orderTabs(['queue', 'pm:new', 'hub:1'], ['hub:1', 'pm:gone', 'queue'], same)).toEqual([
      'hub:1',
      'queue',
      'pm:new',
    ]);
  });

  test('finds a hub that has a new ID', () => {
    const idOf = (key: string) => savedTabId(key, [{ id: 9, hub_url: 'adc://a' }]);
    expect(orderTabs(['home', 'queue', 'hub:9'], ['home', 'hub:adc://a', 'queue'], idOf)).toEqual([
      'home',
      'hub:9',
      'queue',
    ]);
  });

  test('puts Home and the system log at their usual places when they have no saved one', () => {
    expect(orderTabs(['home', 'syslog', 'queue', 'hub:1'], ['hub:1', 'queue'], same)).toEqual([
      'home',
      'syslog',
      'hub:1',
      'queue',
    ]);
    expect(orderTabs(['home', 'syslog', 'hub:1'], ['hub:1', 'home'], same)).toEqual(['hub:1', 'home', 'syslog']);
    expect(orderTabs(['syslog', 'hub:1'], ['hub:1'], same)).toEqual(['syslog', 'hub:1']);
  });
});

describe('hubs that are connected later', () => {
  const saved = ['hub:a', 'home', 'hub:b', 'queue'];

  test('keep their saved place while they are not open', () => {
    expect(mergeOrder(saved, ['home', 'queue'])).toEqual(saved);
    expect(mergeOrder(saved, ['queue', 'home'])).toEqual(['hub:a', 'queue', 'home', 'hub:b']);
    expect(mergeOrder(saved, [])).toEqual(['hub:a', 'hub:b']);
  });

  test('only hubs are remembered after being closed', () => {
    expect(mergeOrder(saved, ['hub:a', 'hub:b'])).toEqual(['hub:a', 'hub:b']);
  });

  test('return to that place', () => {
    expect(savedIndex(['home', 'queue'], saved, 'hub:a')).toBe(0);
    expect(savedIndex(['home', 'queue'], saved, 'hub:b')).toBe(1);
    expect(savedIndex(['settings', 'queue'], saved, 'hub:b')).toBe(1);
  });

  test('go to the end without a saved place', () => {
    expect(savedIndex(['home', 'queue'], saved, 'hub:c')).toBe(2);
    expect(savedIndex(['settings'], saved, 'hub:b')).toBe(1);
  });
});
