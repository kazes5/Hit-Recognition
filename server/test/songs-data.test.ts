import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';
import { songArtistKeys } from '../src/selection.js';
import { decadeOf } from '../src/stats.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/songs.json');
const songs = loadCatalog(file); // throws on any schema problem (ids, fields, years, language, genre)

const count = <K extends string | number>(key: (s: (typeof songs)[number]) => K): Map<K, number> => {
  const m = new Map<K, number>();
  for (const s of songs) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
  return m;
};

describe('data/songs.json', () => {
  it('has at least 500 songs', () => {
    expect(songs.length).toBeGreaterThanOrEqual(500);
  });

  it('has a solid Hebrew and English selection', () => {
    const byLang = count((s) => s.language);
    expect(byLang.get('he') ?? 0).toBeGreaterThanOrEqual(150);
    expect(byLang.get('en') ?? 0).toBeGreaterThanOrEqual(350);
  });

  it('covers every decade from the 1950s to the 2020s', () => {
    const byDecade = count((s) => decadeOf(s.year));
    for (const decade of [1960, 1970, 1980, 1990, 2000, 2010]) {
      expect(byDecade.get(decade) ?? 0, `decade ${decade}`).toBeGreaterThanOrEqual(15);
    }
    expect(byDecade.get(1950) ?? 0).toBeGreaterThanOrEqual(5);
    expect(byDecade.get(2020) ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('has Hebrew songs in every decade from the 1960s to the 2020s', () => {
    const he = count((s) => (s.language === 'he' ? decadeOf(s.year) : 0));
    for (const decade of [1960, 1970, 1980, 1990, 2000, 2010]) {
      expect(he.get(decade) ?? 0, `Hebrew ${decade}s`).toBeGreaterThanOrEqual(5);
    }
    expect(he.get(2020) ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('has unique ids', () => {
    expect(new Set(songs.map((s) => s.id)).size).toBe(songs.length);
  });

  it('has unique artist + title pairs', () => {
    const keys = songs.map((s) => `${s.artist.toLowerCase()}|${s.title.toLowerCase()}`);
    expect(new Set(keys).size).toBe(songs.length);
  });

  it('has at most 3 songs per artist (counting every contributor of a credit)', () => {
    const perKey = new Map<string, number>();
    for (const s of songs) for (const k of songArtistKeys(s)) perKey.set(k, (perKey.get(k) ?? 0) + 1);
    expect([...perKey].filter(([, n]) => n > 3)).toEqual([]);
  });

  it('writes Hebrew songs in Hebrew script and English songs in Latin script', () => {
    const hebrew = /[֐-׿]/;
    for (const s of songs) {
      if (s.language === 'he') {
        expect(hebrew.test(s.artist) && hebrew.test(s.title), `song ${s.id}`).toBe(true);
      } else {
        expect(hebrew.test(s.artist) || hebrew.test(s.title), `song ${s.id}`).toBe(false);
      }
    }
  });
});
