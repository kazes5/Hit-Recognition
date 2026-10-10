import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';
import {
  artistGuessKeys,
  artistMatchKeys,
  buildKnownNames,
  isArtistCorrect,
  isTitleCorrect,
  titleGuessKeys,
  titleMatchKeys,
} from '../src/guess.js';
import { songArtistKeys } from '../src/selection.js';
import { decadeOf } from '../src/stats.js';
import { aliasMismatches, NameIndex } from './name-index.js';

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
      // Indexed (test/name-index.ts): each alias is checked only against the songs that could accept it.
      expect(aliasMismatches(songs, known, { indexed: true })).toEqual([]);
    });
  });

  describe('name index (used by the alias test)', () => {
    const artistIndex = new NameIndex(songs, artistMatchKeys);
    const titleIndex = new NameIndex(songs, titleMatchKeys);
    // About 16 songs spread over the catalog, compared with every name and alias in it plus typo'd versions.
    const sample = songs.filter((_, i) => i % Math.ceil(songs.length / 16) === 0);
    const rng = mulberry32(1);
    const typos = (text: string): string[] => [1, 2, 3, 4, 5].map((n) => withTypos(text, n, rng));
    const artistGuesses = new Set<string>();
    const titleGuesses = new Set<string>();
    for (const s of songs) {
      for (const a of [s.artist, ...(s.artistKeys ?? []), ...(s.artistAliases ?? [])]) artistGuesses.add(a);
      for (const t of [s.title, ...(s.titleAliases ?? [])]) titleGuesses.add(t);
    }
    for (const s of sample) {
      for (const a of [s.artist, ...(s.artistKeys ?? []), ...(s.artistAliases ?? [])]) for (const g of typos(a)) artistGuesses.add(g);
      for (const t of [s.title, ...(s.titleAliases ?? [])]) for (const g of typos(t)) titleGuesses.add(g);
    }

    it('returns every song that accepts a guess (no song missed)', () => {
      const missed: string[] = [];
      let accepted = 0;
      for (const g of artistGuesses) {
        const found = artistIndex.candidates(artistGuessKeys(g));
        for (const s of sample) {
          if (!isArtistCorrect(s, g)) continue; // without KnownNames, which accepts the most
          accepted++;
          if (!found.has(s)) missed.push(`${s.id} artist "${g}"`);
        }
      }
      for (const g of titleGuesses) {
        const found = titleIndex.candidates(titleGuessKeys(g));
        for (const s of sample) {
          if (!isTitleCorrect(s, g)) continue;
          accepted++;
          if (!found.has(s)) missed.push(`${s.id} title "${g}"`);
        }
      }
      expect(missed).toEqual([]);
      expect(accepted).toBeGreaterThan(sample.length * 4); // own names, shared performers and typos
    });

    it('reports exactly the pairs of the brute-force check on a catalog with clashing aliases', () => {
      // About 100 songs; every third gets another song's artist and title (as typed, and with typos) as aliases.
      const subset = songs.filter((_, i) => i % Math.ceil(songs.length / 100) === 0);
      const subsetKnown = buildKnownNames(subset);
      const clashing = subset.map((s, i) => {
        if (i % 3 !== 0) return s;
        const other = subset[(i * 7 + 11) % subset.length]!;
        return {
          ...s,
          artistAliases: [...(s.artistAliases ?? []), other.artist, withTypos(other.artist, 1, rng), withTypos(other.artist, 2, rng)],
          titleAliases: [...(s.titleAliases ?? []), other.title, withTypos(other.title, 1, rng), withTypos(other.title, 2, rng)],
        };
      });
      const brute = aliasMismatches(clashing, subsetKnown, { indexed: false });
      expect(brute.length).toBeGreaterThan(subset.length / 3);
      expect(aliasMismatches(clashing, subsetKnown, { indexed: true })).toEqual(brute);
    });
  });
});

/** Seeded random numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `text` with `n` random edits: a changed, dropped or added letter, or two neighbours swapped. */
function withTypos(text: string, n: number, rng: () => number): string {
  const chars = Array.from(text);
  const letters = Array.from(new Set(chars.filter((c) => /\p{L}/u.test(c))));
  const letter = (): string => letters[Math.floor(rng() * letters.length)] ?? 'a';
  for (let k = 0; k < n && chars.length > 1; k++) {
    const i = Math.floor(rng() * chars.length);
    const op = Math.floor(rng() * 4);
    if (op === 0) chars[i] = letter();
    else if (op === 1) chars.splice(i, 1);
    else if (op === 2) chars.splice(i, 0, letter());
    else if (i + 1 < chars.length) [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!];
  }
  return chars.join('');
}
