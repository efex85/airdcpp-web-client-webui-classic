// The windows that are open after logging in

export interface StartupSettings {
  /** The Home window exists and is the first tab after logging in */
  home_enabled: boolean;
  /** Open the system log after logging in (it can always be opened from the menu) */
  open_syslog_at_start: boolean;
}

export const STARTUP_DEFAULTS: StartupSettings = { home_enabled: true, open_syslog_at_start: true };

export const sanitizeStartup = (value: unknown): StartupSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const flag = (key: keyof StartupSettings) =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : STARTUP_DEFAULTS[key];
  return { home_enabled: flag('home_enabled'), open_syslog_at_start: flag('open_syslog_at_start') };
};

/** Home first and the system log second (if wanted), followed by the other windows in their previous order */
export const startupTabs = (tabs: string[], settings: StartupSettings): string[] => [
  ...(settings.home_enabled ? ['home'] : []),
  ...(settings.open_syslog_at_start ? ['syslog'] : []),
  ...tabs.filter((key) => key !== 'home' && key !== 'syslog'),
];
