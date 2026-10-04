import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from '../src/catalog.js';
import {
  MAX_GUESS_LENGTH,
  buildKnownNames,
  isArtistCorrect,
  isTitleCorrect,
  judgeGuess,
  normalizeGuess,
  parseGuessRequest,
} from '../src/guess.js';
import { song } from './helpers.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/songs.json');
const catalog = loadCatalog(file);
const known = buildKnownNames(catalog);
const byId = (id: number) => {
  const s = catalog.find((c) => c.id === id);
  if (!s) throw new Error(`song ${id} missing from songs.json`);
  return s;
};

describe('normalizeGuess', () => {
  it.each([
    ['The Beatles', 'beatles'],
    ["Guns N' Roses", 'guns and roses'],
    ["Rock 'n' Roll", 'rock and roll'],
    ['Simon & Garfunkel', 'simon and garfunkel'],
    ["דוד ד'אור", 'דוד דאור'],
    ['דוד ד׳אור', 'דוד דאור'],
    ['את ואני נולדנו בתש"ח', 'את ואני נולדנו בתשח'],
    ['מי שמאמין', 'מי שמאמינ'],
    ['יָרֵחַ', 'ירח'],
    ['  Sinéad   O’Connor ', 'sinead oconnor'],
    ['א-ב-ני-בי', 'א ב ני בי'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeGuess(input)).toBe(expected);
  });
});

describe('artist and title guesses on real songs', () => {
  it.each([
    [101, 'artist', 'beatels', true],
    [229, 'artist', 'Guns and Roses', true],
    [229, 'artist', 'guns n roses', true],
    [84, 'title', 'dont stop believing', true],
    [265, 'title', 'Bohemian Rapsody', true],
    [9, 'title', 'I Feel Good', true],
    [9, 'title', 'I Got You', true],
    [251, 'title', 'Da Ba Dee', true],
    [140, 'title', 'Satisfaction', true],
    [201, 'title', 'Another Brick in the Wall', true],
    [279, 'title', 'The Dock of the Bay', true],
    [496, 'title', 'I Just', false],
    [415, 'title', 'Tell Me', false],
    [241, 'artist', 'Kis', false],
    [241, 'artist', 'KISS', true],
    [184, 'artist', 'Bradley Cooper', true],
    [184, 'artist', 'Bradley Cooper and Lady Gaga', true],
    [184, 'artist', 'Lady Gaga & Beyonce', false],
    [118, 'artist', 'Earth', false],
    [118, 'artist', 'Earth Wind and Fire', true],
    [387, 'artist', 'Tones', false],
    [110, 'artist', 'Bruno Mars', true],
    [110, 'artist', 'Mark Ronson feat. Bruno Mars', true],
    [152, 'title', 'Nothing Compares to You', true],
    [152, 'artist', 'Sinead OConnor', true],
    [409, 'artist', 'Pink', true],
    [409, 'artist', 'Nate Ruess', true],
    [4, 'artist', 'קושניר ודטנר', true],
    [4, 'artist', 'דטנר', false],
    [266, 'artist', 'דוד ד׳אור', true],
    [266, 'artist', 'דוד דאור', true],
    [165, 'artist', 'הנחל', true],
    [165, 'artist', 'להקת הנח"ל', true],
    [260, 'title', 'מי שמאמינ', true],
    [260, 'artist', 'Eyal Golan', true],
    [349, 'title', 'יָרֵחַ', true],
    [339, 'artist', 'דוד ברוזה', true],
    [72, 'title', 'אבניבי', true],
    [72, 'artist', 'יזהר כהן', true],
    [345, 'title', 'ככה זה', true],
    [64, 'title', 'אני ואתה', false],
    [447, 'artist', 'ליאור נרקיס עם שלומי שבת', true],
    [408, 'title', 'את ואני נולדנו בתשח', true],
    [134, 'title', 'Believe', false],
    [134, 'title', 'Beleiver', true],
    [526, 'artist', 'שלומי שבת', false],
    [526, 'artist', 'שלומי שבן', true],
  ] as const)('song %i %s %j -> %s', (id, field, guess, expected) => {
    const s = byId(id);
    const result = field === 'artist' ? isArtistCorrect(s, guess, known) : isTitleCorrect(s, guess, known);
    expect(result).toBe(expected);
  });

  it('treats a blank guess as wrong, not as an error', () => {
    expect(judgeGuess(byId(101), { artist: '', title: '   ' }, known)).toEqual({ artistCorrect: false, titleCorrect: false });
  });

  it('judges artist and title separately', () => {
    const s = byId(227);
    expect(judgeGuess(s, { artist: 'Bruce Springsteen', title: 'Dancing in the Dark' }, known)).toEqual({
      artistCorrect: true,
      titleCorrect: false,
    });
    expect(judgeGuess(s, { artist: 'Madonna', title: 'Born in the USA' }, known)).toEqual({
      artistCorrect: false,
      titleCorrect: true,
    });
  });
});

