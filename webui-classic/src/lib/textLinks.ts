// Addresses in the text of a viewed file, such as an NFO. The text comes from another user, so only web, FTP, hub
// and magnet addresses are found. The text itself stays exactly as written: ASCII art must keep lining up.
import { isHubLink, parseMagnet } from './highlight';

export type LinkKind = 'web' | 'hub' | 'magnet';

export interface TextPiece {
  text: string;
  link?: { kind: LinkKind; address: string };
}

// Letters of all languages belong to an address, drawing characters and symbols around it don't
const REST = String.raw`[\p{L}\p{M}\p{N}\-._~:/?#\[\]@!$&'()*+,;=%]`;

/** Addresses without "http://" or "www." are only taken with a path, and with one of these endings */
const ENDINGS = 'com|net|org|info|biz|eu|se|no|dk|fi|de|nl|uk|fr|es|it|pl|ru|us|ca|au|tv|me|io|co|cc|to';

// A part of a host name. Its length and the number of parts are limited as in real addresses, which also keeps the
// search quick in a file with very long words.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';

const ADDRESS = new RegExp(
  [
    String.raw`(?:https?|ftp|adcs?|dchub|nmdcs):\/\/${REST}+`,
    String.raw`magnet:\?${REST}+`,
    String.raw`www\d{0,3}\.${REST}+`,
    String.raw`\b(?:${LABEL}\.){1,8}(?:${ENDINGS})\/${REST}*`,
  ].join('|'),
  'giu',
);

const count = (text: string, char: string) => text.split(char).length - 1;

/** How many of one character in a row at the end make a drawn line, which isn't a part of an address */
const RULERS: Record<string, number> = { '-': 3, '=': 3, _: 3, '~': 2 };

/** Removes punctuation and decoration that follows an address */
const trimEnd = (found: string) => {
  // A closing bracket belongs to the address only if it was opened in it
  let round = count(found, ')') - count(found, '(');
  let square = count(found, ']') - count(found, '[');
  let end = found.length;
  while (end > 0) {
    const last = found[end - 1]!;
    if (".,:;!?'*".includes(last)) {
      end--;
    } else if (last === '(') {
      round++;
      end--;
    } else if (last === '[') {
      square++;
      end--;
    } else if (last === ')' && round > 0) {
      round--;
      end--;
    } else if (last === ']' && square > 0) {
      square--;
      end--;
    } else {
      let start = end - 1;
      while (start > 0 && found[start - 1] === last) {
        start--;
      }

      if (!RULERS[last] || end - start < RULERS[last]) {
        break;
      }

      end = start;
    }
  }

  return found.slice(0, end);
};

/** What an address leads to, or null if it isn't one after all. "before" is the text in front of it. */
const linkOf = (address: string, before: string): TextPiece['link'] | null => {
  const scheme = /^([a-z]+):/i.exec(address)?.[1].toLowerCase();
  if (scheme === 'magnet') {
    return parseMagnet(address) ? { kind: 'magnet', address } : null;
  }

  if (scheme) {
    // Something must follow the slashes, and the scheme mustn't be the end of another word
    if (!/^[a-z]+:\/\/[\p{L}\p{N}[]/iu.test(address) || /[a-z0-9]$/i.test(before)) {
      return null;
    }

    return { kind: isHubLink(address) ? 'hub' : 'web', address };
  }

  // Not a part of a longer word, a path or a mail address
  if (/(?:[\p{L}\p{N}@_/\\-]|[\p{L}\p{N}]\.)$/u.test(before)) {
    return null;
  }

  if (/^www\d{0,3}\./i.test(address) && !/^www\d{0,3}\.[^./?#]+\.[\p{L}]{2}/iu.test(address)) {
    return null;
  }

  return { kind: 'web', address: `https://${address}` };
};

export const splitTextLinks = (text: string): TextPiece[] => {
  const pieces: TextPiece[] = [];
  let done = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const address = trimEnd(match[0]);
    const link = linkOf(address, text.slice(Math.max(0, match.index - 2), match.index));
    if (!link) {
      continue;
    }

    if (match.index > done) {
      pieces.push({ text: text.slice(done, match.index) });
    }

    pieces.push({ text: address, link });
    done = match.index + address.length;
  }

  if (done < text.length) {
    pieces.push({ text: text.slice(done) });
  }

  return pieces;
};
