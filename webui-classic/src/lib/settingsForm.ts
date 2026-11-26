// Conversion between API setting values and the values of form controls

import type { OptionId, SettingDefinition, SettingValues } from '../api/settingsTypes';

/** Numbers are edited as text, so that a field can be cleared and retyped */
export const toEditValue = (def: SettingDefinition, value: unknown): unknown => {
  if (def.options && def.type !== 'list') {
    return value === undefined ? null : value;
  }

  switch (def.type) {
    case 'boolean':
      return !!value;
    case 'number':
      return value === undefined || value === null ? '' : String(value);
    case 'list': {
      const items = Array.isArray(value) ? value : [];
      if (def.item_type === 'struct') {
        return items.map((item) => toEditValues(def.definitions ?? [], item as SettingValues));
      }

      if (def.options) {
        return items;
      }

      return items.map((item) => toEditValue({ ...def, type: def.item_type ?? 'string' }, item));
    }
    case 'hinted_user':
      return value ?? null;
    default:
      return value === undefined || value === null ? '' : String(value);
  }
};

export const toEditValues = (defs: SettingDefinition[], values: SettingValues): SettingValues =>
  Object.fromEntries(defs.map((def) => [def.key, toEditValue(def, values[def.key])]));

/** Empty fields are sent as null; the server tells if the field is required */
export const toApiValue = (def: SettingDefinition, value: unknown): unknown => {
  if (def.options && def.type !== 'list') {
    return value === undefined ? null : value;
  }

  switch (def.type) {
    case 'boolean':
      return !!value;
    case 'number': {
      const text = String(value ?? '').trim();
      return text === '' || !Number.isFinite(Number(text)) ? null : Number(text);
    }
    case 'list': {
      const items = Array.isArray(value) ? value : [];
      if (def.item_type === 'struct') {
        return items.map((item) => toApiValues(def.definitions ?? [], item as SettingValues));
      }

      if (def.options) {
        return items;
      }

      return items
        .map((item) => toApiValue({ ...def, type: def.item_type ?? 'string' }, item))
        .filter((item) => item !== null);
    }
    case 'hinted_user':
      return value ?? null;
    default: {
      if (value === undefined || value === null) {
        return null;
      }

      // Leading or trailing spaces are meaningful in multi-line texts and passwords
      const text = def.type === 'text' || def.type === 'password' ? String(value) : String(value).trim();
      return text === '' ? null : text;
    }
  }
};

export const toApiValues = (defs: SettingDefinition[], values: SettingValues): SettingValues =>
  Object.fromEntries(defs.map((def) => [def.key, toApiValue(def, values[def.key])]));

export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameValue((a as SettingValues)[key], (b as SettingValues)[key]));
  }

  return false;
};

/** The API values of the fields that differ from the saved ones */
export const changedValues = (
  defs: SettingDefinition[],
  saved: SettingValues,
  edits: SettingValues,
): SettingValues => {
  const ret: SettingValues = {};
  for (const def of defs) {
    if (!(def.key in edits)) {
      continue;
    }

    const value = toApiValue(def, edits[def.key]);
    // The saved value goes through the same conversion, so that e.g. null and "" are equal
    if (!sameValue(value, toApiValue(def, toEditValue(def, saved[def.key])))) {
      ret[def.key] = value;
    }
  }

  return ret;
};

/** The value of a select element identifies the option; option IDs may be numbers, booleans or null */
export const optionKey = (id: OptionId): string => JSON.stringify(id);
