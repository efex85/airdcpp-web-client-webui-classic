import { useEffect } from 'react';
import { runShortcut } from '../actions/shortcuts';
import { shortcutsDoc } from '../store/docs';
import { closeMenu, useUi } from '../store/ui';
import { combinationOf, findShortcut } from './shortcuts';

/** MouseEvent.button of the two thumb buttons */
const THUMB_BUTTONS: Record<number, 'back' | 'forward'> = { 3: 'back', 4: 'forward' };

/** The field of the settings page that records a shortcut handles its own keys and buttons */
const isRecording = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('[data-recording="true"]');

const dialogOpen = () => useUi.getState().dialogs.length > 0;

const run = (id: string) => {
  closeMenu();
  runShortcut(id);
};

/** Listens for the shortcuts while the main window is shown */
export const useShortcuts = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || isRecording(e.target)) {
        return;
      }

      const action = findShortcut(shortcutsDoc.value, 'key', combinationOf(e));
      // A dialog has to be answered first
      if (!action || dialogOpen()) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat || action.repeat) {
        run(action.id);
      }
    };

    // The browser would go back or forward in its history: that is prevented for the buttons that are in use
    const onButton = (e: MouseEvent) => {
      const button = THUMB_BUTTONS[e.button];
      if (!button || isRecording(e.target)) {
        return;
      }

      const action = findShortcut(shortcutsDoc.value, 'mouse', button);
      if (!action) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'mouseup' && !dialogOpen()) {
        run(action.id);
      }
    };

    const buttonEvents = ['mousedown', 'mouseup', 'auxclick'] as const;
    window.addEventListener('keydown', onKey, true);
    buttonEvents.forEach((type) => window.addEventListener(type, onButton, true));
    return () => {
      window.removeEventListener('keydown', onKey, true);
      buttonEvents.forEach((type) => window.removeEventListener(type, onButton, true));
    };
  }, []);
};
