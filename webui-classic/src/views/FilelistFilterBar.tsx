// Laid out like the filter of the Windows client: text, column, match type, the dupe checkboxes and the options
import {
  chooseColumn,
  chooseMethod,
  FILTER_COLUMNS,
  methodsFor,
  typeText,
  type FilterColumn,
  type FilterInput,
  type FilterMethod,
} from '../lib/filelistFilter';
import { setFilterOption, useFilterOptions, type FilterOptions } from '../store/filelistFilter';
import { openMenu } from '../store/ui';

const MENU: [keyof FilterOptions, string][] = [
  ['exclude', 'Exclude matches'],
  ['onTop', 'Show above the list'],
  ['resetOnChange', 'Reset the string when switching directory'],
  ['partialDupes', 'Treat partial dupes similar to exact dupes'],
];

interface Props {
  filter: FilterInput;
  onChange: (filter: FilterInput) => void;
  invalid: boolean;
  /** Nothing is marked as shared or queued in the own list */
  own: boolean;
}

export const FilelistFilterBar = ({ filter, onChange, invalid, own }: Props) => {
  const options = useFilterOptions();

  const checkbox = (key: 'showQueued' | 'showShared', label: string) => (
    <label className="check-field" title={own ? 'Nothing is marked in your own list' : undefined}>
      <input
        type="checkbox"
        disabled={own}
        checked={options[key]}
        onChange={(e) => setFilterOption(key, e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <div className={`list-filter${options.onTop ? ' on-top' : ''}`}>
      <input
        type="search"
        placeholder={options.exclude ? 'Exclude...' : 'Filter...'}
        aria-label="Filter files"
        aria-invalid={invalid}
        value={filter.text}
        onChange={(e) => onChange(typeText(filter, e.target.value))}
      />
      <select
        className="filter-column"
        aria-label="Filter column"
        value={filter.column}
        onChange={(e) => onChange(chooseColumn(filter, e.target.value as FilterColumn))}
      >
        {FILTER_COLUMNS.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
      <select
        className="filter-method"
        aria-label="Match type"
        value={filter.method}
        onChange={(e) => onChange(chooseMethod(filter, e.target.value as FilterMethod))}
      >
        {methodsFor(filter.column).map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
      {checkbox('showQueued', 'Queued')}
      {checkbox('showShared', 'Shared')}
      <button
        type="button"
        className="filter-options"
        aria-haspopup="menu"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          openMenu(
            { x: box.left, y: box.bottom },
            MENU.map(([key, label]) => ({
              label,
              checked: options[key],
              onClick: () => setFilterOption(key, !options[key]),
            })),
            undefined,
            'Filter options',
          );
        }}
      >
        Options...
      </button>
    </div>
  );
};
