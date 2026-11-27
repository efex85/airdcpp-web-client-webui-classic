// Context menus and dialogs
import { create } from 'zustand';
import type { ReactNode } from 'react';

export type MenuEntry =
  | 'separator'
  | {
      label: string;
      icon?: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      checked?: boolean;
      /** The keyboard shortcut that does the same, e.g. "Alt+N" */
      keys?: string;
      /** The default action (same as double-click) */
      bold?: boolean;
      children?: MenuEntry[];
      /** A submenu whose entries are fetched when it's opened */
      load?: () => Promise<MenuEntry[]>;
      /** Title of the entries below it; can't be chosen */
      heading?: boolean;
      /** Show a long label on several lines instead of cutting it off */
      wrap?: boolean;
    };

export interface ContextMenuState {
  token: number;
  x: number;
  y: number;
  title?: string;
  items: MenuEntry[];
  loading: boolean;
}

export interface Field {
  key: string;
  label: string;
  type?: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea';
  value?: unknown;
  options?: { value: string | number; label: string }[];
  suggestions?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface DialogRequest {
  token: number;
  title: string;
  text?: string;
  fields: Field[];
  confirmLabel: string;
  cancelLabel: string | null;
  /** Custom content; it draws its own buttons and closes the dialog with the given function */
  body?: (close: (values: Record<string, any> | null) => void) => ReactNode;
  wide?: boolean;
  resolve: (values: Record<string, any> | null) => void;
}

interface UiState {
  menu: ContextMenuState | null;
  dialogs: DialogRequest[];
}

export const useUi = create<UiState>(() => ({ menu: null, dialogs: [] }));

let token = 0;

export interface MenuPosition {
  x: number;
  y: number;
}

/** Entries from the daemon (hub commands, extensions) are appended when they arrive */
export const openMenu = (
  position: MenuPosition,
  items: MenuEntry[],
  more?: () => Promise<MenuEntry[]>,
  title?: string,
) => {
  const current = ++token;
  useUi.setState({ menu: { token: current, x: position.x, y: position.y, items, title, loading: !!more } });

  more?.()
    .catch(() => [] as MenuEntry[])
    .then((extra) => {
      useUi.setState((s) => {
        if (s.menu?.token !== current) {
          return s;
        }

        const separator: MenuEntry[] = extra.length && s.menu.items.length ? ['separator'] : [];
        return { menu: { ...s.menu, items: [...s.menu.items, ...separator, ...extra], loading: false } };
      });
    });
};

export const closeMenu = () => useUi.setState({ menu: null });

export const showDialog = (
  options: Pick<DialogRequest, 'title'> & Partial<Omit<DialogRequest, 'resolve' | 'token'>>,
): Promise<Record<string, any> | null> =>
  new Promise((resolve) => {
    const dialog: DialogRequest = {
      fields: [],
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
      ...options,
      token: ++token,
      resolve,
    };
    useUi.setState((s) => ({ dialogs: [...s.dialogs, dialog] }));
  });

export const closeDialog = (dialog: DialogRequest, values: Record<string, any> | null) => {
  useUi.setState((s) => ({ dialogs: s.dialogs.filter((d) => d !== dialog) }));
  dialog.resolve(values);
};

/** Dialog with its own content; resolves with the value given to close() */
export const showCustomDialog = <T extends Record<string, any>>(
  title: string,
  body: (close: (value: T | null) => void) => ReactNode,
  wide = false,
): Promise<T | null> => showDialog({ title, body: body as DialogRequest['body'], wide }) as Promise<T | null>;

export const confirm = async (title: string, text: string, confirmLabel = 'Yes'): Promise<boolean> =>
  (await showDialog({ title, text, confirmLabel, cancelLabel: 'No' })) !== null;
