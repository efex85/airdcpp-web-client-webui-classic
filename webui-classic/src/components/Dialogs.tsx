import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { closeDialog, useUi, type DialogRequest, type Field } from '../store/ui';
import { dismissToast, useApp } from '../store/app';

const initialValue = (field: Field) =>
  field.value ?? (field.type === 'boolean' ? false : field.type === 'select' ? field.options?.[0]?.value : '');

const Dialog = ({ dialog }: { dialog: DialogRequest }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(dialog.fields.map((f) => [f.key, initialValue(f)])),
  );

  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    el.querySelector<HTMLElement>('.dialog-body :is(input, select, textarea), button[type=submit]')?.focus();
    return () => el.close();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result: Record<string, any> = {};
    for (const field of dialog.fields) {
      let value = values[field.key];
      if (field.type === 'number') {
        value = value === '' ? undefined : Number(value);
      } else if (field.type === 'select') {
        value = field.options?.find((o) => String(o.value) === String(value))?.value ?? value;
      }

      result[field.key] = value;
    }

    closeDialog(dialog, result);
  };

  return (
    <dialog
      ref={ref}
      className={`dialog${dialog.wide ? ' wide-dialog' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        closeDialog(dialog, null);
      }}
    >
      <div className="dialog-title">
        <span>{dialog.title}</span>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => closeDialog(dialog, null)}>
          <X size={14} />
        </button>
      </div>
      {dialog.body ? (
        dialog.body((value) => closeDialog(dialog, value))
      ) : (
        <form onSubmit={submit}>
          <div className="dialog-body">
            {dialog.text && <p>{dialog.text}</p>}
            {dialog.fields.map((field) => {
              const id = `field-${dialog.token}-${field.key}`;
              const set = (value: unknown) => setValues((v) => ({ ...v, [field.key]: value }));
              if (field.type === 'boolean') {
                return (
                  <label key={field.key} className="check-field">
                    <input type="checkbox" checked={!!values[field.key]} onChange={(e) => set(e.target.checked)} />
                    {field.label}
                  </label>
                );
              }

              return (
                <div key={field.key} className="field">
                  <label htmlFor={id}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select id={id} value={String(values[field.key])} onChange={(e) => set(e.target.value)}>
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={id}
                      rows={4}
                      required={field.required}
                      value={values[field.key]}
                      onChange={(e) => set(e.target.value)}
                    />
                  ) : (
                    <input
                      id={id}
                      type={field.type ?? 'text'}
                      required={field.required}
                      placeholder={field.placeholder}
                      list={field.suggestions?.length ? `${id}-list` : undefined}
                      autoComplete={field.type === 'password' ? 'off' : undefined}
                      value={values[field.key]}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                  {!!field.suggestions?.length && (
                    <datalist id={`${id}-list`}>
                      {field.suggestions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  )}
                </div>
              );
            })}
          </div>
          <div className="dialog-buttons">
            <button type="submit">{dialog.confirmLabel}</button>
            {dialog.cancelLabel && (
              <button type="button" onClick={() => closeDialog(dialog, null)}>
                {dialog.cancelLabel}
              </button>
            )}
          </div>
        </form>
      )}
    </dialog>
  );
};

/** Dialogs are stacked, so that e.g. a file browser can be opened from a form that stays open */
export const DialogHost = () => {
  const dialogs = useUi((s) => s.dialogs);
  return dialogs.map((dialog) => <Dialog key={dialog.token} dialog={dialog} />);
};

export const Toasts = () => {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast${t.error ? ' error' : ''}`}
          onClick={() => {
            dismissToast(t.id);
            t.action?.();
          }}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
};
