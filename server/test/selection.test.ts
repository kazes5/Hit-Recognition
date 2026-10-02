import { describe, expect, it } from 'vitest';
import {
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

describe('parseNextSongRequest', () => {
  it('defaults everything', () => {
    for (const body of [undefined, null, {}]) {
      const r = parseNextSongRequest(body);
      expect(r).toEqual({ ok: true, value: { excludeIds: [], excludeArtists: [], languages: ['he', 'en'] } });
    }
  });

  it('accepts a full valid body', () => {
    const r = parseNextSongRequest({ excludeIds: [1, 2], excludeArtists: ['ABBA'], languages: ['he'] });
    expect(r).toEqual({ ok: true, value: { excludeIds: [1, 2], excludeArtists: ['ABBA'], languages: ['he'] } });
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
  ])('rejects %s', (_name, body) => {
    expect(parseNextSongRequest(body).ok).toBe(false);
  });
});
