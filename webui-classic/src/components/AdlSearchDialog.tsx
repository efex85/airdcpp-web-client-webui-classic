// The properties of one ADL search, as in the Windows client
import { useEffect, useState, type FormEvent } from 'react';
import type { AdlSearch, AdlSizeUnit, AdlSourceType } from '../api/types';
import { DEFAULT_DESTINATION, parseSize, searchError, SIZE_UNITS, sizeText, SOURCE_TYPES } from '../lib/adl';
import { socket } from '../store/session';
import { showCustomDialog } from '../store/ui';

/** Tries a regular expression against a typed text; the client does the matching, so that the result is the same */
const RegexTester = ({ pattern, enabled }: { pattern: string; enabled: boolean }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  useEffect(() => {
    setResult('');
    if (!enabled || !pattern.trim() || !text) {
      return;
    }

    let current = true;
    const timer = setTimeout(() => {
      socket.post<{ match: boolean }>('adl/test', { pattern, regex: true, text }).then(
        (r) => current && setResult(r.match ? 'Matches' : 'No match'),
        (e) => current && setResult(e.message),
      );
    }, 250);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [pattern, enabled, text]);

  return (
    <div className="field">
      <label htmlFor="adl-test">Regular expression tester</label>
      <input
        id="adl-test"
        type="text"
        placeholder="Type a name to try"
        disabled={!enabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <span className={`adl-test-result${result === 'Matches' ? ' ok' : ''}`} role="status">
        {result}
      </span>
    </div>
  );
};

interface FormProps {
  search: AdlSearch;
  /** Resolves with the reason if the search couldn't be saved */
  save: (search: AdlSearch) => Promise<string | null>;
  close: (result: { saved: true } | null) => void;
}

const Form = ({ search, save, close }: FormProps) => {
  const [values, setValues] = useState(search);
  const [min, setMin] = useState(sizeText(search.min_size));
  const [max, setMax] = useState(sizeText(search.max_size));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Sizes and downloading only apply to searches that find files
  const files = values.source_type !== 'directory';
  const set = <K extends keyof AdlSearch>(key: K, value: AdlSearch[K]) => {
    setValues((old) => ({ ...old, [key]: value }));
    setError('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const minSize = parseSize(min);
    const maxSize = parseSize(max);
    const problem =
      searchError(values) ??
      (files && (minSize === null || maxSize === null) ? 'A size is a whole number, up to 1000000000' : null);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const failure = await save({
      ...values,
      destination: values.destination.trim(),
      // Folder searches don't use the sizes: they are kept as they were
      min_size: minSize ?? search.min_size,
      max_size: maxSize ?? search.max_size,
    });
    if (failure === null) {
      close({ saved: true });
    } else {
      setError(failure);
      setSaving(false);
    }
  };

  const help =
    values.regex
      ? 'A regular expression; it is case sensitive unless it starts with (?i).'
      : 'All the words, separated by spaces, must be found. Upper and lower case don’t matter.';

  return (
    <form onSubmit={submit} noValidate>
      <div className="dialog-body">
        <div className="field">
          <label htmlFor="adl-pattern">Search string</label>
          <input
            id="adl-pattern"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={values.pattern}
            onChange={(e) => set('pattern', e.target.value)}
          />
          <span className="field-help">
            {help}
            {values.source_type === 'full_path' && ' Folders in a full path are separated by \\.'}
          </span>
        </div>
        <label className="check-field">
          <input type="checkbox" checked={values.regex} onChange={(e) => set('regex', e.target.checked)} />
          Regular expression
        </label>
        <RegexTester pattern={values.pattern} enabled={values.regex} />
        <div className="field">
          <label htmlFor="adl-source">Source type</label>
          <select
            id="adl-source"
            value={values.source_type}
            onChange={(e) => set('source_type', e.target.value as AdlSourceType)}
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="adl-destination">Destination directory</label>
          <input
            id="adl-destination"
            type="text"
            autoComplete="off"
            placeholder={DEFAULT_DESTINATION}
            value={values.destination}
            onChange={(e) => set('destination', e.target.value)}
          />
        </div>
        <fieldset className="adl-sizes" disabled={!files}>
          <legend>File size{files ? '' : ' (not used for folders)'}</legend>
          <label>
            Min
            <input type="text" inputMode="numeric" value={min} onChange={(e) => (setMin(e.target.value), setError(''))} />
          </label>
          <label>
            Max
            <input type="text" inputMode="numeric" value={max} onChange={(e) => (setMax(e.target.value), setError(''))} />
          </label>
          <label>
            Unit
            <select value={values.size_unit} onChange={(e) => set('size_unit', e.target.value as AdlSizeUnit)}>
              {SIZE_UNITS.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <div className="field">
          <label htmlFor="adl-comment">Comment</label>
          <input id="adl-comment" type="text" value={values.comment} onChange={(e) => set('comment', e.target.value)} />
        </div>
        <label className="check-field">
          <input type="checkbox" checked={values.active} onChange={(e) => set('active', e.target.checked)} />
          Enabled
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={values.download}
            disabled={!files}
            onChange={(e) => set('download', e.target.checked)}
          />
          Download matches ({files ? 'matching files are added to the queue' : 'not used for folders'})
        </label>
      </div>
      {error && (
        <div className="dialog-error error" role="alert">
          {error}
        </div>
      )}
      <div className="dialog-buttons">
        <button type="submit" disabled={saving}>
          Save
        </button>
        <button type="button" onClick={() => close(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export const showAdlSearch = (title: string, search: AdlSearch, save: FormProps['save']) =>
  showCustomDialog<{ saved: true }>(title, (close) => <Form search={search} save={save} close={close} />);
