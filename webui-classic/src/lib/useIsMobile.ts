import { useSyncExternalStore } from 'react';

// Keep in sync with the media query in styles.css
const query = window.matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)');

export const useIsMobile = (): boolean =>
  useSyncExternalStore(
    (onChange) => {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => query.matches,
  );

export const isMobile = () => query.matches;
