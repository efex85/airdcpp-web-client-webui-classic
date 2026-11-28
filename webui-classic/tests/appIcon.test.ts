import { describe, expect, it } from 'vitest';
import {
  fitSquare,
  ICON_SIZE,
  iconSide,
  isIcon,
  MAX_ICON_LENGTH,
  pngSize,
  sanitizeAppIcon,
  webManifest,
} from '../src/lib/appIcon';

const png = 'data:image/png;base64,iVBORw0KGgo=';

const standard = { choice: 'default', image: '' };

describe('the stored icon', () => {
  it('is a PNG data address', () => {
    expect(isIcon(png)).toBe(true);
    expect(sanitizeAppIcon({ choice: 'own', image: png })).toEqual({ choice: 'own', image: png });
  });

  it('keeps the picture while another icon is chosen', () => {
    expect(sanitizeAppIcon({ choice: 'default', image: png })).toEqual({ choice: 'default', image: png });
    expect(sanitizeAppIcon({ choice: 'dark', image: png })).toEqual({ choice: 'dark', image: png });
    expect(sanitizeAppIcon({ choice: 'dark', image: '' })).toEqual({ choice: 'dark', image: '' });
  });

  it('of an earlier version, with only a picture, is that picture', () => {
    expect(sanitizeAppIcon({ image: png })).toEqual({ choice: 'own', image: png });
    expect(sanitizeAppIcon({ image: '' })).toEqual(standard);
  });

  it('is the default one for anything else', () => {
    const others = [
      undefined,
      null,
      'text',
      42,
      {},
      { choice: 'own' },
      { choice: 'blue' },
      { choice: 'own', image: '' },
      { image: 42 },
      { image: 'http://example.com/icon.png' },
      { image: 'javascript:alert(1)' },
      { image: 'data:image/svg+xml,<svg/>' },
      { image: 'data:image/png;base64,' },
      { image: 'data:image/png;base64,a b' },
      { image: `${png}"><script>` },
      { image: `data:image/png;base64,${'A'.repeat(MAX_ICON_LENGTH)}` },
    ];
    for (const value of others) {
      expect(sanitizeAppIcon(value)).toEqual(standard);
    }
  });

  it('fits the room that the client has for one item', () => {
    const longest = `data:image/png;base64,${'A'.repeat(MAX_ICON_LENGTH - 22)}`;
    expect(isIcon(longest)).toBe(true);
    expect(JSON.stringify({ choice: 'default', image: longest }).length).toBeLessThan(256 * 1024);
  });
});

describe('sizes', () => {
  it('makes large pictures 192 pixels', () => {
    expect(iconSide(4000, 3000)).toBe(192);
    expect(iconSide(192, 192)).toBe(192);
  });

  it('does not enlarge small pictures', () => {
    expect(iconSide(100, 80)).toBe(100);
    expect(iconSide(16, 16)).toBe(16);
    expect(iconSide(64, 10)).toBe(64);
  });

  it('has room for a PNG of the full size that can not be compressed', () => {
    // Four bytes a pixel and one a row, with something for the structure of the file, as base64 text
    const bytes = ICON_SIZE * (ICON_SIZE * 4 + 1) + 1000;
    expect(Math.ceil(bytes / 3) * 4 + 22).toBeLessThan(MAX_ICON_LENGTH);
  });

  it('keeps the proportions and centres the picture', () => {
    expect(fitSquare(100, 100, 192)).toEqual({ x: 0, y: 0, width: 192, height: 192 });
    expect(fitSquare(400, 200, 192)).toEqual({ x: 0, y: 48, width: 192, height: 96 });
    expect(fitSquare(50, 200, 64)).toEqual({ x: 24, y: 0, width: 16, height: 64 });
    // Never nothing at all
    expect(fitSquare(10000, 1, 64)).toEqual({ x: 0, y: 32, width: 64, height: 1 });
  });
});

describe('the web app manifest', () => {
  const read = (address: string) => {
    const prefix = 'data:application/manifest+json,';
    expect(address.startsWith(prefix)).toBe(true);
    return JSON.parse(decodeURIComponent(address.slice(prefix.length)));
  };

  it('names the web UI, its address and the icon', () => {
    const start = 'http://nas.lan:5600/airdcpp/';
    expect(read(webManifest(start, { src: `${start}assets/default.png`, width: 225, height: 225 }))).toEqual({
      name: 'AirDC++ Classic',
      short_name: 'AirDC++',
      start_url: start,
      scope: start,
      icons: [{ src: `${start}assets/default.png`, sizes: '225x225', type: 'image/png' }],
    });
  });

  it('states no size that it does not know', () => {
    expect(read(webManifest('http://a/', { src: png, width: 0, height: 0 })).icons).toEqual([
      { src: png, type: 'image/png' },
    ]);
  });

  it('can be an address whatever the picture and the path contain', () => {
    const address = webManifest('http://a/%23 x/', { src: `${png}#?&`, width: 1, height: 1 });
    expect(address).not.toMatch(/[# ?]/);
    expect(read(address).icons[0].src).toBe(`${png}#?&`);
  });

  it('reads the size of a picture from its header', () => {
    // The first bytes of PNG files of 192 x 192 and 300 x 7 pixels
    const header = (width: number, height: number) => {
      const bytes = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
      for (const value of [width, height]) {
        bytes.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
      }

      return `data:image/png;base64,${btoa(String.fromCharCode(...bytes, 8, 6, 0, 0, 0))}`;
    };
    expect(pngSize(header(192, 192))).toEqual({ width: 192, height: 192 });
    expect(pngSize(header(300, 7))).toEqual({ width: 300, height: 7 });
    expect(pngSize(png)).toEqual({ width: 0, height: 0 });
    expect(pngSize('data:image/png;base64,!!!')).toEqual({ width: 0, height: 0 });
  });
});
