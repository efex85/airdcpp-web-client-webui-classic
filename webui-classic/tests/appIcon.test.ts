import { describe, expect, it } from 'vitest';
import { fitSquare, ICON_SIZE, iconSide, isIcon, MAX_ICON_LENGTH, sanitizeAppIcon } from '../src/lib/appIcon';

const png = 'data:image/png;base64,iVBORw0KGgo=';

describe('the stored icon', () => {
  it('is a PNG data address', () => {
    expect(isIcon(png)).toBe(true);
    expect(sanitizeAppIcon({ image: png })).toEqual({ image: png });
  });

  it('is the standard one for anything else', () => {
    const others = [
      undefined,
      null,
      'text',
      42,
      {},
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
      expect(sanitizeAppIcon(value)).toEqual({ image: '' });
    }
  });

  it('fits the room that the client has for one item', () => {
    const longest = `data:image/png;base64,${'A'.repeat(MAX_ICON_LENGTH - 22)}`;
    expect(isIcon(longest)).toBe(true);
    expect(JSON.stringify({ image: longest }).length).toBeLessThan(256 * 1024);
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
