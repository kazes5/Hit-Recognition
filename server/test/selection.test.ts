import { describe, expect, it } from 'vitest';
import {
  MAX_SONGS_PER_ARTIST_IN_GAME,
  normalizeArtistKey,
  parseNextSongRequest,
  selectNextSong,
  songArtistKeys,
  splitArtistKeys,
} from '../src/selection.js';
import { seq, song } from './helpers.js';

const songs = [
  song({ id: 1, artist: 'ABBA', language: 'en' }),
  song({ id: 2, artist: 'ABBA', language: 'en' }),
  song({ id: 3, artist: 'Queen', language: 'en' }),
  song({ id: 4, artist: 'אייל גולן', language: 'he' }),
  song({ id: 5, artist: 'פאר טסי', language: 'he' }),
];
const all = { excludeIds: [], excludeArtists: [], languages: ['he', 'en'] as const };

describe('selectNextSong', () => {
  it('uses the injected rng to pick among candidates', () => {
    expect(selectNextSong(songs, { ...all, languages: ['he', 'en'] }, () => 0)?.id).toBe(1);
    expect(selectNextSong(songs, { ...all, languages: ['he', 'en'] }, () => 0.999)?.id).toBe(5);
    expect(selectNextSong(songs, { ...all, languages: ['he', 'en'] }, () => 0.5)?.id).toBe(3);
  });

  it('never returns an excluded id', () => {
    for (let i = 0; i < 50; i++) {
      const s = selectNextSong(songs, { ...all, languages: ['he', 'en'], excludeIds: [1, 3, 5] }, Math.random);
      expect([2, 4]).toContain(s?.id);
    }
  });

  it('filters by language', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(selectNextSong(songs, { ...all, languages: ['he'] }, () => r)?.language).toBe('he');
      expect(selectNextSong(songs, { ...all, languages: ['en'] }, () => r)?.language).toBe('en');
    }
  });

  it('prefers artists not yet used (case-insensitive, trimmed)', () => {
    const criteria = { excludeIds: [], excludeArtists: ['  abba ', 'QUEEN'], languages: ['en' as const, 'he' as const] };
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      const s = selectNextSong(songs, criteria, () => r);
      expect(['אייל גולן', 'פאר טסי']).toContain(s?.artist);
    }
  });

  it('falls back to a repeated artist when no other is left', () => {
    const s = selectNextSong(songs, { excludeIds: [1], excludeArtists: ['ABBA', 'Queen'], languages: ['en'] }, seq(0));
    expect([2, 3]).toContain(s?.id);
  });

  it('returns null when nothing remains', () => {
    expect(selectNextSong(songs, { ...all, languages: ['he'], excludeIds: [4, 5] })).toBeNull();
    expect(selectNextSong([], { ...all, languages: ['en'] })).toBeNull();
  });

  it('normalizes artist keys', () => {
    expect(normalizeArtistKey('  The   Beatles ')).toBe('beatles');
  });
});

