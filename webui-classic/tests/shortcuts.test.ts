import { describe, expect, it } from 'vitest';
import {
  assign,
  combinationLabel,
  combinationOf,
  combinationProblem,
  findShortcut,
  neighbourWindow,
  resetAction,
  sanitizeShortcuts,
  setEnabled,
  SHORTCUT_ACTIONS,
  SHORTCUT_DEFAULTS,
  shortcutList,
  type KeyPress,
} from '../src/lib/shortcuts';

const press = (key: string, code: string, modifiers = ''): KeyPress => ({
  key,
  code,
  ctrlKey: modifiers.includes('c'),
  altKey: modifiers.includes('a'),
  shiftKey: modifiers.includes('s'),
  metaKey: modifiers.includes('m'),
});

describe('key combinations', () => {
  it('names the modifiers in a fixed order and letters by the keyboard layout', () => {
    expect(combinationOf(press('N', 'KeyN', 'mcsa'))).toBe('Ctrl+Alt+Shift+Meta+N');
    // A key that types Q on this layout, at the place of A
    expect(combinationOf(press('q', 'KeyA', 'a'))).toBe('Alt+Q');
  });

  it('uses the place of the key when another character is typed', () => {
    // Option+N on a Mac, and a Cyrillic layout
    expect(combinationOf(press('Dead', 'KeyN', 'a'))).toBe('Alt+N');
    expect(combinationOf(press('т', 'KeyN', 'a'))).toBe('Alt+N');
    expect(combinationOf(press('≤', 'Comma', 'a'))).toBe('Alt+,');
    expect(combinationOf(press('!', 'Digit1', 'as'))).toBe('Alt+Shift+1');
  });

  it('knows named keys', () => {
    expect(combinationOf(press('ArrowLeft', 'ArrowLeft', 'as'))).toBe('Alt+Shift+ArrowLeft');
    expect(combinationOf(press('F2', 'F2'))).toBe('F2');
    expect(combinationOf(press(' ', 'Space', 'c'))).toBe('Ctrl+Space');
    expect(combinationOf(press('+', 'Equal', 'a'))).toBe('Alt+Plus');
  });

  it('ignores modifiers alone and characters typed with AltGr', () => {
    expect(combinationOf(press('Alt', 'AltLeft', 'a'))).toBe('');
    const altGr = { ...press('@', 'Digit2', 'ca'), getModifierState: (k: string) => k === 'AltGraph' };
    expect(combinationOf(altGr)).toBe('');
  });

  it('refuses keys needed for typing, browser keys and editing keys', () => {
    for (const c of ['A', 'Shift+A', 'Enter', 'Ctrl+W', 'Ctrl+Tab', 'Ctrl+Shift+T', 'Meta+N', 'Alt+F4', 'Ctrl+C']) {
      expect(combinationProblem(c), c).not.toBeNull();
    }

    for (const c of ['Alt+W', 'F2', 'Ctrl+Alt+W', 'Ctrl+K', 'Alt+Shift+ArrowLeft']) {
      expect(combinationProblem(c), c).toBeNull();
    }
  });

  it('shows combinations for people', () => {
    expect(combinationLabel('Alt+Shift+ArrowLeft')).toBe('Alt+Shift+←');
    expect(combinationLabel('Alt+Meta+N', true)).toBe('Option+Cmd+N');
    expect(combinationLabel('')).toBe('');
  });
});

describe('shortcuts', () => {
  it('has usable defaults without two actions on one key or button', () => {
    for (const kind of ['key', 'mouse'] as const) {
      const values = shortcutList(SHORTCUT_DEFAULTS)
        .map((s) => s[kind])
        .filter(Boolean);
      expect(new Set(values).size).toBe(values.length);
    }

    for (const action of SHORTCUT_ACTIONS.filter((a) => a.key)) {
      expect(combinationProblem(action.key), action.key).toBeNull();
    }
  });

  it('finds the action of a key and of a thumb button', () => {
    expect(findShortcut(SHORTCUT_DEFAULTS, 'key', 'Alt+N')?.id).toBe('search');
    expect(findShortcut(SHORTCUT_DEFAULTS, 'mouse', 'back')?.id).toBe('previous_tab');
    expect(findShortcut(SHORTCUT_DEFAULTS, 'mouse', 'forward')?.id).toBe('next_tab');
    expect(findShortcut(SHORTCUT_DEFAULTS, 'key', '')).toBeUndefined();
  });

  it('switches keys, buttons and single actions off', () => {
    const keysOff = { ...SHORTCUT_DEFAULTS, keyboard: false };
    expect(findShortcut(keysOff, 'key', 'Alt+N')).toBeUndefined();
    expect(findShortcut(keysOff, 'mouse', 'back')?.id).toBe('previous_tab');
    expect(findShortcut({ ...SHORTCUT_DEFAULTS, mouse: false }, 'mouse', 'back')).toBeUndefined();

    const off = setEnabled(SHORTCUT_DEFAULTS, 'previous_tab', false);
    expect(findShortcut(off, 'mouse', 'back')).toBeUndefined();
    expect(findShortcut(off, 'key', 'Alt+Shift+ArrowLeft')).toBeUndefined();
    expect(setEnabled(off, 'previous_tab', true)).toEqual(SHORTCUT_DEFAULTS);
  });

  it('moves a key from one action to another', () => {
    const { settings, taken } = assign(SHORTCUT_DEFAULTS, 'queue', 'key', 'Alt+N');
    expect(taken.map((a) => a.id)).toEqual(['search']);
    expect(findShortcut(settings, 'key', 'Alt+N')?.id).toBe('queue');
    expect(findShortcut(settings, 'key', 'Alt+U')).toBeUndefined();

    const reset = resetAction(settings, 'search');
    expect(reset.taken.map((a) => a.id)).toEqual(['queue']);
    expect(findShortcut(reset.settings, 'key', 'Alt+N')?.id).toBe('search');
  });

  it('removes a key without taking others, and stores only what differs from the defaults', () => {
    const removed = assign(SHORTCUT_DEFAULTS, 'search', 'key', '');
    expect(removed.taken).toEqual([]);
    expect(removed.settings.changes).toEqual({ search: { key: '' } });
    expect(assign(removed.settings, 'search', 'key', 'Alt+N').settings.changes).toEqual({});
  });

  it('prefers a chosen key over a default with the same one', () => {
    const settings = { ...SHORTCUT_DEFAULTS, changes: { away: { key: 'Alt+N' } } };
    expect(findShortcut(settings, 'key', 'Alt+N')?.id).toBe('away');
  });

  it('accepts only known and usable stored values', () => {
    expect(sanitizeShortcuts(null)).toEqual(SHORTCUT_DEFAULTS);
    expect(
      sanitizeShortcuts({
        keyboard: false,
        mouse: 'yes',
        changes: {
          search: { key: 'Ctrl+W', mouse: 'middle', off: 1 },
          queue: { key: 'Alt+K', mouse: 'back', off: true },
          unknown: { off: true },
        },
      }),
    ).toEqual({ keyboard: false, mouse: true, changes: { queue: { off: true, key: 'Alt+K', mouse: 'back' } } });
  });

  it('goes around the tabs', () => {
    expect(neighbourWindow(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(neighbourWindow(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(neighbourWindow(['a', 'b'], 'gone', 1)).toBe('a');
    expect(neighbourWindow([], 'a', 1)).toBeUndefined();
  });
});
