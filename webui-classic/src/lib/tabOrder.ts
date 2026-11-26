// The order of the tabs after they have been rearranged by dragging
import type { HubSession } from '../api/types';

/**
 * Identifies a window across sessions. Hubs get a new ID when the client is restarted, so their address is
 * used instead.
 */
export const savedTabId = (key: string, hubs: Pick<HubSession, 'id' | 'hub_url'>[]): string => {
  const hub = key.startsWith('hub:') ? hubs.find((h) => `hub:${h.id}` === key) : undefined;
  return hub ? `hub:${hub.hub_url}` : key;
};

/** The list with the item moved to the given position (the same list if nothing changes) */
export const moveItem = <T,>(items: T[], item: T, index: number): T[] => {
  const from = items.indexOf(item);
  const to = Math.max(0, Math.min(index, items.length - 1));
  if (from === -1 || from === to) {
    return items;
  }

  const result = items.filter((x) => x !== item);
  result.splice(to, 0, item);
  return result;
};

/**
 * Puts the windows in the saved order. Windows without a saved position keep their order at the end, except
 * Home and the system log, which go to their usual places at the beginning.
 */
export const orderTabs = (tabs: string[], saved: string[], idOf: (key: string) => string): string[] => {
  const position = new Map(saved.map((id, index) => [id, index]));
  const known = tabs.filter((key) => position.has(idOf(key)));
  known.sort((a, b) => position.get(idOf(a))! - position.get(idOf(b))!);

  const result = [...known, ...tabs.filter((key) => !position.has(idOf(key)))];
  const place = (key: string, index: number) => {
    if (tabs.includes(key) && !position.has(idOf(key))) {
      result.splice(result.indexOf(key), 1);
      result.splice(index, 0, key);
    }
  };

  place('home', 0);
  place('syslog', result.indexOf('home') + 1);
  return result;
};

/**
 * The order to save: the open windows as they are shown. Hubs that aren't open keep their place after the
 * window that preceded them, so that they return to it when connected again.
 */
export const mergeOrder = (saved: string[], open: string[]): string[] => {
  const result = [...open];
  let previous: string | null = null;
  for (const id of saved) {
    if (result.includes(id)) {
      previous = id;
    } else if (id.startsWith('hub:')) {
      result.splice(previous === null ? 0 : result.indexOf(previous) + 1, 0, id);
      previous = id;
    }
  }

  return result;
};

/**
 * Where to add a window that has a saved place: after the open window that preceded it, or else before the
 * one that followed it. The end of the list without a saved place.
 */
export const savedIndex = (open: string[], saved: string[], id: string): number => {
  const position = saved.indexOf(id);
  if (position !== -1) {
    for (let i = position - 1; i >= 0; i--) {
      const index = open.indexOf(saved[i]!);
      if (index !== -1) {
        return index + 1;
      }
    }

    for (let i = position + 1; i < saved.length; i++) {
      const index = open.indexOf(saved[i]!);
      if (index !== -1) {
        return index;
      }
    }
  }

  return open.length;
};
