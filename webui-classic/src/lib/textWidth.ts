// How wide texts are in a font, without putting them on the page

const cache = new Map<string, number>();
/** The cache starts over when it has this many texts */
const CACHE_SIZE = 50_000;

let context: CanvasRenderingContext2D | null | undefined;

const widthOf = (text: string, font: string): number => {
  const key = `${font}\n${text}`;
  let width = cache.get(key);
  if (width === undefined) {
    context ??= document.createElement('canvas').getContext('2d');
    if (!context) {
      return 0;
    }

    context.font = font;
    width = context.measureText(text).width;
    if (cache.size >= CACHE_SIZE) {
      cache.clear();
    }

    cache.set(key, width);
  }

  return width;
};

/** The font of an element, as a canvas takes it */
export const fontOf = (element: Element): string => {
  const style = getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
};

/** Width in pixels of the widest of the items, where an item may consist of several texts side by side */
export const widest = <T>(items: T[], texts: (item: T) => string[], font: string, gap = 0): number => {
  let result = 0;
  for (const item of items) {
    let width = -gap;
    for (const text of texts(item)) {
      width += widthOf(text, font) + gap;
    }

    result = Math.max(result, width);
  }

  return Math.ceil(result);
};