describe('artist contributor keys (QA #6)', () => {
  it.each([
    ['Lady Gaga & Bradley Cooper', ['lady gaga', 'bradley cooper']],
    ['The Kid LAROI & Justin Bieber', ['kid laroi', 'justin bieber']],
    ['Mark Ronson feat. Bruno Mars', ['mark ronson', 'bruno mars']],
    ['Calvin Harris ft. Rihanna', ['calvin harris', 'rihanna']],
    ['Simon and Garfunkel', ['simon', 'garfunkel']],
    ['Earth, Wind & Fire', ['earth', 'wind', 'fire']],
    ['Avicii x Aloe Blacc', ['avicii', 'aloe blacc']],
    ['יזהר כהן והאלפבתא', ['יזהר כהן', 'האלפבתא']],
    ['שלומי שבת ויוסי אזולאי', ['שלומי שבת', 'יוסי אזולאי']],
    ['אילן ואילנית', ['אילן', 'אילנית']],
    ['ABBA', ['abba']],
    ['אייל גולן', ['אייל גולן']],
  ])('splits %s', (artist, keys) => {
    expect(splitArtistKeys(artist)).toEqual(keys);
  });

  it('adds catalog artistKeys', () => {
    expect(songArtistKeys({ artist: 'Mark Ronson', artistKeys: ['Mark Ronson', 'Bruno Mars'] })).toEqual([
      'mark ronson',
      'bruno mars',
    ]);
  });

  const variants = [
    song({ id: 10, artist: 'יזהר כהן', language: 'he' }),
    song({ id: 11, artist: 'יזהר כהן והאלפבתא', language: 'he' }),
    song({ id: 12, artist: 'Lady Gaga' }),
    song({ id: 13, artist: 'Lady Gaga & Bradley Cooper' }),
    song({ id: 14, artist: 'Justin Bieber' }),
    song({ id: 15, artist: 'The Kid LAROI & Justin Bieber' }),
    { ...song({ id: 16, artist: 'Mark Ronson' }), artistKeys: ['Mark Ronson', 'Bruno Mars'] },
    song({ id: 17, artist: 'Bruno Mars' }),
    song({ id: 18, artist: 'אילנית', language: 'he' }),
    song({ id: 19, artist: 'אילן ואילנית', language: 'he' }),
    song({ id: 20, artist: 'Fresh Artist' }),
    song({ id: 21, artist: 'אמן חדש', language: 'he' }),
  ];
  const both = ['he', 'en'] as ('he' | 'en')[];

  it.each([
    [['יזהר כהן'], [11]],
    [['יזהר כהן והאלפבתא'], [10]],
    [['Lady Gaga'], [13]],
    [['Lady Gaga & Bradley Cooper'], [12]],
    [['Justin Bieber'], [15]],
    [['The Kid LAROI & Justin Bieber'], [14]],
    [['Mark Ronson'], [17]],
    [['bruno mars'], [16]],
    [['אילנית'], [19]],
    [['אילן ואילנית'], [18]],
  ])('treats name variants as repeats: excluding %j skips %j', (excludeArtists, skipped) => {
    for (const r of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99]) {
      const s = selectNextSong(variants, { excludeIds: [], excludeArtists, languages: both }, () => r);
      expect(skipped).not.toContain(s?.id);
      expect(songArtistKeys(s!).some((k) => excludeArtists.map((a) => a.toLowerCase()).includes(k))).toBe(false);
    }
  });

  it('still falls back to a variant when nothing else is left', () => {
    const s = selectNextSong(
      variants,
      { excludeIds: variants.filter((v) => v.id !== 11).map((v) => v.id), excludeArtists: ['יזהר כהן'], languages: both },
      () => 0,
    );
    expect(s?.id).toBe(11);
  });
});

