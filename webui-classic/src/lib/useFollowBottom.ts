import { useEffect, useLayoutEffect, useRef, type UIEvent } from 'react';

/** Keeps a log scrolled to the bottom when content arrives, unless the user has scrolled up */
export const useFollowBottom = <T extends HTMLElement>(content: unknown) => {
  const ref = useRef<T>(null);
  const follow = useRef(true);

  const toBottom = () => {
    const el = ref.current;
    if (el && follow.current) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useLayoutEffect(toBottom, [content]);
  useEffect(() => {
    const observer = new ResizeObserver(toBottom);
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);

  const onScroll = (e: UIEvent<T>) => {
    const el = e.currentTarget;
    follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  return {
    ref,
    onScroll,
    follow: () => {
      follow.current = true;
      toBottom();
    },
  };
};
