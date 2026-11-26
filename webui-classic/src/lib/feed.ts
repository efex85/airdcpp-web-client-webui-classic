// RSS and Atom feeds

export interface FeedEntry {
  key: string;
  title: string;
  /** Empty if the entry has no web address */
  link: string;
  /** Unix time */
  date: number | null;
}

export interface Feed {
  title: string;
  entries: FeedEntry[];
}

const MAX_ENTRIES = 100;

/** "&nbsp;" and other entities that HTML knows */
const decodeEntities = (text: string): string =>
  text.replace(/&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, (entity) => {
    // A single entity can't introduce any markup
    const element = document.createElement('textarea');
    element.innerHTML = entity;
    return element.value;
  });

/** Corrects the errors that are common in feeds, as the XML parser of the browser refuses the whole document */
export const repairXml = (xml: string): string =>
  xml
    .trim()
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            // Entities of HTML
            .replace(/&(?!(?:amp|lt|gt|quot|apos);)([a-z][a-z\d]*);/gi, (entity) => {
              const text = decodeEntities(entity);
              return text === entity ? `&amp;${entity.slice(1)}` : [...text].map((c) => `&#${c.codePointAt(0)};`).join('');
            })
            // "&" on its own
            .replace(/&(?!#\d+;|#x[\da-f]+;|[a-z][a-z\d]*;)/gi, '&amp;'),
    )
    .join('');

const parse = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return document.getElementsByTagName('parsererror').length ? null : document;
};

const children = (parent: Element, name: string) => [...parent.children].filter((c) => c.localName === name);
const child = (parent: Element, ...names: string[]) =>
  names.map((name) => children(parent, name)[0]).find((c) => !!c);

const text = (parent: Element, ...names: string[]) => (child(parent, ...names)?.textContent ?? '').trim();
const label = (value: string) => decodeEntities(value).replace(/\s+/g, ' ').trim();

/** Only web addresses are opened; relative ones are relative to the feed */
export const webAddress = (address: string, base: string): string => {
  if (!address) {
    return '';
  }

  try {
    const url = new URL(address, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

const entryLink = (entry: Element, atom: boolean) => {
  if (atom) {
    const links = children(entry, 'link');
    const link = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0];
    return link?.getAttribute('href')?.trim() ?? '';
  }

  const guid = child(entry, 'guid');
  const permanent = guid && guid.getAttribute('isPermaLink') !== 'false' ? guid.textContent!.trim() : '';
  return text(entry, 'link') || (/^https?:\/\//i.test(permanent) ? permanent : '');
};

export const parseFeed = (source: string, feedUrl: string): Feed => {
  const document = parse(source.trim()) ?? parse(repairXml(source));
  if (!document) {
    throw new Error('Invalid feed: the document is not valid XML');
  }

  const root = document.documentElement;
  const atom = root.localName === 'feed';
  const channel = atom ? root : child(root, 'channel');
  if (!channel || (!atom && root.localName !== 'rss' && root.localName !== 'RDF')) {
    throw new Error('Invalid feed: this is not an RSS or Atom feed');
  }

  // The items of RSS 1.0 are next to the channel
  const entries = atom ? children(root, 'entry') : children(root.localName === 'RDF' ? root : channel, 'item');
  return {
    title: label(text(channel, 'title')),
    entries: entries.slice(0, MAX_ENTRIES).map((entry, index) => {
      const link = webAddress(entryLink(entry, atom), feedUrl);
      const date = Date.parse(text(entry, 'pubDate', 'updated', 'published', 'date'));
      return {
        key: `${index}:${text(entry, 'guid', 'id') || link}`,
        title: label(text(entry, 'title')) || '(title missing)',
        link,
        date: Number.isNaN(date) ? null : date / 1000,
      };
    }),
  };
};
