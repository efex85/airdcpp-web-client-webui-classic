// The sizes of the widgets of the Home window on large screens. They are stored in each browser.

import type { Widget, WidgetType } from './widgets';

export interface WidgetSize {
  /** Width in steps of a quarter of a normal box (missing: a normal box) */
  w?: number;
  /** Height in pixels (missing: `rows` normal boxes) */
  h?: number;
  /** One of the preset heights */
  rows?: number;
  /** System information: how high the other boxes were when this one got its own height */
  others?: number;
}

export type WidgetSizes = Record<string, WidgetSize>;

/** The space between boxes */
export const GAP = 8;
/** The boxes are placed in rows of this height, so a height changes in steps of it */
export const ROW = 10;
/** Steps in the width of a normal box */
export const BOX_UNITS = 4;
export const MIN_UNITS = 2;
/** The tables of System information need more room than lists and notes */
export const minUnits = (type: WidgetType): number => (type === 'stats' ? 3 : MIN_UNITS);
/** A window has as many normal boxes side by side as fit with at least this width */
export const MIN_BOX_WIDTH = 380;
/** The height of a normal box at the normal text size */
export const NORMAL_HEIGHT = 340;
const MIN_HEIGHT = 112;
const MAX_HEIGHT = 3992;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** The number of width steps of a grid of this width, without its padding */
export const columnCount = (width: number): number =>
  Math.max(1, Math.floor((width + GAP) / (MIN_BOX_WIDTH + GAP))) * BOX_UNITS;

/** A height that fills a whole number of rows, including the space below the box */
export const snapHeight = (height: number): number =>
  clamp(Math.round((height + GAP) / ROW) * ROW - GAP, MIN_HEIGHT, MAX_HEIGHT);

export const rowSpan = (height: number): number => Math.ceil((height + GAP) / ROW);

/** The height of a normal box: at least `minimum`, in whole rows */
export const normalHeight = (minimum: number): number => rowSpan(minimum) * ROW - GAP;

export const clampWidth = (units: number, columns: number, min = MIN_UNITS): number =>
  clamp(units, Math.min(min, columns), columns);

/** Without a size of its own, a widget starts with the height that earlier versions saved for all devices */
export const sizeOf = (sizes: WidgetSizes, widget: Widget): WidgetSize =>
  sizes[widget.id] ?? (widget.rows ? { rows: widget.rows } : {});

/** A box that is wider than the window is as wide as the window; its own width comes back in a wider one */
export const widthUnits = (size: WidgetSize, columns: number, min = MIN_UNITS): number =>
  clampWidth(size.w ?? BOX_UNITS, columns, min);

export const heightPixels = (size: WidgetSize, normal: number): number =>
  size.h ?? (size.rows ?? 1) * (normal + GAP) - GAP;

export const isNormalSize = (size: WidgetSize): boolean =>
  size.w === undefined && size.h === undefined && (size.rows ?? 1) === 1;

export const sanitizeSizes = (value: unknown): WidgetSizes => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const whole = (n: unknown, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? clamp(Math.round(n), min, max) : undefined;

  return Object.fromEntries(
    Object.entries(value).flatMap(([id, item]) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const entries = [
        ['w', whole((item as WidgetSize).w, MIN_UNITS, 400)],
        ['h', whole((item as WidgetSize).h, MIN_HEIGHT, MAX_HEIGHT)],
        ['rows', whole((item as WidgetSize).rows, 1, 3)],
        ['others', whole((item as WidgetSize).others, MIN_HEIGHT, MAX_HEIGHT)],
      ].filter(([, n]) => n !== undefined);
      return [[id, Object.fromEntries(entries) as WidgetSize]];
    }),
  );
};
