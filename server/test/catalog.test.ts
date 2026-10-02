import { describe, expect, it } from 'vitest';
import { CatalogError, validateCatalog } from '../src/catalog.js';
import { computeStats } from '../src/stats.js';
import { createSilentWav } from '../src/wav.js';
import { song } from './helpers.js';

describe('validateCatalog', () => {
  it('accepts a valid catalog', () => {
    const songs = validateCatalog([song({ id: 1 }), song({ id: 2, language: 'he', genre: 'classic-rock', year: 1950 })]);
    expect(songs).toHaveLength(2);
  });

  it('keeps optional artistKeys', () => {
    const [s] = validateCatalog([{ ...song({ id: 1 }), artistKeys: [' A ', 'B'] }]);
    expect(s?.artistKeys).toEqual(['A', 'B']);
  });

  it.each([
    ['not an array', { songs: [] }, /JSON array/],
    ['empty', [], /empty/],
    ['duplicate id', [song({ id: 1 }), song({ id: 1, title: 'Other' })], /duplicate id/],
    ['non-positive id', [song({ id: 0 })], /positive integer/],
    ['missing artist', [{ ...song({ id: 1 }), artist: ' ' }], /artist is required/],
    ['missing title', [{ ...song({ id: 1 }), title: undefined }], /title is required/],
    ['year too early', [song({ id: 1, year: 1949 })], /year/],
    ['year too late', [song({ id: 1, year: 2026 })], /year/],
    ['bad language', [{ ...song({ id: 1 }), language: 'fr' }], /language/],
    ['bad genre', [{ ...song({ id: 1 }), genre: 'jazz' }], /genre/],
    ['bad artistKeys', [{ ...song({ id: 1 }), artistKeys: [] }], /artistKeys/],
    ['non-string artistKeys', [{ ...song({ id: 1 }), artistKeys: ['a', 2] }], /artistKeys/],
    ['duplicate artist+title', [song({ id: 1, artist: 'A', title: 'T' }), song({ id: 2, artist: 'a', title: 't ' })], /duplicate artist/],
  ])('rejects %s', (_name, data, pattern) => {
    expect(() => validateCatalog(data)).toThrow(CatalogError);
    expect(() => validateCatalog(data)).toThrow(pattern);
  });
});

describe('computeStats', () => {
  it('counts by language and decade (sorted)', () => {
    const stats = computeStats([
      song({ id: 1, year: 2019, language: 'he' }),
      song({ id: 2, year: 1965 }),
      song({ id: 3, year: 1969 }),
    ]);
    expect(stats).toEqual({ total: 3, byLanguage: { he: 1, en: 2 }, byDecade: { '1960': 2, '2010': 1 } });
    expect(Object.keys(stats.byDecade)).toEqual(['1960', '2010']);
  });
});

describe('createSilentWav', () => {
  it('produces a valid 16-bit mono PCM header and silent data', () => {
    const wav = createSilentWav(2, 8000);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(8000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(2 * 8000 * 2);
    expect(wav.subarray(44).every((b) => b === 0)).toBe(true);
  });
});
