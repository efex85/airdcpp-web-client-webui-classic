export const magnetLink = (file: { name: string; tth: string; size: number }): string =>
  `magnet:?xt=urn:tree:tiger:${file.tth}&xl=${file.size}&dn=${encodeURIComponent(file.name)}`;
