import { describe, expect, it } from 'vitest';
import {
  artistMatches,
  normalizeText,
  pickBestCover,
  pickBestPreview,
  pickCrossScriptTrack,
  titleScore,
  type ItunesTrack,
} from '../src/preview/matching.js';

describe('normalizeText', () => {
  it('lowercases, strips diacritics and punctuation', () => {
    expect(normalizeText('Beyoncé')).toBe('beyonce');
    expect(normalizeText("Don't Stop   Believin'!")).toBe('don t stop believin');
    expect(normalizeText('Simon & Garfunkel')).toBe('simon and garfunkel');
    expect(normalizeText('Sinéad O’Connor')).toBe('sinead o connor');
  });

  it('keeps Hebrew letters and removes niqqud', () => {
    expect(normalizeText('שָׁלוֹם')).toBe('שלום');
    expect(normalizeText("דוד ד'אור")).toBe('דוד ד אור');
  });
});

describe('artistMatches', () => {
  it('matches equal and "feat." variants', () => {
    expect(artistMatches('The Beatles', 'Beatles')).toBe(true);
    expect(artistMatches('Mark Ronson', 'Mark Ronson feat. Bruno Mars')).toBe(true);
    expect(artistMatches('אייל גולן', 'אייל גולן')).toBe(true);
    expect(artistMatches('Lady Gaga', 'Lady Gaga & Bradley Cooper')).toBe(true);
    expect(artistMatches('The Jimi Hendrix Experience', 'Jimi Hendrix')).toBe(true);
    expect(artistMatches('הפרויקט של עידן רייכל', 'עידן רייכל')).toBe(true);
  });

  it('treats the Hebrew "ו" connector like "&"', () => {
    expect(artistMatches('דטנר וקושניר', 'דטנר & קושניר')).toBe(true);
    expect(artistMatches('דטנר וקושניר', 'דטנר ו קושניר')).toBe(true);
    expect(artistMatches('דטנר & קושניר', 'דטנר וקושניר')).toBe(true);
    expect(artistMatches('דטנר וקושניר', 'קושניר ודטנר')).toBe(true);
    expect(artistMatches('יזהר כהן', 'יזהר כהן והאלפבתא')).toBe(true);
    expect(artistMatches('דטנר וקושניר', 'דטנר את קושניר')).toBe(false);
  });

  it('keeps single-word artists starting with "ו"', () => {
    expect(artistMatches('ורד', 'ורד')).toBe(true);
    expect(artistMatches('ורד', 'רד')).toBe(false);
  });

  it('rejects different artists', () => {
    expect(artistMatches('Queen', 'Queen Latifah')).toBe(false);
    expect(artistMatches('Queen Latifah', 'Queen')).toBe(false);
    expect(artistMatches('Toto', 'Totó la Momposina')).toBe(false);
    expect(artistMatches('ABBA', 'Glee Cast')).toBe(false);
  });
});

describe('titleScore', () => {
  it('ranks exact > core exact > prefix > contains > none', () => {
    expect(titleScore('Hey Jude', 'Hey Jude')).toBe(4);
    expect(titleScore('Hey Jude', 'Hey Jude (Remastered 2015)')).toBe(3);
    expect(titleScore('Rocket Man', "Rocket Man (I Think It's Going to Be a Long, Long Time)")).toBe(3);
    expect(titleScore('Wonderwall', 'Wonderwall - Remastered')).toBe(3);
    expect(titleScore('Africa', 'Africa Live in Paris')).toBe(2);
    expect(titleScore('Crazy', 'Gone Crazy Tonight')).toBe(1);
    expect(titleScore('Yesterday', 'Let It Be')).toBe(0);
  });
});

