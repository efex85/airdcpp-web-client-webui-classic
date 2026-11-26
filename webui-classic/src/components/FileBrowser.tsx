// Browses the files of the computer running the client
import { ArrowUp, File, Folder, FolderPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSize } from '../lib/format';
import { fsName, fsParent, fsRoot, withSeparator } from '../lib/fsPath';
import { useApp } from '../store/app';
import { socket } from '../store/session';
import { showCustomDialog } from '../store/ui';
import { hasAccess } from '../lib/access';

export type BrowseMode = 'directory' | 'file' | 'existing_file';

interface FileEntry {
  name: string;
  size?: number;
  type: { id: 'directory' | 'file' | 'drive'; str: string };
}

interface Props {
  mode: BrowseMode;
  initial: string;
  confirmLabel: string;
  close: (result: { path: string } | null) => void;
}

const Browser = ({ mode, initial, confirmLabel, close }: Props) => {
  const separator = useApp((s) => s.login?.system_info.path_separator ?? '/');
  const [directory, setDirectory] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [typed, setTyped] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [newName, setNewName] = useState<string | null>(null);
  const latest = useRef(0);

  const list = useCallback(
    async (path: string) => {
      const current = ++latest.current;
      try {
        const items = await socket.post<FileEntry[]>('filesystem/list_items', {
          path,
          directories_only: mode === 'directory',
        });
        if (current !== latest.current) {
          return true;
        }

        const isFile = (e: FileEntry) => Number(e.type.id === 'file');
        items.sort((a, b) => isFile(a) - isFile(b) || a.name.localeCompare(b.name));
        setEntries(items);
        setDirectory(path);
        setTyped(path);
        setError('');
        return true;
      } catch (e) {
        if (current === latest.current) {
          setError((e as Error).message);
        }

        return false;
      }
    },
    [mode, separator],
  );

  useEffect(() => {
    // Start from the current value; fall back to the root if it doesn't exist
    const start = async () => {
      if (initial) {
        const isDirectory = mode === 'directory' || initial.endsWith(separator);
        const path = isDirectory ? withSeparator(initial, separator) : fsParent(initial, separator);
        if (!isDirectory) {
          setFileName(fsName(initial, separator));
        }

        if (await list(path)) {
          return;
        }
      }

      await list(fsRoot(separator));
    };

    void start();
  }, [initial, mode, separator, list]);

  const open = (entry: FileEntry) => {
    if (entry.type.id === 'file') {
      setFileName(entry.name);
    } else {
      setFileName((name) => (mode === 'file' ? name : ''));
      void list(withSeparator((directory ?? '') + entry.name, separator));
    }
  };

  const createDirectory = async () => {
    const name = newName?.trim();
    if (!name || directory === null) {
      return;
    }

    const path = withSeparator(directory + name, separator);
    try {
      await socket.post('filesystem/directory', { path });
      setNewName(null);
      await list(path);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const result = mode === 'directory' ? directory : fileName ? (directory ?? '') + fileName : null;

  return (
    <>
      <div className="dialog-body browser">
        <form
          className="browser-path"
          onSubmit={(e) => {
            e.preventDefault();
            void list(withSeparator(typed, separator));
          }}
        >
          <button
            type="button"
            title="Parent directory"
            aria-label="Parent directory"
            disabled={directory === null || directory === fsRoot(separator)}
            onClick={() => void list(fsParent(directory!, separator))}
          >
            <ArrowUp size={13} />
          </button>
          <input aria-label="Directory" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button type="submit">Go</button>
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <ul className="browser-list">
          {entries.map((entry) => {
            const isFile = entry.type.id === 'file';
            return (
              <li key={entry.name}>
                <button
                  type="button"
                  aria-pressed={isFile && entry.name === fileName}
                  onClick={() => open(entry)}
                  onDoubleClick={() => isFile && close({ path: (directory ?? '') + entry.name })}
                >
                  {isFile ? <File size={14} /> : <Folder size={14} className="i-folder" />}
                  <span className="grow">{entry.name}</span>
                  {isFile && <span className="muted">{formatSize(entry.size)}</span>}
                </button>
              </li>
            );
          })}
          {directory !== null && !entries.length && <li className="muted browser-empty">Empty directory</li>}
        </ul>
        {mode !== 'directory' && (
          <div className="field">
            <label htmlFor="browser-file">File name</label>
            <input
              id="browser-file"
              value={fileName}
              readOnly={mode === 'existing_file'}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>
        )}
        {newName !== null && (
          <form
            className="browser-path"
            onSubmit={(e) => {
              e.preventDefault();
              void createDirectory();
            }}
          >
            <input
              autoFocus
              aria-label="Name of the new directory"
              placeholder="Name of the new directory"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" disabled={!newName.trim()}>
              Create
            </button>
          </form>
        )}
      </div>
      <div className="dialog-buttons">
        {mode !== 'existing_file' && hasAccess('filesystem_edit') && (
          <button
            type="button"
            className="left"
            disabled={directory === null || directory === ''}
            onClick={() => setNewName(newName === null ? '' : null)}
          >
            <FolderPlus size={13} /> New directory
          </button>
        )}
        <button type="button" disabled={!result} onClick={() => close({ path: result! })}>
          {confirmLabel}
        </button>
        <button type="button" onClick={() => close(null)}>
          Cancel
        </button>
      </div>
    </>
  );
};

/** Returns the chosen path (directories end with the separator) or null */
export const browsePath = async (
  mode: BrowseMode,
  initial = '',
  { title = mode === 'directory' ? 'Select directory' : 'Select file', confirmLabel = 'Select' } = {},
): Promise<string | null> => {
  const result = await showCustomDialog<{ path: string }>(
    title,
    (close) => <Browser mode={mode} initial={initial} confirmLabel={confirmLabel} close={close} />,
    true,
  );
  return result?.path ?? null;
};
