// @ts-expect-error The project has no Node types; the test reads the stylesheet as a file
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLOR_DEFINITIONS, colorOf, DEFAULT_COLORS, isBold, PRESETS, resolveTheme, sanitizeColors, scopedTheme } from '../src/lib/theme';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
};

describe('colors', () => {
  it('has the same classic colors as the stylesheet', () => {
    const css: string = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const declared = Object.fromEntries([...root.matchAll(/(--[\w-]+): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
    let compared = 0;
    for (const def of COLOR_DEFINITIONS) {
      const value = PRESETS.classic!.colors[def.key];
      if (value && declared[def.cssVar]) {
        expect([def.cssVar, declared[def.cssVar]]).toEqual([def.cssVar, value]);
        compared++;
      }
    }

    expect(compared).toBeGreaterThan(20);
  });

  it('defines every color that is not optional in every set', () => {
    for (const preset of Object.values(PRESETS)) {
      for (const def of COLOR_DEFINITIONS) {
        expect([preset.name, def.key, !!preset.colors[def.key]]).toEqual([preset.name, def.key, !def.optional]);
      }
    }
  });

  it('keeps texts readable in every set', () => {
    for (const { name, colors: c } of Object.values(PRESETS)) {
      const pairs: [string, string, number][] = [
        [c.ui_text!, c.ui_bg!, 7],
        [c.ui_text!, c.ui_chrome!, 7],
        [c.ui_muted!, c.ui_bg!, 4.5],
        [c.tab_unread_text ?? c.ui_text!, c.tab_unread_bg!, 4.5],
        [c.tab_mention_text ?? c.ui_text!, c.tab_mention_bg!, 4.5],
        [c.ui_text!, c.ui_select!, 4.5],
        ...(['nick_self', 'nick_op', 'nick_bot', 'chat_link', 'chat_mention', 'dupe_shared', 'dupe_queued', 'dupe_finished'].map(
          (key) => [c[key]!, c.ui_bg!, 4.5],
        ) as [string, string, number][]),
      ];
      for (const [text, background, minimum] of pairs) {
        expect([name, text, background, contrast(text, background) >= minimum]).toEqual([name, text, background, true]);
      }
    }
  });

  it('accepts only known colors and sets', () => {
    expect(
      sanitizeColors({ preset: 'constructor', colors: { nick_op: '#abcdef', nick_bot: 'url(x)', other: '#000000' }, bold: { nick_op: false, ui_bg: true } }),
    ).toEqual({ preset: 'classic', colors: { nick_op: '#abcdef' }, bold: { nick_op: false }, highlight: {} });
  });

  it('applies own colors on top of the set', () => {
    const settings = sanitizeColors({ preset: 'black', colors: { ui_chrome: '#334455', nick_favorite: '#ff00ff' }, bold: { nick_op: false } });
    expect(colorOf(settings, 'ui_bg')).toBe('#000000');
    expect(colorOf(settings, 'ui_chrome')).toBe('#334455');
    expect(isBold(settings, 'nick_op')).toBe(false);
    const theme = resolveTheme(settings);
    expect(theme.variables['--chrome']).toBe('#334455');
    expect(theme.variables['--chrome-hover']).toContain('#334455');
    expect(theme.variables['--op-weight']).toBe('400');
    expect(theme.classes['custom-nick-favorite']).toBe(true);
    expect(theme.classes['custom-nick-ignored']).toBe(false);
  });

  it('removes variables of colors that are not set', () => {
    const theme = resolveTheme(DEFAULT_COLORS);
    expect(theme.variables['--nick']).toBeNull();
    expect(theme.variables['--chat-time']).toBeNull();
    expect(theme.variables['--chrome-hover']).toBe('#38373e');
    expect(theme.variables['--op-weight']).toBe('600');
    expect(theme.variables['--bot-weight']).toBe('400');
  });
});

describe('colors of a part of the page', () => {
  it('sets every variable, so that nothing is inherited from the page', () => {
    const scoped = scopedTheme(DEFAULT_COLORS);
    for (const def of COLOR_DEFINITIONS) {
      expect(scoped.variables).toHaveProperty([def.cssVar]);
    }

    expect(scoped.variables['--nick']).toBe('initial');
    expect(scoped.variables['--nick-favorite']).toBe('initial');
    // Without an own color, favorites look like other users, also in their boldness
    expect(scoped.variables['--nick-favorite-weight']).toBe('initial');
    expect(scoped.variables['--nick-weight']).toBe('400');
    expect(scoped.classes).toEqual([]);
  });

  it('shows the chosen colors', () => {
    const scoped = scopedTheme({
      ...DEFAULT_COLORS,
      colors: { nick_favorite: '#112233', ui_chrome: '#445566' },
      bold: { nick_favorite: true },
    });
    expect(scoped.variables['--nick-favorite']).toBe('#112233');
    expect(scoped.variables['--nick-favorite-weight']).toBe('700');
    expect(scoped.variables['--chrome']).toBe('#445566');
    expect(scoped.variables['--chrome-hover']).toContain('#445566');
    expect(scoped.classes).toEqual(['custom-nick-favorite']);
  });
});
