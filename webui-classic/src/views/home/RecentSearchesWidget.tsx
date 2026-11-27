// The words that were searched for last
import { Search } from 'lucide-react';
import { openSearch } from '../../actions';
import { useAccess } from '../../lib/access';
import { recentSearches, SEARCH_HISTORY_PATH } from '../../lib/searchHistory';
import { useWidgetData } from './useWidgetData';

export const RecentSearchesWidget = ({ active }: { active: boolean }) => {
  const access = useAccess();
  const { data, error } = useWidgetData<string[]>(SEARCH_HISTORY_PATH, active);

  return (
    <div className="widget-scroll">
      {error && (
        <div className="error widget-message" role="alert">
          {error}
        </div>
      )}
      {data && !data.length && <div className="muted widget-message">No searches yet</div>}
      <ul className="recent">
        {data &&
          recentSearches(data).map((pattern) => (
            <li key={pattern}>
              <button
                type="button"
                className="recent-search"
                disabled={!access('search')}
                title={`Search for “${pattern}” again`}
                onClick={() => openSearch({ pattern })}
              >
                <Search size={13} />
                <span className="recent-name">{pattern}</span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};
