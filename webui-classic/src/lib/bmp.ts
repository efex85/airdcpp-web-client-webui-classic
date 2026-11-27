// Transparency of the BMP pictures of emoticon packs, handled like the Windows client does: 32-bit pictures have
// their own transparency, in all others the color of the top left pixel is the transparent one.

export interface Pixels {
  width: number;
  height: number;
  /** Red, green, blue and alpha of every pixel, row by row from the top */
  data: Uint8ClampedArray;
}

export interface BmpHeader {
  width: number;
  height: number;
  bits: number;
  compression: number;
  /** Where the pixels start */
  offset: number;
  topDown: boolean;
}

const MAX_SIZE = 256;

export const readBmpHeader = (data: ArrayBuffer): BmpHeader | null => {
  if (data.byteLength < 54) {
    return null;
  }

  const view = new DataView(data);
  if (view.getUint16(0, true) !== 0x4d42 || view.getUint32(14, true) < 40) {
    return null;
  }

  const width = view.getInt32(18, true);
  const height = view.getInt32(22, true);
  return {
    width,
    height: Math.abs(height),
    bits: view.getUint16(28, true),
    compression: view.getUint32(30, true),
    offset: view.getUint32(10, true),
    topDown: height < 0,
  };
};

/**
 * The pixels of an uncompressed 32-bit picture including their transparency, which browsers don't all keep.
 * Null for other pictures, and for those that don't use the transparency (every pixel would be invisible).
 */
export const decodeAlphaBmp = (data: ArrayBuffer): Pixels | null => {
  const header = readBmpHeader(data);
  if (!header || header.bits !== 32 || header.compression !== 0) {
    return null;
  }

  const { width, height, offset, topDown } = header;
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE || offset + width * height * 4 > data.byteLength) {
    return null;
  }

  const source = new Uint8Array(data, offset, width * height * 4);
  const pixels = new Uint8ClampedArray(source.length);
  let visible = false;
  for (let y = 0; y < height; y++) {
    const row = (topDown ? y : height - 1 - y) * width * 4;
    for (let x = 0; x < width * 4; x += 4) {
      const from = row + x;
      const to = y * width * 4 + x;
      pixels[to] = source[from + 2]!;
      pixels[to + 1] = source[from + 1]!;
      pixels[to + 2] = source[from]!;
      pixels[to + 3] = source[from + 3]!;
      visible ||= source[from + 3] !== 0;
    }
  }

  return visible ? { width, height, data: pixels } : null;
};

/** Makes every pixel that has the color of the top left one transparent */
export const keyOutCorner = ({ data }: Pixels) => {
  const [r, g, b] = data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === r && data[i + 1] === g && data[i + 2] === b) {
      data[i + 3] = 0;
    }
  }
};
