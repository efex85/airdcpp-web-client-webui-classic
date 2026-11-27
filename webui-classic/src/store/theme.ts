// Applies the colors and text settings to the page

import { resolveTheme, sanitizeColors, type ColorSettings } from '../lib/theme';
import { load, save } from '../lib/storage';
import { colorsDoc, isConnected } from './docs';
import { useLocalSettings, type LocalSettings } from './localSettings';

const FONTS: Record<string, string> = {
  mono: "Consolas, 'Cascadia Mono', 'DejaVu Sans Mono', Menlo, 'Roboto Mono', monospace",
  serif: "Georgia, 'Times New Roman', 'Noto Serif', serif",
};

const root = () => document.documentElement;

const setVariable = (name: string, value: string | null) =>
  value === null ? root().style.removeProperty(name) : root().style.setProperty(name, value);

const applyColors = (colors: ColorSettings) => {
  const { variables, classes } = resolveTheme(colors);
  for (const [name, value] of Object.entries(variables)) {
    setVariable(name, value);
  }

  for (const [name, enabled] of Object.entries(classes)) {
    root().classList.toggle(name, enabled);
  }

  // The color of the browser's own bars on phones
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', variables['--chrome']!);
};

/** The variables of the text settings; null removes a variable */
export const textVariables = (settings: LocalSettings): Record<string, string | null> => ({
  '--font-scale': String(settings.ui_text_size / 100),
  '--chat-scale': String(settings.chat_text_size / 100),
  '--chat-font': FONTS[settings.chat_font] ?? null,
});

const applyText = (settings: LocalSettings) => {
  for (const [name, value] of Object.entries(textVariables(settings))) {
    setVariable(name, value);
  }
};

const LAST_COLORS = 'last-colors';

/** Shows the colors of the logged in user and remembers them for the login page and the next start */
export const showUserColors = () => {
  applyColors(colorsDoc.value);
  save(LAST_COLORS, colorsDoc.value);
};

export const initTheme = () => {
  // Until a user has logged in, the colors that were used last are shown
  applyColors(sanitizeColors(load(LAST_COLORS, null)));
  applyText(useLocalSettings.getState());
  useLocalSettings.subscribe(applyText);
  colorsDoc.subscribe(() => {
    if (isConnected()) {
      showUserColors();
    }
  });
};
