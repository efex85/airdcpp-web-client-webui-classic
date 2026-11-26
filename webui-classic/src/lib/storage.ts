// Browser storage may be unavailable (private mode, blocked site data)

const PREFIX = 'airdcpp-classic.';

export const load = <T>(key: string, fallback: T, storage: 'local' | 'session' = 'local'): T => {
  try {
    const raw = (storage === 'local' ? localStorage : sessionStorage).getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const save = (key: string, value: unknown, storage: 'local' | 'session' = 'local'): void => {
  try {
    const target = storage === 'local' ? localStorage : sessionStorage;
    if (value === undefined || value === null) {
      target.removeItem(PREFIX + key);
    } else {
      target.setItem(PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // Settings just won't be remembered
  }
};
