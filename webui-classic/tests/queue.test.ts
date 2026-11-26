import { describe, expect, it } from 'vitest';
import type { ItemType } from '../src/api/types';
import { bundlesFor } from '../src/lib/queueFile';

const bundle = (target: string, kind: 'file' | 'directory') => ({ target, type: { id: kind } as ItemType });

describe('finding the bundle of a download', () => {
  const bundles = [
    bundle('/Downloads/Album/', 'directory'),
    bundle('/Downloads/Album 2/', 'directory'),
    bundle('/Downloads/song.mp3', 'file'),
    bundle('/Downloads/song.mp3.old', 'file'),
  ];
  const targets = (target: string) => bundlesFor(bundles, target).map((b) => b.target);

  it('matches files of folders', () => {
    expect(targets('/Downloads/Album/CD1/01.mp3')).toEqual(['/Downloads/Album/']);
    expect(targets('/Downloads/Album 2/01.mp3')).toEqual(['/Downloads/Album 2/']);
  });

  it('matches single files exactly', () => {
    expect(targets('/Downloads/song.mp3')).toEqual(['/Downloads/song.mp3']);
    expect(targets('/Downloads/song')).toEqual([]);
  });
});
