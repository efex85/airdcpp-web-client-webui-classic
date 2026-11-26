import { describe, expect, it } from 'vitest';
import { merge } from '../src/lib/merge';
import { colorChain, currentTabEvent, TAB_EVENTS, tabEventStyle } from '../src/lib/tabEvents';
import { COLOR_DEFINITIONS, DEFAULT_COLORS, isBold, resolveTheme, sanitizeColors } from '../src/lib/theme';

const none = { mention: 0, user: 0, bot: 0, status: 0, verbose: 0 };
const hub = (unread: object, highlight = {}) => currentTabEvent('hub', { ...none, ...unread }, highlight)?.id ?? null;
const pm = (unread: object, highlight = {}) => currentTabEvent('pm', { ...none, ...unread }, highlight)?.id ?? null;

describe('tab events', () => {
  it('marks hub tabs for messages and mentions, not for status messages by default', () => {
    expect(hub({})).toBeNull();
    expect(hub({ user: 1 })).toBe('hub_message');
    expect(hub({ bot: 1 })).toBe('hub_bot');
    expect(hub({ user: 2, mention: 1 })).toBe('hub_mention');
    expect(hub({ status: 3 })).toBeNull();
    expect(hub({ verbose: 3 })).toBeNull();
    expect(currentTabEvent('hub', undefined, {})).toBeNull();
  });

  it('marks private chats for everything by default', () => {
    expect(pm({ user: 1 })).toBe('pm');
    expect(pm({ bot: 1 })).toBe('pm_bot');
    expect(pm({ status: 1 })).toBe('pm_status');
    expect(pm({ verbose: 1 })).toBe('pm_status');
    expect(currentTabEvent('pm', { ...none, user: 1 }, {})!.level).toBe('mention');
    expect(currentTabEvent('pm', { ...none, status: 1 }, {})!.level).toBe('unread');
  });

  it('passes over events that are switched off', () => {
    // A mention is also a message from a user
    expect(hub({ mention: 1, user: 1 }, { hub_mention: false })).toBe('hub_message');
    expect(hub({ user: 1 }, { hub_message: false })).toBeNull();
    expect(hub({ user: 1, status: 1 }, { hub_message: false, hub_status: true })).toBe('hub_status');
    expect(hub({ verbose: 1 }, { hub_join: true })).toBe('hub_join');
    expect(pm({ user: 1 }, { pm: false })).toBeNull();
  });

  it('has a background with a bold choice and a text color for every event', () => {
    for (const event of TAB_EVENTS) {
      const bg = COLOR_DEFINITIONS.find((d) => d.key === `${event.colors}_bg`);
      const text = COLOR_DEFINITIONS.find((d) => d.key === `${event.colors}_text`);
      // Mentions and private messages are bold by default
      expect([event.id, bg?.bold, !!text]).toEqual([event.id, event.level === 'mention', true]);
      // The style refers to the variables that the colors are written to
      const style = tabEventStyle(event.id);
      expect(style['--event-bg']!.startsWith(`var(${bg!.cssVar}`)).toBe(true);
      expect(style['--event-text']!.startsWith(`var(${text!.cssVar}`)).toBe(true);
      expect(style['--event-weight']).toBe(`var(${bg!.cssVar}-weight, 400)`);
    }
  });

  it('follows other events for colors that are not set', () => {
    expect(colorChain('pm_bot').map((e) => e.id)).toEqual(['pm_bot', 'pm', 'hub_mention']);
    expect(tabEventStyle('pm_bot')['--event-bg']).toBe(
      'var(--tab-pm-bot-bg, var(--tab-pm-bg, var(--tab-mention-bg)))',
    );
    expect(tabEventStyle('hub_bot')['--event-text']).toBe(
      'var(--tab-bot-text, var(--tab-unread-text, var(--text)))',
    );
    // Every chain ends in a color that all color sets define
    for (const event of TAB_EVENTS) {
      const last = colorChain(event.id).at(-1)!;
      expect(COLOR_DEFINITIONS.find((d) => d.key === `${last.colors}_bg`)!.optional).toBeUndefined();
    }
  });

  it('sets boldness for each event on its own', () => {
    const settings = sanitizeColors({ bold: { tab_unread_bg: true, tab_pm_bg: false } });
    expect(isBold(settings, 'tab_unread_bg')).toBe(true);
    expect(isBold(settings, 'tab_bot_bg')).toBe(false);
    expect(isBold(settings, 'tab_mention_bg')).toBe(true);
    const { variables } = resolveTheme(settings);
    expect(variables['--tab-unread-bg-weight']).toBe('600');
    expect(variables['--tab-bot-bg-weight']).toBe('400');
    expect(variables['--tab-mention-bg-weight']).toBe('600');
    expect(variables['--tab-pm-bg-weight']).toBe('400');
    expect(variables['--tab-pm-bot-bg-weight']).toBe('600');
    expect(variables['--tab-bot-bg']).toBeNull();
  });

  it('keeps usable choices and combines those of two devices', () => {
    expect(sanitizeColors({ highlight: { hub_status: true, pm: false, other: true, hub_bot: 'no' } }).highlight).toEqual({
      hub_status: true,
      pm: false,
    });
    // Colors saved before there were choices
    expect(sanitizeColors({ preset: 'black', colors: { tab_unread_bg: '#123456' } })).toMatchObject({
      colors: { tab_unread_bg: '#123456' },
      highlight: {},
    });
    const mine = { ...DEFAULT_COLORS, highlight: { hub_status: true } };
    const theirs = { ...DEFAULT_COLORS, highlight: { hub_join: true } };
    expect(merge(DEFAULT_COLORS, mine, theirs).highlight).toEqual({ hub_status: true, hub_join: true });
  });
});
