// State of a settings page: saved values, unsaved changes and saving
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../api/socket';
import type { SettingDefinition, SettingValues } from '../../api/settingsTypes';
import { SettingFields } from '../../components/forms/SettingFields';
import { useAccess } from '../../lib/access';
import { changedValues, toEditValue } from '../../lib/settingsForm';
import { toast, useApp } from '../../store/app';
import { socket } from '../../store/session';
import { useSettingsNav } from '../../store/settingsNav';

export interface FormData {
  definitions: SettingDefinition[];
  saved: SettingValues;
  /** Values that the client picks itself while automatic selection is enabled */
  automatic?: SettingValues;
}

/** Fields that can't be set manually while the toggle is enabled */
export interface AutoGroup {
  toggle: string;
  keys: string[];
}

export interface FormSource {
  load: () => Promise<FormData>;
  save: (changed: SettingValues) => Promise<unknown>;
  auto?: AutoGroup[];
  disabled?: (key: string, values: SettingValues) => boolean;
  canSave: boolean;
}

export const useForm = (source: FormSource) => {
  const generation = useApp((s) => s.generation);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const [data, setData] = useState<FormData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [edits, setEdits] = useState<SettingValues>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(
    () =>
      sourceRef.current.load().then(
        (result) => {
          setData(result);
          setLoadError('');
        },
        (e: Error) => setLoadError(e.message),
      ),
    [],
  );

  // Unsaved changes are kept when the data is loaded again after a reconnect
  useEffect(() => {
    void reload();
  }, [reload, generation]);

  const value = (def: SettingDefinition) =>
    def.key in edits ? edits[def.key] : toEditValue(def, data?.saved[def.key]);

  const definitions = data?.definitions ?? [];
  const enteredValues: SettingValues = Object.fromEntries(definitions.map((def) => [def.key, value(def)]));
  const automaticKeys = new Set(
    (source.auto ?? []).filter((group) => !!enteredValues[group.toggle]).flatMap((group) => group.keys),
  );

  const values: SettingValues = Object.fromEntries(
    definitions.map((def) => [
      def.key,
      automaticKeys.has(def.key) ? toEditValue(def, data?.automatic?.[def.key]) : enteredValues[def.key],
    ]),
  );

  const changes = data
    ? changedValues(
        definitions.filter((def) => !automaticKeys.has(def.key)),
        data.saved,
        edits,
      )
    : {};
  const dirty = Object.keys(changes).length > 0;

  useEffect(() => {
    useSettingsNav.setState({ dirty });
    return () => useSettingsNav.setState({ dirty: false });
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await sourceRef.current.save(changes);
      await reload();
      setEdits({});
      toast('Settings were saved');
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setSaving(false);
    }
  };

  return {
    loaded: !!data,
    loadError,
    definitions,
    values,
    saved: data?.saved,
    dirty,
    saving,
    error,
    canSave: source.canSave,
    save,
    revert: () => {
      setEdits({});
      setError(null);
    },
    setValue: (key: string, v: unknown) => setEdits((old) => ({ ...old, [key]: v })),
    isDisabled: (key: string) => !source.canSave || automaticKeys.has(key) || !!source.disabled?.(key, values),
  };
};

export type SettingsForm = ReturnType<typeof useForm>;

interface RemoteOptions {
  auto?: AutoGroup[];
  /** Show the manually set values even if the client currently uses automatic ones */
  manual?: boolean;
  disabled?: FormSource['disabled'];
}

/** Settings stored by the client */
export const useRemoteForm = (keys: string[], options: RemoteOptions = {}) => {
  const access = useAccess();
  return useForm({
    ...options,
    canSave: access('settings_edit'),
    load: async () => {
      const autoKeys = options.auto?.flatMap((group) => group.keys) ?? [];
      const mode = options.manual || autoKeys.length ? 'force_manual' : 'current';
      const [definitions, saved, automatic] = await Promise.all([
        socket.post<SettingDefinition[]>('settings/definitions', { keys }),
        socket.post<SettingValues>('settings/get', { keys, value_mode: mode }),
        autoKeys.length
          ? socket.post<SettingValues>('settings/get', { keys: autoKeys, value_mode: 'force_auto' })
          : undefined,
      ]);
      return { definitions, saved, automatic };
    },
    save: (changed) => socket.post('settings/set', changed),
  });
};

/** The fields of the given settings in the listed order */
export const Fields = ({
  form,
  keys,
  suggestions,
  help,
}: {
  form: SettingsForm;
  keys: string[];
  suggestions?: Record<string, string[]>;
  /** Explanations that this UI adds to or shows instead of the server's */
  help?: Record<string, string | undefined>;
}) => (
  <SettingFields
    definitions={keys.flatMap((key) => {
      const def = form.definitions.find((d) => d.key === key);
      return def ? [help?.[key] ? { ...def, help: help[key] } : def] : [];
    })}
    values={form.values}
    onChange={form.setValue}
    disabled={form.isDisabled}
    errorField={form.error?.field}
    suggestions={suggestions}
  />
);

export const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="settings-section">
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

export const Note = ({ children }: { children: ReactNode }) => <p className="settings-note">{children}</p>;

/** Scrollable page with the save buttons of its form at the bottom */
export const Page = ({ form, children }: { form?: SettingsForm; children: ReactNode }) => (
  <>
    <div className="settings-scroll">
      {form?.loadError && (
        <div className="error" role="alert">
          {form.loadError}
        </div>
      )}
      {form && !form.loaded && !form.loadError ? <div className="muted">Loading…</div> : children}
    </div>
    {form && (
      <div className="settings-buttons">
        <button type="button" disabled={!form.dirty || !form.canSave || form.saving} onClick={() => void form.save()}>
          Save changes
        </button>
        <button type="button" disabled={!form.dirty || form.saving} onClick={form.revert}>
          Undo
        </button>
        {form.error ? (
          <span className="error" role="alert">
            {form.error.message}
          </span>
        ) : (
          <span className="muted">
            {!form.canSave ? 'No save permission' : form.dirty ? 'Unsaved changes' : 'No unsaved changes'}
          </span>
        )}
      </div>
    )}
  </>
);
