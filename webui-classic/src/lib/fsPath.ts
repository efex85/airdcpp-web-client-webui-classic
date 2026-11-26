// Paths of the computer running the client; the separator depends on its platform

/** The topmost directory: "/" or the drive list (empty path) on Windows */
export const fsRoot = (separator: string): string => (separator === '/' ? '/' : '');

export const withSeparator = (path: string, separator: string): string =>
  !path || path.endsWith(separator) ? path : path + separator;

export const fsParent = (path: string, separator: string): string => {
  const trimmed = path.endsWith(separator) ? path.slice(0, -1) : path;
  const end = trimmed.lastIndexOf(separator);
  return end === -1 ? fsRoot(separator) : trimmed.slice(0, end + 1);
};

/** Name of the file or directory, used for suggested directory names */
export const fsName = (path: string, separator: string): string => {
  const trimmed = path.endsWith(separator) ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf(separator) + 1);
};
