import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';
import { buildKnownNames, isArtistCorrect, isTitleCorrect } from '../src/guess.js';
import { songArtistKeys } from '../src/selection.js';
import { decadeOf } from '../src/stats.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/songs.json');
const songs = loadCatalog(file); // throws on any schema problem (ids, fields, years, language, genre, difficulty)

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

  it('gives every song a difficulty of 1, 2 or 3', () => {
    expect(songs.filter((s) => ![1, 2, 3].includes(s.difficulty)).map((s) => s.id)).toEqual([]);
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

  describe('guess checking', () => {
    const known = buildKnownNames(songs);

    it("accepts every song's own artist and title as typed on the card", () => {
      const rejected = songs.filter((s) => !isArtistCorrect(s, s.artist, known) || !isTitleCorrect(s, s.title, known));
      expect(rejected.map((s) => s.id)).toEqual([]);
    });

    it("rejects other songs' artists and titles", () => {
      const wrong: string[] = [];
      songs.forEach((s, i) => {
        for (let k = 1; k <= 25; k++) {
          const other = songs[(i + k * 17) % songs.length]!;
          const sharesArtist = songArtistKeys(other).some((key) => songArtistKeys(s).includes(key));
          if (!sharesArtist && isArtistCorrect(s, other.artist, known)) wrong.push(`${s.id} artist <- ${other.id}`);
          if (other.title.toLowerCase() !== s.title.toLowerCase() && isTitleCorrect(s, other.title, known)) {
            wrong.push(`${s.id} title <- ${other.id}`);
          }
        }
      });
      expect(wrong).toEqual([]);
    });

    it("accepts every song's own aliases", () => {
      const rejected: string[] = [];
      for (const s of songs) {
        for (const a of s.artistAliases ?? []) if (!isArtistCorrect(s, a, known)) rejected.push(`${s.id} artist "${a}"`);
        for (const t of s.titleAliases ?? []) if (!isTitleCorrect(s, t, known)) rejected.push(`${s.id} title "${t}"`);
      }
      expect(rejected).toEqual([]);
    });

    it("never accepts one song's aliases for a different song", () => {
      const keys = new Map(songs.map((s) => [s, songArtistKeys(s)]));
      const wrong: string[] = [];
      for (const s of songs) {
        const own = keys.get(s)!;
        for (const other of songs) {
          if (other === s) continue;
          const sharesArtist = keys.get(other)!.some((key) => own.includes(key));
          for (const a of sharesArtist ? [] : (other.artistAliases ?? [])) {
            if (isArtistCorrect(s, a, known)) wrong.push(`${s.id} artist <- ${other.id} "${a}"`);
          }
          for (const t of other.titleAliases ?? []) {
            if (isTitleCorrect(s, t, known)) wrong.push(`${s.id} title <- ${other.id} "${t}"`);
          }
        }
      }
      expect(wrong).toEqual([]);
      // Compares every song with every other song's aliases: about 4.5 s at 667 songs, close to
      // Vitest's 5 s default, and it grows with the square of the catalog size.
    }, 30_000);
  });
});