describe('aliases in songs.json', () => {
  const songsBy = (artist: string) => {
    const found = catalog.filter((c) => c.artist === artist);
    if (found.length === 0) throw new Error(`no song by ${artist} in songs.json`);
    return found;
  };

  it.each([
    ['Eyal Golan', 'אייל גולן'],
    ['Shlomo Artzi', 'שלמה ארצי'],
    ['Arik Einstein', 'אריק איינשטיין'],
    ['Omer Adam', 'עומר אדם'],
    ['Noa Kirel', 'נועה קירל'],
    ['Sarit Hadad', 'שרית חדד'],
    ['Sarit Haddad', 'שרית חדד'],
    ['Shalom Hanoch', 'שלום חנוך'],
    ['Zohar Argov', 'זוהר ארגוב'],
    ['Ofra Haza', 'עפרה חזה'],
    ['Kaveret', 'כוורת'],
    ['Mashina', 'משינה'],
    ['Teapacks', 'טיפקס'],
    ['Hadag Nahash', 'הדג נחש'],
    ['Rita', 'ריטה'],
    ['Yehoram Gaon', 'יהורם גאון'],
    ['Chava Alberstein', 'חוה אלברשטיין'],
    ['Ishay Ribo', 'ישי ריבו'],
    ['Eden Ben Zaken', 'עדן בן זקן'],
    ['Idan Raichel Project', 'הפרויקט של עידן רייכל'],
    ['Dana International', 'דנה אינטרנשיונל'],
    ['David DOr', "דוד ד'אור"],
    ['Hanan Ben Ari', 'חנן בן ארי'],
    ['shlomi shabat', 'שלומי שבת'],
    ['Milk & Honey', 'חלב ודבש'],
    ['High Windows', 'החלונות הגבוהים'],
    ['Static and Ben El Tavori', 'סטטיק ובן אל תבורי'],
    ['Eyal Golen', 'אייל גולן'],
  ])('accepts %j for every song by %s', (latin, hebrew) => {
    for (const s of songsBy(hebrew)) expect(isArtistCorrect(s, latin, known), `song ${s.id}`).toBe(true);
  });

  it.each([
    [106, 'Static'],
    [106, 'סטטיק'],
    [351, 'Static'],
    [539, 'סטטיק'],
    [106, 'Ben El Tavori'],
    [106, 'בן אל תבורי'],
    [570, 'Subliminal'],
    [570, 'סאבלימינל'],
    [576, 'Odeya'],
    [576, 'אודיה'],
    [409, 'P!nk'],
    [409, 'Pink & Nate Ruess'],
    [300, 'Pink'],
    [322, 'Shlomi Shabat'],
    [447, 'Shlomi Shabat'],
    [261, 'נועה קירל'],
    [45, 'טיפקס'],
  ] as const)('song %i accepts the performer %j on their own', (id, guess) => {
    expect(isArtistCorrect(byId(id), guess, known)).toBe(true);
  });

  it.each([
    [201, 'Pink'], // Pink Floyd, not P!nk
    [526, 'Shlomi Shabat'], // Shlomi Shaban & Chava Alberstein
    [526, 'Shlomi Shabbat'],
    [531, 'Shlomi Shaban'],
    [98, 'Eden'], // Eden Golan, not the band Eden
    [316, 'Adam'], // Omer Adam, not the singer Adam
    [65, 'Ilan & Ilanit'],
  ] as const)('song %i rejects the look-alike performer %j', (id, guess) => {
    expect(isArtistCorrect(byId(id), guess, known)).toBe(false);
  });

  it.each([
    [152, 'Nothing Compares to You'],
    [100, 'Mambo Number 5'],
    [345, 'לאהוב אותך'],
    [260, 'Mi Shemamin'],
    [21, 'Jerusalem of Gold'],
    [128, 'Hallelujah'],
  ] as const)('song %i accepts the title %j', (id, guess) => {
    expect(isTitleCorrect(byId(id), guess, known)).toBe(true);
  });
});

