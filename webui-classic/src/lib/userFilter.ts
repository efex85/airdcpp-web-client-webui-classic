import type { OnlineUser } from '../api/types';

export type FilterField = 'any' | 'nick' | 'description' | 'tag' | 'ip';
export type FilterMethod = 'partial' | 'start' | 'exact' | 'regex';

export const FILTER_FIELDS: [FilterField, string][] = [
  ['any', 'Any'],
  ['nick', 'Nick'],
  ['description', 'Description'],
  ['tag', 'Tag'],
  ['ip', 'IP'],
];

export const FILTER_METHODS: [FilterMethod, string][] = [
  ['partial', 'Partial match'],
  ['start', 'Starts with'],
  ['exact', 'Exact match'],
  ['regex', 'Regular expression'],
];

const fieldValues = (user: OnlineUser, field: FilterField): string[] => {
  const values = {
    nick: user.nick,
    description: user.description,
    tag: user.tag,
    ip: [user.ip4?.ip, user.ip6?.ip].filter(Boolean).join(' '),
  };
  return field === 'any' ? Object.values(values) : [values[field]];
};

/** Returns null for an invalid regular expression */
export const userMatcher = (
  text: string,
  field: FilterField,
  method: FilterMethod,
): ((user: OnlineUser) => boolean) | null => {
  if (!text) {
    return () => true;
  }

  let test: (value: string) => boolean;
  const lower = text.toLowerCase();
  if (method === 'regex') {
    try {
      const expression = new RegExp(text, 'i');
      test = (value) => expression.test(value);
    } catch {
      return null;
    }
  } else if (method === 'start') {
    test = (value) => value.toLowerCase().startsWith(lower);
  } else if (method === 'exact') {
    test = (value) => value.toLowerCase() === lower;
  } else {
    test = (value) => value.toLowerCase().includes(lower);
  }

  return (user) => fieldValues(user, field).some(test);
};
