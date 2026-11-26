// Form controls generated from setting definitions
import { FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { HintedUser, OnlineUser } from '../../api/types';
import type { SettingDefinition, SettingValues } from '../../api/settingsTypes';
import { hasAccess } from '../../lib/access';
import { optionKey, toEditValues } from '../../lib/settingsForm';
import { favorites, socket } from '../../store/session';
import { browsePath, type BrowseMode } from '../FileBrowser';

export interface SettingFieldsProps {
  definitions: SettingDefinition[];
  values: SettingValues;
  onChange: (key: string, value: unknown) => void;
  disabled?: (key: string) => boolean;
  /** Key of the field that the server rejected */
  errorField?: string;
  suggestions?: Record<string, string[]>;
}

export const SettingFields = ({ definitions, values, onChange, disabled, errorField, suggestions }: SettingFieldsProps) => (
  <>
    {definitions.map((def) => (
      <SettingField
        key={def.key}
        def={def}
        value={values[def.key]}
        onChange={(value) => onChange(def.key, value)}
        disabled={disabled?.(def.key)}
        invalid={errorField === def.key}
        suggestions={suggestions?.[def.key]}
      />
    ))}
  </>
);

interface FieldProps {
  def: SettingDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  invalid?: boolean;
  suggestions?: string[];
}

const BROWSE_MODES: Partial<Record<string, BrowseMode>> = {
  directory_path: 'directory',
  file_path: 'file',
  existing_file_path: 'existing_file',
};

const SettingField = ({ def, value, onChange, disabled, invalid, suggestions }: FieldProps) => {
  const id = useId();
  const help = def.help && <div className="field-help">{def.help}</div>;
  const title = def.optional && def.type !== 'boolean' ? `${def.title} (optional)` : def.title;

  if (def.type === 'boolean' && !def.options) {
    return (
      <div className="field" data-key={def.key}>
        <label className="check-field">
          <input type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
          {def.title}
        </label>
        {help}
      </div>
    );
  }

  if (def.type === 'list') {
    return (
      <fieldset className="field list-field" data-key={def.key} disabled={disabled}>
        <legend>{def.title}</legend>
        {help}
        <ListInput def={def} value={Array.isArray(value) ? value : []} onChange={onChange} />
      </fieldset>
    );
  }

  return (
    <div className={`field field-${def.type}${def.options ? ' field-options' : ''}`} data-key={def.key}>
      <label htmlFor={id}>{title}</label>
      <ValueInput
        id={id}
        def={def}
        value={value}
        onChange={onChange}
        disabled={disabled}
        invalid={invalid}
        suggestions={suggestions}
      />
      {help}
    </div>
  );
};

interface InputProps extends FieldProps {
  id?: string;
  label?: string;
}

const ValueInput = ({ id, label, def, value, onChange, disabled, invalid, suggestions }: InputProps) => {
  const listId = useId();
  const common = { id, disabled, 'aria-label': label, 'aria-invalid': invalid || undefined };

  if (def.options) {
    const known = def.options.some((o) => optionKey(o.id) === optionKey(value as never));
    return (
      <select
        {...common}
        value={optionKey(value as never)}
        onChange={(e) => onChange(def.options!.find((o) => optionKey(o.id) === e.target.value)?.id)}
      >
        {/* Keep a value that is not (or no longer) among the options visible */}
        {!known && <option value={optionKey(value as never)}>{String(value)}</option>}
        {def.options.map((o) => (
          <option key={optionKey(o.id)} value={optionKey(o.id)}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }

  const text = String(value ?? '');
  switch (def.type) {
    case 'text':
      return <textarea {...common} rows={3} value={text} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          {...common}
          type="number"
          inputMode="numeric"
          min={def.min}
          max={def.max}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'hinted_user':
      return <UserInput {...common} value={value as OfflineUser | null} onChange={onChange} />;
    default: {
      const browse = BROWSE_MODES[def.type];
      const options =
        suggestions ?? (def.type === 'hub_url' ? favorites.getSnapshot().map((hub) => hub.hub_url) : undefined);
      const input = (
        <input
          {...common}
          type={def.type === 'password' ? 'password' : def.type === 'email' ? 'email' : 'text'}
          autoComplete={def.type === 'password' ? 'new-password' : 'off'}
          autoCapitalize="off"
          spellCheck={false}
          list={options?.length ? listId : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );

      return (
        <>
          {browse ? (
            <div className="path-input">
              {input}
              {hasAccess('filesystem_view') && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={async () => {
                    const path = await browsePath(browse, text);
                    if (path !== null) {
                      onChange(path);
                    }
                  }}
                >
                  <FolderOpen size={13} /> Browse
                </button>
              )}
            </div>
          ) : (
            input
          )}
          {!!options?.length && (
            <datalist id={listId}>
              {options.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      );
    }
  }
};

const ListInput = ({ def, value, onChange }: { def: SettingDefinition; value: unknown[]; onChange: (v: unknown[]) => void }) => {
  const replace = (index: number, item: unknown) => onChange(value.map((x, i) => (i === index ? item : x)));
  const removeButton = (index: number) => (
    <button
      type="button"
      className="icon-button"
      aria-label="Remove"
      title="Remove"
      onClick={() => onChange(value.filter((_, i) => i !== index))}
    >
      <Trash2 size={13} />
    </button>
  );

  if (def.options) {
    return (
      <>
        {def.options.map((option) => (
          <label key={optionKey(option.id)} className="check-field">
            <input
              type="checkbox"
              checked={value.includes(option.id)}
              onChange={(e) =>
                onChange([
                  // Keep the order of the options
                  ...def.options!
                    .map((o) => o.id as unknown)
                    .filter((id) => (id === option.id ? e.target.checked : value.includes(id))),
                  // Selected values that aren't currently offered are not touched
                  ...value.filter((x) => !def.options!.some((o) => o.id === x)),
                ])
              }
            />
            {option.name}
          </label>
        ))}
      </>
    );
  }

  const fields = def.definitions ?? [];
  const itemDef: SettingDefinition = { ...def, type: def.item_type ?? 'string', help: undefined, definitions: undefined };
  const add = () => {
    if (def.item_type === 'struct') {
      const defaults = Object.fromEntries(fields.map((f) => [f.key, f.default_value]));
      onChange([...value, toEditValues(fields, defaults)]);
    } else {
      onChange([...value, '']);
    }
  };

  return (
    <>
      {value.map((item, index) =>
        def.item_type === 'struct' ? (
          <div key={index} className="struct-item">
            <div className="struct-fields">
              <SettingFields
                definitions={fields}
                values={item as SettingValues}
                onChange={(key, v) => replace(index, { ...(item as SettingValues), [key]: v })}
              />
            </div>
            {removeButton(index)}
          </div>
        ) : (
          <div key={index} className="list-row">
            <ValueInput label={`${def.title} ${index + 1}`} def={itemDef} value={item} onChange={(v) => replace(index, v)} />
            {removeButton(index)}
          </div>
        ),
      )}
      <button type="button" className="list-add" onClick={add}>
        <Plus size={13} /> Add
      </button>
    </>
  );
};

type OfflineUser = Pick<HintedUser, 'cid' | 'nicks' | 'hub_url'>;

/** Picks a user by searching for the nick (used by extension settings) */
const UserInput = ({
  value,
  onChange,
  ...common
}: {
  id?: string;
  disabled?: boolean;
  value: OfflineUser | null;
  onChange: (value: OfflineUser | null) => void;
}) => {
  const [pattern, setPattern] = useState('');
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!pattern.trim()) {
      setUsers([]);
      return;
    }

    let stale = false;
    const timer = setTimeout(() => {
      socket.post<OnlineUser[]>('users/search_nicks', { pattern, max_results: 10 }).then(
        (result) => !stale && setUsers(result),
        () => !stale && setUsers([]),
      );
    }, 300);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [pattern]);

  if (value) {
    return (
      <div className="list-row">
        <span className="grow">
          {value.nicks} <span className="muted">{value.hub_url}</span>
        </span>
        <button type="button" disabled={common.disabled} onClick={() => onChange(null)}>
          <X size={13} /> Clear
        </button>
      </div>
    );
  }

  return (
    <>
      <input {...common} placeholder="Search for a nick" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      {users.map((user) => (
        <button
          key={`${user.cid}|${user.hub_url}`}
          type="button"
          className="user-result"
          onClick={() => {
            onChange({ cid: user.cid, nicks: user.nick, hub_url: user.hub_url });
            setPattern('');
          }}
        >
          {user.nick} <span className="muted">{user.hub_name}</span>
        </button>
      ))}
    </>
  );
};
