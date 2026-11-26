// A form in a dialog that stays open until the server has accepted the values
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../../api/socket';
import type { SettingDefinition, SettingValues } from '../../api/settingsTypes';
import { changedValues, toApiValues, toEditValues } from '../../lib/settingsForm';
import { showCustomDialog } from '../../store/ui';
import { SettingFields } from './SettingFields';

export interface FormOptions {
  title: string;
  confirmLabel?: string;
  /** Fields may depend on the entered values */
  definitions: SettingDefinition[] | ((values: SettingValues) => SettingDefinition[]);
  /** Values of the item being edited; missing when a new item is created */
  saved?: SettingValues;
  /** Initial values of a new item */
  initial?: SettingValues;
  /** Returns other values to change when a field changes */
  onChange?: (key: string, values: SettingValues) => SettingValues | void;
  disabled?: (key: string, values: SettingValues) => boolean;
  suggestions?: Record<string, string[]>;
  intro?: ReactNode;
  /** Gets all filled fields of a new item or the changed fields of an existing one */
  save: (values: SettingValues) => Promise<unknown>;
}

const Form = ({ options, close }: { options: FormOptions; close: (result: { saved: true } | null) => void }) => {
  const definitionsFor = (values: SettingValues) =>
    typeof options.definitions === 'function' ? options.definitions(values) : options.definitions;

  const [values, setValues] = useState<SettingValues>(() => {
    const source = options.saved ?? {
      ...Object.fromEntries(
        definitionsFor(options.initial ?? {}).map((def) => [def.key, def.default_value]),
      ),
      ...options.initial,
    };
    return toEditValues(definitionsFor(source), source);
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const definitions = definitionsFor(values);

  const change = (key: string, value: unknown) => {
    // The message about a rejected value is outdated once it is changed
    if (error?.field === key) {
      setError(null);
    }

    setValues((old) => {
      const next = { ...old, [key]: value };
      return { ...next, ...options.onChange?.(key, next) };
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = options.saved
      ? changedValues(definitions, options.saved, values)
      : Object.fromEntries(Object.entries(toApiValues(definitions, values)).filter(([, v]) => v !== null));

    if (options.saved && !Object.keys(result).length) {
      close(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await options.save(result);
      close({ saved: true });
    } catch (e) {
      setError(e as ApiError);
      setSaving(false);
    }
  };

  return (
    // The server validates the values and reports which field it rejected
    <form onSubmit={submit} noValidate>
      <div className="dialog-body">
        {options.intro}
        <SettingFields
          definitions={definitions}
          values={values}
          onChange={change}
          disabled={(key) => !!options.disabled?.(key, values)}
          errorField={error?.field}
          suggestions={options.suggestions}
        />
      </div>
      {error && (
        <div className="dialog-error error" role="alert">
          {error.message}
        </div>
      )}
      <div className="dialog-buttons">
        <button type="submit" disabled={saving}>
          {options.confirmLabel ?? 'Save'}
        </button>
        <button type="button" onClick={() => close(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
};

/** Returns true if the values were saved */
export const showForm = async (options: FormOptions): Promise<boolean> =>
  (await showCustomDialog<{ saved: true }>(options.title, (close) => <Form options={options} close={close} />)) !== null;