describe('typo tolerance', () => {
  const s = song({ id: 1, artist: 'Whitney Houston', title: 'Bohemian Rhapsody' });

  it('allows more typos for longer names', () => {
    expect(isTitleCorrect(s, 'Bohemian Rapsody')).toBe(true); // 1 of 3
    expect(isTitleCorrect(s, 'Bohemain Rapsodi')).toBe(true); // swap + 2 = 3 of 3
    expect(isTitleCorrect(s, 'Bohmain Rapsodi')).toBe(false); // 4 > 3
    expect(isArtistCorrect(s, 'Witney Huston')).toBe(true);
  });

  it('needs an exact short name', () => {
    const abba = song({ id: 2, artist: 'ABBA', title: 'Waterloo' });
    expect(isArtistCorrect(abba, 'abba')).toBe(true);
    expect(isArtistCorrect(abba, 'aba')).toBe(false);
  });

  it('never accepts part of a title', () => {
    const wham = song({ id: 3, artist: 'Wham!', title: 'Wake Me Up Before You Go-Go' });
    expect(isTitleCorrect(wham, 'Wake Me Up')).toBe(false);
    expect(isTitleCorrect(wham, 'wake me up before you gogo')).toBe(true);
  });

  it('rejects a guess that is exactly another song in the catalog', () => {
    const songs = [song({ id: 1, title: 'Believer' }), song({ id: 2, title: 'Believe' })];
    const names = buildKnownNames(songs);
    expect(isTitleCorrect(songs[0]!, 'Believe')).toBe(true); // without the catalog: one typo
    expect(isTitleCorrect(songs[0]!, 'Believe', names)).toBe(false);
    expect(isTitleCorrect(songs[0]!, 'Beleiver', names)).toBe(true);
  });
});

describe('aliases', () => {
  const s = {
    ...song({ id: 1, artist: 'אייל גולן', title: 'מי שמאמין', language: 'he' }),
    artistAliases: ['Eyal Golan'],
    titleAliases: ['Mi Shemamin'],
  };

  it('accepts an alias with the usual tolerance', () => {
    expect(isArtistCorrect(s, 'eyal golan')).toBe(true);
    expect(isArtistCorrect(s, 'Eyal Gola')).toBe(true);
    expect(isTitleCorrect(s, 'mi shemamin')).toBe(true);
  });

  it('still accepts the Hebrew names', () => {
    expect(isArtistCorrect(s, 'אייל גולן')).toBe(true);
    expect(isTitleCorrect(s, 'מי שמאמין')).toBe(true);
  });
});

describe('parseGuessRequest', () => {
  it('treats a missing body or missing fields as blank', () => {
    expect(parseGuessRequest(undefined)).toEqual({ ok: true, value: { artist: '', title: '' } });
    expect(parseGuessRequest({})).toEqual({ ok: true, value: { artist: '', title: '' } });
    expect(parseGuessRequest({ title: 'Hey Jude' })).toEqual({ ok: true, value: { artist: '', title: 'Hey Jude' } });
  });

  it.each([
    ['an array', []],
    ['a string', 'Hey Jude'],
    ['a number artist', { artist: 5 }],
    ['a null title', { title: null }],
    ['an overlong artist', { artist: 'x'.repeat(MAX_GUESS_LENGTH + 1) }],
  ])('rejects %s', (_label, body) => {
    expect(parseGuessRequest(body).ok).toBe(false);
  });

  it('accepts a field of the maximum length', () => {
    expect(parseGuessRequest({ artist: 'x'.repeat(MAX_GUESS_LENGTH) }).ok).toBe(true);
  });
});
