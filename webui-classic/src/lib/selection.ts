// Classic list selection: click, Ctrl+click, Shift+click and the keyboard equivalents

export interface Selection {
  keys: ReadonlySet<string>;
  anchor: string | null;
  cursor: string | null;
}

export const emptySelection: Selection = { keys: new Set(), anchor: null, cursor: null };

export interface Modifiers {
  ctrl?: boolean;
  shift?: boolean;
}

export const select = (current: Selection, order: string[], key: string, modifiers: Modifiers = {}): Selection => {
  if (modifiers.shift && current.anchor !== null) {
    const a = order.indexOf(current.anchor);
    const b = order.indexOf(key);
    if (a !== -1 && b !== -1) {
      const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
      const keys = new Set(modifiers.ctrl ? [...current.keys, ...range] : range);
      return { keys, anchor: current.anchor, cursor: key };
    }
  }

  if (modifiers.ctrl) {
    const keys = new Set(current.keys);
    if (!keys.delete(key)) {
      keys.add(key);
    }

    return { keys, anchor: key, cursor: key };
  }

  return { keys: new Set([key]), anchor: key, cursor: key };
};

export const selectAll = (current: Selection, order: string[]): Selection => ({
  keys: new Set(order),
  anchor: current.anchor ?? order[0] ?? null,
  cursor: current.cursor ?? order[0] ?? null,
});

/** Next row for arrow/page/home/end keys */
export const moveCursor = (current: Selection, order: string[], delta: number, extend: boolean): Selection => {
  if (!order.length) {
    return current;
  }

  const index = current.cursor === null ? -1 : order.indexOf(current.cursor);
  const next = index === -1 ? (delta > 0 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, index + delta));
  return select(current, order, order[next], { shift: extend });
};
