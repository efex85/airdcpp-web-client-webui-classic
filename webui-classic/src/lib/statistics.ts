export const average = (sum: number, count: number): string => (count > 0 ? sum / count : 0).toFixed(2);

export const percentage = (part: number, total: number): string =>
  `${(total > 0 ? (part / total) * 100 : 0).toFixed(2)} %`;

const BIT_UNITS = ['bit/s', 'Kbit/s', 'Mbit/s', 'Gbit/s'];

/** Connection speeds are given in bytes per second and shown in bits; empty if unknown */
export const formatBitRate = (bytesPerSecond: number): string => {
  if (!(bytesPerSecond > 0)) {
    return '';
  }

  let value = bytesPerSecond * 8;
  let unit = 0;
  while (value >= 1000 && unit < BIT_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }

  return `${unit === 0 ? value : value.toFixed(2)} ${BIT_UNITS[unit]}`;
};
