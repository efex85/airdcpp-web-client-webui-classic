// The properties of a file or folder of a file list
import { Copy } from 'lucide-react';
import { copyText } from '../actions';
import type { FilelistItem } from '../api/types';
import { formatDate, formatExactSize } from '../lib/format';
import { magnetLink } from '../lib/magnet';
import { dupeLabel } from '../lib/dupe';
import { showCustomDialog } from '../store/ui';

const Details = ({ item, close }: { item: FilelistItem; close: () => void }) => {
  const file = item.type.id === 'file';
  const rows: [string, string | undefined][] = [
    ['Name', item.name],
    ['Type/content', item.type.str],
    ['Size', formatExactSize(item.size)],
    ['Last modified', formatDate(item.time)],
    ['TTH', file ? item.tth : undefined],
    ['Dupe type', item.dupe ? dupeLabel(item.dupe) : undefined],
    ['Dupe paths', item.dupe?.paths.join('\n') || undefined],
    ['Path', item.path],
  ];

  return (
    <>
      <div className="dialog-body">
        <dl className="details">
          {rows
            .filter(([, value]) => value)
            .map(([title, value]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </div>
      <div className="dialog-buttons">
        {file && (
          <button type="button" className="left" onClick={() => void copyText(magnetLink(item))}>
            <Copy size={13} /> Copy magnet link
          </button>
        )}
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
    </>
  );
};

export const showItemDetails = (item: FilelistItem) =>
  showCustomDialog(item.name, (close) => <Details item={item} close={() => close(null)} />, true);
