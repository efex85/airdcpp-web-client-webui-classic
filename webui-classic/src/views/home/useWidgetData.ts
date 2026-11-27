// The lists of the Recent PMs and Recent searches widgets
import { useEffect, useState } from 'react';
import { useApp } from '../../store/app';
import { socket } from '../../store/session';

const INTERVAL = 30_000;

/**
 * Loaded when the window is shown, repeatedly while it's shown (another device may add to the list),
 * and when `version` changes. null: not loaded yet.
 */
export const useWidgetData = <T,>(path: string, active: boolean, version = '') => {
  const generation = useApp((s) => s.generation);
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: '' });

  useEffect(() => {
    if (!active) {
      return;
    }

    let current = true;
    const load = () =>
      void socket.get<T>(path).then(
        (data) => current && setState({ data, error: '' }),
        (e: Error) => current && setState((old) => ({ ...old, error: `Loading failed: ${e.message}` })),
      );
    load();
    const timer = setInterval(load, INTERVAL);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [path, active, version, generation]);

  return state;
};
