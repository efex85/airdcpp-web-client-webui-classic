// Turns a picture file chosen by the user into an icon

import { fitSquare, ICON_SIZE, iconSide, isIcon } from './appIcon';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const UNREADABLE = 'This file can’t be used. Choose a picture that your browser can show, such as a PNG file.';

/**
 * A vector picture is drawn in the size that it states, which may be tiny or missing (some browsers then draw
 * nothing). It is given the size of the icon instead.
 */
const sizedSvg = async (file: File): Promise<Blob> => {
  const document = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
  const svg = document.documentElement;
  if (svg.localName !== 'svg') {
    throw new Error(UNREADABLE);
  }

  let box = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || !(box[2]! > 0) || !(box[3]! > 0)) {
    const width = parseFloat(svg.getAttribute('width') ?? '');
    const height = parseFloat(svg.getAttribute('height') ?? '');
    if (!(width > 0) || !(height > 0)) {
      return file;
    }

    box = [0, 0, width, height];
    svg.setAttribute('viewBox', box.join(' '));
  }

  const { width, height } = fitSquare(box[2]!, box[3]!, ICON_SIZE);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  return new Blob([new XMLSerializer().serializeToString(document)], { type: 'image/svg+xml' });
};

const loadImage = (source: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();
    const done = (finish: () => void) => {
      URL.revokeObjectURL(url);
      finish();
    };
    image.onload = () => done(() => resolve(image));
    image.onerror = () => done(() => reject(new Error(UNREADABLE)));
    image.src = url;
  });

const draw = (image: HTMLImageElement, side: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(UNREADABLE);
  }

  context.imageSmoothingQuality = 'high';
  const place = fitSquare(image.naturalWidth, image.naturalHeight, side);
  context.drawImage(image, place.x, place.y, place.width, place.height);
  return canvas.toDataURL('image/png');
};

/** The picture as a square PNG data address that is small enough to be stored */
export const readIcon = async (file: File): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('The file is larger than 10 MB.');
  }

  const vector = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const image = await loadImage(vector ? await sizedSvg(file) : file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error(UNREADABLE);
  }

  const icon = draw(image, vector ? ICON_SIZE : iconSide(image.naturalWidth, image.naturalHeight));
  if (!isIcon(icon)) {
    throw new Error(UNREADABLE);
  }

  return icon;
};
