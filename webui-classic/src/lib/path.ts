// ADC paths: "/dir/sub/" for directories, "/dir/file" for files

export const parentPath = (path: string): string => {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.slice(0, trimmed.lastIndexOf('/') + 1) || '/';
};

export const lastSegment = (path: string): string => {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
};

/** "/a/b/" -> ["/", "/a/", "/a/b/"] */
export const pathChain = (path: string): string[] => {
  const ret = ['/'];
  let current = '/';
  for (const part of path.split('/').filter(Boolean)) {
    current += `${part}/`;
    ret.push(current);
  }

  return ret;
};
