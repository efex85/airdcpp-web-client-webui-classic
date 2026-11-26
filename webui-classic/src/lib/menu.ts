/** Removes separators at the ends and repeated ones, left behind by entries that don't apply */
export const tidySeparators = <T,>(items: T[]): T[] => {
  const result = items.filter((item, i) => item !== 'separator' || (i > 0 && items[i - 1] !== 'separator'));
  return result[result.length - 1] === 'separator' ? result.slice(0, -1) : result;
};
