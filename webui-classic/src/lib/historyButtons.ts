// Firefox on a computer doesn't give the thumb buttons of the mouse to web pages before version 162: it only goes
// back or forward in its history. To catch that, an entry is added on each side of the page's own one, and the page
// returns to the middle every time one of them is reached.

import type { ThumbButton } from './shortcuts';

export const needsHistoryButtons = (userAgent: string): boolean => {
  const version = /\bFirefox\/(\d+)/.exec(userAgent)?.[1];
  return !!version && Number(version) < 162 && !/Android|Mobile|Tablet/.test(userAgent);
};

type Place = -1 | 0 | 1;

const KEY = 'airdcppThumb';

const placeOf = (state: unknown): Place | undefined => (state as { [KEY]?: Place } | null)?.[KEY];

/** Set by a field that records a shortcut: it gets the next button */
let recorder: ((button: ThumbButton) => void) | null = null;

export const recordHistoryButton = (take: (button: ThumbButton) => void) => {
  recorder = take;
  return () => {
    if (recorder === take) {
      recorder = null;
    }
  };
};

/** The entries have been added since the page was loaded */
let added = false;

interface Options {
  /** Thumb buttons are switched on */
  wanted: () => boolean;
  /** Returns false when the button has no use, so that the browser can go on as usual */
  press: (button: ThumbButton) => boolean;
}

export const catchHistoryButtons = ({ wanted, press }: Options) => {
  const addEntries = () => {
    if (!wanted() || (added && placeOf(history.state) !== undefined)) {
      return;
    }

    // Browsers skip entries added by a page that the user hasn't clicked or typed in
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      return;
    }

    added = true;
    history.replaceState({ [KEY]: -1 }, '');
    history.pushState({ [KEY]: 0 }, '');
    history.pushState({ [KEY]: 1 }, '');
    history.back();
  };

  // After the browser has noted the click or key press
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(addEntries);
  };

  const onPopState = (e: PopStateEvent) => {
    const place = placeOf(e.state);
    if (!place) {
      return;
    }

    const button = place === -1 ? 'back' : 'forward';
    let used = false;
    if (recorder) {
      recorder(button);
      used = true;
    } else if (wanted()) {
      used = press(button);
    }

    if (place === 1) {
      history.back();
    } else if (used) {
      history.forward();
    } else {
      // Leave the page, as the user asked for
      history.back();
    }
  };

  const events = ['pointerup', 'keyup'] as const;
  events.forEach((type) => window.addEventListener(type, later, true));
  window.addEventListener('popstate', onPopState);
  later();
  return () => {
    clearTimeout(timer);
    events.forEach((type) => window.removeEventListener(type, later, true));
    window.removeEventListener('popstate', onPopState);
  };
};
