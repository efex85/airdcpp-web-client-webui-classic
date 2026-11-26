// Semantic version comparison

const compareParts = (a: string[], b: string[], missing: number): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined || b[i] === undefined) {
      const x = a[i] === undefined ? '0' : a[i];
      const y = b[i] === undefined ? '0' : b[i];
      if (missing === 0) {
        // Release parts: 1.2 equals 1.2.0
        if (x === y) {
          continue;
        }

        return compareIdentifiers(x, y);
      }

      // Pre-release identifiers: the shorter list is the earlier version
      return a[i] === undefined ? -1 : 1;
    }

    const result = compareIdentifiers(a[i], b[i]);
    if (result) {
      return result;
    }
  }

  return 0;
};

const compareIdentifiers = (a: string, b: string): number => {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) {
    return Math.sign(Number(a) - Number(b));
  }

  if (numericA !== numericB) {
    return numericA ? -1 : 1;
  }

  return a < b ? -1 : a > b ? 1 : 0;
};

/** Negative if a is older than b */
export const compareVersions = (a: string, b: string): number => {
  const parse = (version: string) => {
    const [main] = version.trim().replace(/^v/i, '').split('+');
    const dash = main.indexOf('-');
    return {
      release: (dash === -1 ? main : main.slice(0, dash)).split('.'),
      pre: dash === -1 ? null : main.slice(dash + 1).split('.'),
    };
  };

  const x = parse(a);
  const y = parse(b);
  const release = compareParts(x.release, y.release, 0);
  if (release) {
    return release;
  }

  if (!x.pre || !y.pre) {
    // A pre-release is older than the release
    return x.pre ? -1 : y.pre ? 1 : 0;
  }

  return compareParts(x.pre, y.pre, 1);
};
