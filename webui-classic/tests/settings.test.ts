import { describe, expect, it, vi } from 'vitest';
import type { SettingDefinition } from '../src/api/settingsTypes';
import { fsName, fsParent, fsRoot, withSeparator } from '../src/lib/fsPath';
import {
  bundleNotification,
  createRateLimiter,
  eventLevel,
  hubMessageNotifies,
  privateMessageNotifies,
} from '../src/lib/notificationRules';
import { changedValues, toApiValue, toApiValues, toEditValue, toEditValues } from '../src/lib/settingsForm';
import { average, formatBitRate, percentage } from '../src/lib/statistics';
import { compareVersions } from '../src/lib/version';
import { getBasePath, getSocketUrl } from '../src/api/socket';

vi.hoisted(() => {
  // The tests run without a browser
  (globalThis as any).localStorage = undefined;
});

const { LOCAL_DEFAULTS, mergeLocalSettings } = await import('../src/store/localSettings');

const def = (key: string, type: SettingDefinition['type'], extra: Partial<SettingDefinition> = {}): SettingDefinition => ({
  key,
  title: key,
  type,
  ...extra,
});

describe('setting values', () => {
  it('edits numbers as text', () => {
    const d = def('slots', 'number');
    expect(toEditValue(d, 0)).toBe('0');
    expect(toApiValue(d, '12')).toBe(12);
    expect(toApiValue(d, ' ')).toBeNull();
  });

  it('sends empty texts as null and trims all but texts and passwords', () => {
    expect(toApiValue(def('nick', 'string'), '  me ')).toBe('me');
    expect(toApiValue(def('nick', 'string'), '   ')).toBeNull();
    expect(toApiValue(def('msg', 'text'), ' a\n ')).toBe(' a\n ');
    expect(toApiValue(def('pass', 'password'), ' x ')).toBe(' x ');
  });

  it('keeps the type of option IDs, also zero, false and null', () => {
    const d = def('mode', 'number', { options: [{ id: -1, name: 'Off' }] });
    expect(toEditValue(d, 0)).toBe(0);
    expect(toApiValue(d, 0)).toBe(0);
    expect(toApiValue(d, null)).toBeNull();
    expect(toApiValue(def('x', 'boolean', { options: [] }), false)).toBe(false);
  });

  it('converts lists and lists of structures', () => {
    expect(toApiValue(def('ext', 'list', { item_type: 'string' }), ['a ', '', 'b'])).toEqual(['a', 'b']);
    const engines = def('engines', 'list', {
      item_type: 'struct',
      definitions: [def('name', 'string'), def('arguments', 'list', { item_type: 'string' })],
    });
    const value = [{ name: 'node', arguments: ['--x'] }];
    expect(toApiValue(engines, toEditValue(engines, value))).toEqual(value);
  });

  it('reports changed values only', () => {
    const defs = [def('a', 'number'), def('b', 'string'), def('c', 'boolean'), def('d', 'string')];
    const saved = { a: 5, b: null, c: true, d: 'x' };
    expect(changedValues(defs, saved, { a: '5', b: '', c: true })).toEqual({});
    expect(changedValues(defs, saved, { a: '6', d: '' })).toEqual({ a: 6, d: null });
  });

  it('converts all values of a new item', () => {
    const defs = [def('path', 'directory_path'), def('incoming', 'boolean')];
    expect(toApiValues(defs, toEditValues(defs, { path: '/a/' }))).toEqual({ path: '/a/', incoming: false });
  });
});

describe('browser settings', () => {
  it('ignores unknown keys and restores defaults for invalid values', () => {
    const merged = mergeLocalSettings(
      { ...LOCAL_DEFAULTS, unread_label_delay: 5 },
      { unread_label_delay: null, notify_pm_bot: true, other: 1, background_image_url: null },
    );
    expect(merged.unread_label_delay).toBe(0);
    expect(merged.notify_pm_bot).toBe(true);
    expect(merged.background_image_url).toBe('');
    expect('other' in merged).toBe(false);
  });
});

describe('notifications', () => {
  const message = (mention: boolean, flags: string[] = []) =>
    ({ has_mention: mention, reply_to: { flags } }) as any;

  it('follows the hub message settings', () => {
    expect(hubMessageNotifies(message(true), LOCAL_DEFAULTS, false)).toBe(true);
    expect(hubMessageNotifies(message(false), LOCAL_DEFAULTS, true)).toBe(false);
    const all = { ...LOCAL_DEFAULTS, notify_hub_message: true };
    expect(hubMessageNotifies(message(false), all, true)).toBe(true);
    expect(hubMessageNotifies(message(false), all, false)).toBe(false);
  });

  it('separates bots from users in private messages', () => {
    expect(privateMessageNotifies(message(false), LOCAL_DEFAULTS)).toBe(true);
    expect(privateMessageNotifies(message(false, ['bot']), LOCAL_DEFAULTS)).toBe(false);
    expect(privateMessageNotifies(message(true, ['bot']), LOCAL_DEFAULTS)).toBe(true);
  });

  it('filters system messages by severity', () => {
    expect(eventLevel({ severity: 'notify' } as any, LOCAL_DEFAULTS)).toBe('info');
    expect(eventLevel({ severity: 'info' } as any, LOCAL_DEFAULTS)).toBeNull();
    expect(eventLevel({ severity: 'verbose' } as any, LOCAL_DEFAULTS)).toBeNull();
    expect(eventLevel({ severity: 'error' } as any, LOCAL_DEFAULTS)).toBe('error');
  });

  it('describes bundle status changes', () => {
    expect(bundleNotification({ status: { id: 'downloading' } } as any)).toBeNull();
    expect(
      bundleNotification({
        status: { id: 'completion_validation_error', hook_error: { str: 'bad', hook_name: 'sfv' } },
      } as any),
    ).toEqual({ level: 'error', text: 'Content validation failed: bad (sfv)' });
  });

  it('limits the rate', () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow(0), allow(1), allow(2), allow(1000)]).toEqual([true, true, false, true]);
  });
});

describe('helpers', () => {
  it('compares versions', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta.2', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-beta.1')).toBeLessThan(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
  });

  it('handles paths of Linux and Windows', () => {
    expect(fsParent('/a/b/', '/')).toBe('/a/');
    expect(fsParent('/a/', '/')).toBe('/');
    expect(fsParent('C:\\', '\\')).toBe(fsRoot('\\'));
    expect(fsName('C:\\share\\music\\', '\\')).toBe('music');
    expect(withSeparator('/a', '/')).toBe('/a/');
    expect(withSeparator('', '\\')).toBe('');
  });

  it('formats statistics', () => {
    expect(percentage(1, 4)).toBe('25.00 %');
    expect(percentage(1, 0)).toBe('0.00 %');
    expect(average(7, 2)).toBe('3.50');
    expect(formatBitRate(125_000)).toBe('1.00 Mbit/s');
    expect(formatBitRate(0)).toBe('');
  });

  it('finds the base path below a reverse proxy', () => {
    expect(getBasePath('/')).toBe('/');
    expect(getBasePath('/air/index.html')).toBe('/air/');
    expect(getSocketUrl({ protocol: 'https:', host: 'h', pathname: '/air/' })).toBe('wss://h/air/api/v1/');
  });
});
