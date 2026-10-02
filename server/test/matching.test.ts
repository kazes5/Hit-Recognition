import { describe, expect, it } from 'vitest';
import { artistMatches, normalizeText, pickBestPreview, titleScore, type ItunesTrack } from '../src/preview/matching.js';

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