describe('in-game cap per performer', () => {
  const both = ['he', 'en'] as ('he' | 'en')[];
  const rs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const pool = [
    song({ id: 1, artist: 'A' }),
    song({ id: 2, artist: 'A' }),
    song({ id: 3, artist: 'A' }),
    song({ id: 4, artist: 'B' }),
    song({ id: 5, artist: 'C' }),
  ];
  const pick = (list: typeof pool, excludeArtists: string[], excludeIds: number[], r: number) =>
    selectNextSong(list, { excludeIds, excludeArtists, languages: both }, () => r);

  it('caps at 2 songs per performer', () => {
    expect(MAX_SONGS_PER_ARTIST_IN_GAME).toBe(2);
  });

  it('a single entry still allows that artist when only it is left', () => {
    for (const r of rs) expect(pick(pool, ['A'], [4, 5], r)?.artist).toBe('A');
  });

  it('prefers count-0 artists over count-1 artists', () => {
    for (const r of rs) expect(pick(pool, ['A'], [], r)?.artist).not.toBe('A');
    for (const r of rs) expect(pick(pool, ['A', 'B'], [], r)?.artist).toBe('C');
  });

  it('two entries for one artist prefer other artists (case/whitespace-insensitive)', () => {
    const abba = [
      song({ id: 1, artist: 'ABBA' }),
      song({ id: 2, artist: 'ABBA' }),
      song({ id: 3, artist: 'ABBA' }),
      song({ id: 4, artist: 'Queen' }),
    ];
    for (const list of [['ABBA', 'ABBA'], ['ABBA', 'abba'], [' abba ', 'ABBA']]) {
      for (const r of rs) {
        const s = pick(abba, list, [], r);
        expect(s?.id, list.join('|')).toBe(4);
      }
    }
  });

  it('two entries never return that artist while others exist', () => {
    for (const r of rs) expect(pick(pool, ['A', 'A'], [], r)?.artist).not.toBe('A');
  });

  it('falls back to the capped artist when only it is left', () => {
    for (const r of rs) expect(pick(pool, ['A', 'A'], [1, 2, 4, 5], r)?.id).toBe(3);
    expect(pick(pool, ['A', 'A'], [1, 2, 3, 4, 5], 0)).toBeNull();
  });

  it('prefers an artist at 1 over one at the cap when no fresh artist is left', () => {
    for (const r of rs) expect(pick(pool, ['A', 'A', 'B'], [5], r)?.artist).toBe('B');
  });

  it('counts a collab credit for each contributor', () => {
    const list = [
      song({ id: 1, artist: 'Lady Gaga' }),
      song({ id: 2, artist: 'Lady Gaga & Bradley Cooper' }),
      song({ id: 3, artist: 'Bradley Cooper' }),
      song({ id: 4, artist: 'Other' }),
    ];
    // Gaga (1) + Gaga & Cooper (1) -> Gaga has 2, Cooper has 1.
    for (const r of rs) {
      expect(pick(list, ['Lady Gaga', 'Lady Gaga & Bradley Cooper'], [], r)?.id).toBe(4);
      // Only Cooper-credited songs left: song 3 (Cooper at 1) beats song 2 (Gaga at 2).
      expect(pick(list, ['Lady Gaga', 'Lady Gaga & Bradley Cooper'], [1, 4], r)?.id).toBe(3);
    }
  });

  it('expands catalog artistKeys: two Mark Ronson entries cap Bruno Mars songs', () => {
    const list = [
      { ...song({ id: 1, artist: 'Mark Ronson' }), artistKeys: ['Mark Ronson', 'Bruno Mars'] },
      song({ id: 2, artist: 'Bruno Mars' }),
      song({ id: 3, artist: 'Other' }),
    ];
    for (const r of rs) {
      expect(pick(list, ['Mark Ronson', 'Mark Ronson'], [], r)?.id).toBe(3);
      expect(pick(list, ['Mark Ronson'], [], r)?.id).toBe(3);
    }
    for (const r of rs) expect([1, 2]).toContain(pick(list, ['Mark Ronson', 'Mark Ronson'], [3], r)?.id);
  });

  it('deduped legacy lists behave as before (one entry per artist, under the cap)', () => {
    for (const r of rs) {
      expect(pick(pool, ['A', 'B'], [], r)?.artist).toBe('C');
      expect(pick(pool, ['A', 'B', 'C'], [], r)?.artist).toBeDefined();
      expect(pick(pool, ['A', 'B', 'C'], [4, 5], r)?.artist).toBe('A');
    }
  });
});

