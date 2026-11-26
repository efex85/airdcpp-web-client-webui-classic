import { describe, expect, it } from 'vitest';
import { getSocketUrl } from '../src/api/socket';
import type { Highlight, OnlineUser } from '../src/api/types';
import { completeNick, messageRequests, parseCommand } from '../src/lib/chat';
import { formatDuration, formatSize, formatSpeed } from '../src/lib/format';
import { isHubLink, isSafeLink, parseMagnet, splitHighlights } from '../src/lib/highlight';
import { magnetLink } from '../src/lib/magnet';
import { lastSegment, parentPath, pathChain } from '../src/lib/path';
import { userMatcher } from '../src/lib/userFilter';

describe('chat commands', () => {
  it('recognizes /me, /clear and /help', () => {
    expect(parseCommand('hello')).toEqual({ type: 'message', text: 'hello', thirdPerson: false });
    expect(parseCommand('/me waves')).toEqual({ type: 'message', text: 'waves', thirdPerson: true });
    expect(parseCommand('/CLEAR')).toEqual({ type: 'clear' });
    expect(parseCommand('/me')).toEqual({ type: 'help' });
    expect(parseCommand('/uptime')).toEqual({ type: 'other' });
    expect(parseCommand('//')).toEqual({ type: 'other' });
  });

  it('passes every command to the client as written, for the extensions', () => {
    expect(messageRequests('/stats now')).toEqual([{ text: '/stats now' }]);
    expect(messageRequests('/help')).toEqual([{ text: '/help' }]);
    expect(messageRequests('/me waves')).toEqual([{ text: 'waves', third_person: true }, { text: '/me waves' }]);
  });

  it('sends other texts as chat messages', () => {
    expect(messageRequests(' /not a command')).toEqual([{ text: ' /not a command', third_person: false }]);
  });

  it('never sends a command as chat text', () => {
    // Only texts that start with "/" are kept back by the client
    for (const input of ['/password secret', '/x', '/', '/multi\nline']) {
      expect(messageRequests(input).every((r) => r.third_person || r.text.startsWith('/'))).toBe(true);
    }
  });
});

describe('nick completion', () => {
  const nicks = ['[SRA]Nathan', 'natalie', 'Other'];

  it('prefers full prefix matches, ignores leading tags and cycles', () => {
    const first = completeNick('nat', 3, nicks)!;
    expect(first.text).toBe('natalie: ');
    const second = completeNick(first.text, first.caret, nicks, first.next)!;
    expect(second.text).toBe('[SRA]Nathan: ');
    expect(completeNick(second.text, second.caret, nicks, second.next)!.text).toBe('natalie: ');
  });

  it('completes in the middle of a line without a colon', () => {
    expect(completeNick('hi oth', 6, nicks)!.text).toBe('hi Other ');
  });

  it('does nothing without a match', () => {
    expect(completeNick('zzz', 3, nicks)).toBeNull();
    expect(completeNick('', 0, nicks)).toBeNull();
  });
});

describe('message highlights', () => {
  const highlight = (start: number, end: number) => ({ position: { start, end } }) as Highlight;

  it('uses UTF-8 byte offsets', () => {
    const parts = splitHighlights('åäö link end', [highlight(7, 11)]);
    expect(parts.map((p) => p.text)).toEqual(['åäö ', 'link', ' end']);
    expect(parts[1].highlight).toBeDefined();
  });

  it('skips overlapping and out of range positions', () => {
    const parts = splitHighlights('abcdef', [highlight(1, 3), highlight(2, 4), highlight(4, 99)]);
    expect(parts.map((p) => p.text)).toEqual(['a', 'bc', 'def']);
  });
});

describe('links', () => {
  const tth = 'A'.repeat(39);

  it('reads magnet links it creates', () => {
    const file = { name: 'a & b.iso', tth, size: 42 };
    expect(parseMagnet(magnetLink(file))).toEqual(file);
  });

  it('rejects incomplete magnets', () => {
    expect(parseMagnet(`magnet:?xt=urn:tree:tiger:${tth}&dn=x`)).toBeNull();
    expect(parseMagnet('magnet:?dn=x&xl=1')).toBeNull();
    expect(parseMagnet('https://example.com')).toBeNull();
  });

  it('only makes web and ftp addresses clickable', () => {
    expect(isSafeLink('https://example.com')).toBe(true);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink('data:text/html,x')).toBe(false);
    expect(isHubLink('adcs://hub.example:1511')).toBe(true);
  });
});

describe('paths and formatting', () => {
  it('handles ADC paths', () => {
    expect(parentPath('/a/b/')).toBe('/a/');
    expect(parentPath('/a/')).toBe('/');
    expect(lastSegment('/a/file.txt')).toBe('file.txt');
    expect(pathChain('/a/b/')).toEqual(['/', '/a/', '/a/b/']);
  });

  it('formats sizes, speeds and durations', () => {
    expect(formatSize(1536)).toBe('1.50 KiB');
    expect(formatSize(-1)).toBe('');
    expect(formatSpeed(-1)).toBe('');
    expect(formatSpeed(0)).toBe('');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(90061)).toBe('1d 1:01:01');
  });
});

describe('user filter', () => {
  const user = { nick: 'Nathan', description: 'friend', tag: '<AirDC++>', ip4: { ip: '10.0.0.1' } } as OnlineUser;

  it('matches by field and method', () => {
    expect(userMatcher('ath', 'any', 'partial')!(user)).toBe(true);
    expect(userMatcher('ath', 'nick', 'start')!(user)).toBe(false);
    expect(userMatcher('FRIEND', 'description', 'exact')!(user)).toBe(true);
    expect(userMatcher('^10\\.', 'ip', 'regex')!(user)).toBe(true);
  });

  it('reports an invalid regular expression', () => {
    expect(userMatcher('(', 'any', 'regex')).toBeNull();
  });
});

describe('API address', () => {
  const url = (pathname: string, protocol = 'http:') => getSocketUrl({ protocol, host: 'nas:5600', pathname });

  it('follows the protocol and a proxy subpath', () => {
    expect(url('/')).toBe('ws://nas:5600/api/v1/');
    expect(url('/index.html', 'https:')).toBe('wss://nas:5600/api/v1/');
    expect(url('/dc/')).toBe('ws://nas:5600/dc/api/v1/');
    expect(url('/dc/index.html')).toBe('ws://nas:5600/dc/api/v1/');
  });
});
