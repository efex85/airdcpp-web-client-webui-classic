import { describe, expect, test } from 'vitest';
import { splitTextLinks } from '../src/lib/textLinks';

const links = (text: string) => splitTextLinks(text).flatMap((p) => (p.link ? [p.link.address] : []));
const TTH = 'A'.repeat(39);

describe('links in viewed text', () => {
  test('the text stays exactly as written', () => {
    const text = '  ┌──┐\r\n  │ http://a.example/x │ www.b.example, imdb.com/title/tt1/ (dchub://hub:411)\n';
    const pieces = splitTextLinks(text);
    expect(pieces.map((p) => p.text).join('')).toBe(text);
    expect(pieces.filter((p) => p.link).map((p) => [p.text, p.link!.kind])).toEqual([
      ['http://a.example/x', 'web'],
      ['www.b.example', 'web'],
      ['imdb.com/title/tt1/', 'web'],
      ['dchub://hub:411', 'hub'],
    ]);
  });

  test('web addresses, with "https://" added where it is missing', () => {
    expect(links('HTTPS://A.example/B?c=1&d=%20#e ftp://f.example:21/g')).toEqual([
      'HTTPS://A.example/B?c=1&d=%20#e',
      'ftp://f.example:21/g',
    ]);
    expect(links('www.imdb.com/title/tt0111161')).toEqual(['https://www.imdb.com/title/tt0111161']);
    expect(links('IMDB: imdb.com/title/tt0111161/')).toEqual(['https://imdb.com/title/tt0111161/']);
    expect(links('http://127.0.0.1:8080/x http://[::1]/y')).toEqual(['http://127.0.0.1:8080/x', 'http://[::1]/y']);
    expect(links('http://sv.example/räksmörgås')).toEqual(['http://sv.example/räksmörgås']);
  });

  test('drawing characters and punctuation around an address are not part of it', () => {
    for (const text of [
      '░▒▓http://a.example/x▓▒░',
      '│http://a.example/x│',
      '|http://a.example/x|',
      '<http://a.example/x>',
      '"http://a.example/x".',
      '(http://a.example/x),',
      '[http://a.example/x]!',
      '**http://a.example/x**',
      'http://a.example/x------',
      'http://a.example/x=====',
      '-=http://a.example/x',
      "'http://a.example/x'?",
      'URL:http://a.example/x:',
      '...http://a.example/x...',
    ]) {
      expect(links(text), text).toEqual(['http://a.example/x']);
    }

    expect(links('IMDb.......: www.a.example/x')).toEqual(['https://www.a.example/x']);
    expect(links('....www.a.example')).toEqual(['https://www.a.example']);
  });

  test('brackets, dashes and underscores that belong to an address stay', () => {
    expect(links('(see http://w.example/A_(b))')).toEqual(['http://w.example/A_(b)']);
    expect(links('http://a.example/q?v=ab-_ http://a.example/--x/~me')).toEqual([
      'http://a.example/q?v=ab-_',
      'http://a.example/--x/~me',
    ]);
  });

  test('magnet and hub links', () => {
    const magnet = `magnet:?xt=urn:tree:tiger:${TTH}&xl=1000&dn=A+file.mkv`;
    expect(splitTextLinks(`get ${magnet} now`)[1]).toEqual({ text: magnet, link: { kind: 'magnet', address: magnet } });
    expect(links('adcs://hub.example:5000/?kp=SHA256/ABC nmdcs://h adc://h')).toEqual([
      'adcs://hub.example:5000/?kp=SHA256/ABC',
      'nmdcs://h',
      'adc://h',
    ]);
    // Not a file: nothing to offer
    expect(links('magnet:?xt=urn:btih:abc')).toEqual([]);
  });

  test('a large file with awkward content is searched quickly', () => {
    const size = 256 * 1024;
    const files = [
      'a'.repeat(size),
      'a.'.repeat(size / 2),
      'a-'.repeat(size / 2),
      'www.'.repeat(size / 4),
      `http://x${'.'.repeat(size)}`,
      `http://x/${'-'.repeat(size)}a`,
      `http://x/${')'.repeat(size)}`,
    ];
    const start = performance.now();
    for (const file of files) {
      expect(splitTextLinks(file).map((p) => p.text).join('') === file).toBe(true);
    }

    // Far below this: the time it would take grew with the square of the size
    expect(performance.now() - start).toBeLessThan(4000);
  });

  test('nothing else becomes a link', () => {
    for (const text of [
      '',
      'http:// and https://... or www.',
      'javascript:alert(1) data:text/html,x file:///etc/passwd mailto:a@b.example',
      'javascript://a.example/%0Aalert(1)',
      'someone@example.com someone@www.example.com',
      'Some.Movie.2020.1080p.BluRay.x264-GRP/CD1',
      'example.com and Release.Name.info',
      'dir/example.com/x C:\\x.net/y',
      'xhttp://a.example www.nothing',
      'N/A 24.5/10 v1.0/final',
    ]) {
      expect(links(text), text).toEqual([]);
    }
  });
});