describe('difficulty filter', () => {
  const both = ['he', 'en'] as ('he' | 'en')[];
  const rs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const pool = [
    song({ id: 1, artist: 'E1', difficulty: 1 }),
    song({ id: 2, artist: 'E2', difficulty: 1 }),
    song({ id: 3, artist: 'M1', difficulty: 2 }),
    song({ id: 4, artist: 'H1', difficulty: 3 }),
    song({ id: 5, artist: 'H2', difficulty: 3, language: 'he' }),
  ];
  const pick = (maxDifficulty: 1 | 2 | 3 | undefined, excludeIds: number[] = [], r = 0, languages = both, excludeArtists: string[] = []) =>
    selectNextSong(pool, { excludeIds, excludeArtists, languages, maxDifficulty }, () => r);

  it('respects maxDifficulty (Easy = 1, Medium = 1-2, Hard / default = all)', () => {
    for (const r of rs) {
      expect(pick(1, [], r)!.difficulty).toBe(1);
      expect(pick(2, [], r)!.difficulty).toBeLessThanOrEqual(2);
    }
    expect(new Set(rs.map((r) => pick(2, [], r)!.id))).toEqual(new Set([1, 2, 3]));
    expect(new Set(rs.map((r) => pick(3, [], r)!.id))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(rs.map((r) => pick(undefined, [], r)!.id))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('falls back one level at a time when the level has no song left', () => {
    for (const r of rs) {
      expect(pick(1, [1, 2], r)?.id).toBe(3); // level 2 before level 3
      expect([4, 5]).toContain(pick(1, [1, 2, 3], r)?.id);
      expect([4, 5]).toContain(pick(2, [1, 2, 3], r)?.id);
    }
  });

  it('never falls back on language', () => {
    for (const r of rs) expect(pick(1, [], r, ['he'])?.id).toBe(5);
    expect(pick(1, [5], 0, ['he'])).toBeNull();
  });

  it('returns null only when no level has a song', () => {
    expect(pick(1, [1, 2, 3, 4], 0, ['en'])).toBeNull();
    expect(pick(3, [1, 2, 3, 4, 5])).toBeNull();
  });

  it('applies the per-performer preference within the chosen level', () => {
    // E1 already dealt: the other easy song comes first, not a harder one.
    for (const r of rs) expect(pick(1, [], r, both, ['E1'])?.id).toBe(2);
    // Both easy performers at the cap: still an easy song (the soft fallback stays inside the level).
    for (const r of rs) expect([1, 2]).toContain(pick(1, [], r, both, ['E1', 'E1', 'E2', 'E2'])?.id);
  });
});

describe('a prolific performer in a simulated game (D2)', () => {
  const both = ['he', 'en'] as ('he' | 'en')[];
  const catalog = [
    ...Array.from({ length: 25 }, (_, i) => song({ id: i + 1, artist: 'Prolific', title: `Hit ${i + 1}` })),
    ...Array.from({ length: 40 }, (_, i) => song({ id: 100 + i, artist: `Other ${i}` })),
  ];

  it('deals that performer at most twice while other songs remain', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let x = seed;
      const rng = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
      const dealt: typeof catalog = [];
      for (;;) {
        const othersLeft = catalog.some((s) => s.artist !== 'Prolific' && !dealt.includes(s));
        const next = selectNextSong(
          catalog,
          { excludeIds: dealt.map((s) => s.id), excludeArtists: dealt.map((s) => s.artist), languages: both },
          rng,
        );
        if (!next) break;
        dealt.push(next);
        if (othersLeft) expect(dealt.filter((s) => s.artist === 'Prolific').length).toBeLessThanOrEqual(2);
      }
      expect(dealt).toHaveLength(catalog.length); // the rest still comes once nothing else is left
    }
  });
});

describe('parseNextSongRequest', () => {
  it('defaults everything', () => {
    for (const body of [undefined, null, {}]) {
      const r = parseNextSongRequest(body);
      expect(r).toEqual({
        ok: true,
        value: { excludeIds: [], excludeArtists: [], languages: ['he', 'en'], maxDifficulty: 3 },
      });
    }
  });

  it('accepts a full valid body', () => {
    const r = parseNextSongRequest({ excludeIds: [1, 2], excludeArtists: ['ABBA'], languages: ['he'], maxDifficulty: 1 });
    expect(r).toEqual({
      ok: true,
      value: { excludeIds: [1, 2], excludeArtists: ['ABBA'], languages: ['he'], maxDifficulty: 1 },
    });
  });

  it.each([1, 2, 3])('accepts maxDifficulty %i', (maxDifficulty) => {
    const r = parseNextSongRequest({ maxDifficulty });
    expect(r.ok && r.value.maxDifficulty).toBe(maxDifficulty);
  });

  it('treats an empty languages list as both', () => {
    const r = parseNextSongRequest({ languages: [] });
    expect(r.ok && r.value.languages).toEqual(['he', 'en']);
  });

  it.each([
    ['array body', []],
    ['string body', 'x'],
    ['excludeIds not array', { excludeIds: 1 }],
    ['excludeIds with string', { excludeIds: [1, '2'] }],
    ['excludeIds with NaN-like', { excludeIds: [null] }],
    ['excludeArtists not array', { excludeArtists: 'ABBA' }],
    ['excludeArtists with number', { excludeArtists: [1] }],
    ['unknown language', { languages: ['fr'] }],
    ['languages not array', { languages: 'he' }],
    ['maxDifficulty 0', { maxDifficulty: 0 }],
    ['maxDifficulty 4', { maxDifficulty: 4 }],
    ['maxDifficulty fractional', { maxDifficulty: 2.5 }],
    ['maxDifficulty string', { maxDifficulty: '3' }],
    ['maxDifficulty null', { maxDifficulty: null }],
  ])('rejects %s', (_name, body) => {
    expect(parseNextSongRequest(body).ok).toBe(false);
  });
});