describe('pickBestPreview', () => {
  const song = { artist: 'James Brown', title: 'I Got You (I Feel Good)' };

  it('prefers the closest title by the matching artist', () => {
    const results: ItunesTrack[] = [
      { kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good) [Live]', previewUrl: 'https://a/live' },
      { kind: 'song', artistName: 'Cover Band', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://a/cover' },
      { kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://a/orig' },
    ];
    expect(pickBestPreview(song, results)).toBe('https://a/orig');
  });

  it('skips results without previews, wrong kind, or wrong artist', () => {
    const results: ItunesTrack[] = [
      { kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)' },
      { kind: 'music-video', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://v' },
      { kind: 'song', artistName: 'Someone Else', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://x' },
      { kind: 'song', artistName: 'James Brown', trackName: 'Sex Machine', previewUrl: 'https://y' },
    ];
    expect(pickBestPreview(song, results)).toBeNull();
  });

  it('matches Hebrew songs', () => {
    const results: ItunesTrack[] = [
      { kind: 'song', artistName: 'אייל גולן', trackName: 'מי שמאמין', previewUrl: 'https://heb' },
    ];
    expect(pickBestPreview({ artist: 'אייל גולן', title: 'מי שמאמין' }, results)).toBe('https://heb');
  });

  it('returns null for empty results', () => {
    expect(pickBestPreview(song, [])).toBeNull();
  });
});

describe('cross-script fallback (Hebrew songs)', () => {
  const artzi = { artist: 'שלמה ארצי', title: 'ירח', language: 'he' as const };
  const track = (artistName: string, trackName: string, extra: Partial<ItunesTrack> = {}): ItunesTrack => ({
    kind: 'song',
    artistId: 1,
    artistName,
    trackName,
    previewUrl: `https://p/${artistName}/${trackName}`,
    artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg',
    ...extra,
  });

  it.each([
    ['Hebrew script', 'שלמה ארצי', 'ירח'],
    ['Hebrew with niqqud', 'שְׁלֹמֹה אַרְצִי', 'יָרֵחַ'],
    ['Latin artist, Hebrew title', 'Shlomo Artzi', 'ירח'],
    ['Hebrew artist, Latin title', 'שלמה ארצי', 'Yareach'],
    ['both Latin, single artistId', 'Shlomo Artzi', 'Yareach'],
  ])('accepts %s', (_name, artistName, trackName) => {
    const t = track(artistName, trackName);
    expect(pickBestPreview(artzi, [t])).toBe(t.previewUrl);
    expect(pickBestCover(artzi, [t])).toBe('https://is1-ssl.mzstatic.com/a/300x300bb.jpg');
  });

  it('prefers a strict match over a cross-script one', () => {
    const results = [track('Shlomo Artzi', 'Yareach'), track('שלמה ארצי', 'ירח')];
    expect(pickBestPreview(artzi, results)).toBe('https://p/שלמה ארצי/ירח');
  });

  it('rejects both-Latin results when they come from several artists', () => {
    const results = [track('Shlomo Artzi', 'Yareach'), track('Some Cover Band', 'Yareach', { artistId: 2 })];
    expect(pickBestPreview(artzi, results)).toBeNull();
  });

  it('rejects both-Latin results without an artistId', () => {
    expect(pickBestPreview(artzi, [track('Shlomo Artzi', 'Yareach', { artistId: undefined })])).toBeNull();
  });

  it('rejects a different Hebrew name in the other field', () => {
    expect(pickBestPreview(artzi, [track('שלמה ארצי', 'תרקוד')])).toBeNull();
    expect(pickBestPreview(artzi, [track('אריק איינשטיין', 'ירח')])).toBeNull();
    expect(pickBestPreview(artzi, [track('Shlomo Artzi', 'תרקוד')])).toBeNull();
  });

  it('never applies to English songs or songs without a language', () => {
    const results = [track('Shlomo Artzi', 'Yareach')];
    expect(pickBestPreview({ ...artzi, language: 'en' }, results)).toBeNull();
    expect(pickBestPreview({ artist: artzi.artist, title: artzi.title }, results)).toBeNull();
    const queen = { artist: 'Queen', title: 'Bohemian Rhapsody', language: 'en' as const };
    expect(pickBestPreview(queen, [track('Queen', 'Something Else'), track('Glee Cast', 'Bohemian Rhapsody')])).toBeNull();
    // the raw fallback would accept this; pickBestPreview only uses it for Hebrew songs
    expect(pickCrossScriptTrack(queen, [track('Queen', 'Something Else')], 'previewUrl')).toBe('https://p/Queen/Something Else');
  });

  it('matches a "ו" credit across separators', () => {
    const song = { artist: 'דטנר וקושניר', title: 'שיר', language: 'he' as const };
    expect(pickBestPreview(song, [track('דטנר & קושניר', 'שיר')])).toBe('https://p/דטנר & קושניר/שיר');
  });
});
