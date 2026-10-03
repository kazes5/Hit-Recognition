import type { Song } from '../types.js';

/** Subset of an iTunes Search API result that we use. */
export interface ItunesTrack {
  kind?: string;
  wrapperType?: string;
  artistName?: string;
  trackName?: string;
  trackCensoredName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
}

/**
 * Lowercases, strips diacritics (incl. Hebrew niqqud), turns punctuation into
 * spaces and collapses whitespace. Keeps letters and digits of any script.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeArtist(artist: string): string {
  return normalizeText(artist).replace(/^the /, '');
}

/** Title without parenthetical / bracketed parts and " - Remastered"-style suffixes. */
export function normalizeTitleCore(title: string): string {
  const stripped = title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ');
  const core = normalizeText(stripped);
  return core.length > 0 ? core : normalizeText(title);
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

const FEATURE_MARKERS = ['feat', 'ft', 'featuring', 'with', 'and', 'x', 'vs'];

/**
 * Artist must match: equal (ignoring case, diacritics, punctuation, leading "the"),
 * or iTunes adds featured artists ("Mark Ronson feat. Bruno Mars"), or iTunes uses a
 * shorter multi-word form of our name ("Jimi Hendrix" for "The Jimi Hendrix Experience").
 */
export function artistMatches(expected: string, actual: string): boolean {
  const a = normalizeArtist(expected);
  const b = normalizeArtist(actual);
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  if (b.startsWith(`${a} `)) {
    const next = b.slice(a.length + 1).split(' ')[0] ?? '';
    if (FEATURE_MARKERS.includes(next)) return true;
  }
  return b.includes(' ') && containsPhrase(a, b);
}

/** 0 = no match, 1 = loose (contains), 2 = prefix, 3 = exact (ignoring parentheticals), 4 = exact full title. */
export function titleScore(expected: string, actual: string): number {
  const fullA = normalizeText(expected);
  const fullB = normalizeText(actual);
  if (fullA.length > 0 && fullA === fullB) return 4;
  const a = normalizeTitleCore(expected);
  const b = normalizeTitleCore(actual);
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 3;
  if (b.startsWith(`${a} `) || a.startsWith(`${b} `)) return 2;
  if (containsPhrase(b, a) || containsPhrase(a, b)) return 1;
  return 0;
}

function pickBestTrack(
  song: Pick<Song, 'artist' | 'title'>,
  results: readonly ItunesTrack[],
  field: 'previewUrl' | 'artworkUrl100',
): string | null {
  let best: { score: number; value: string } | null = null;
  for (const track of results) {
    const value = track[field];
    if (typeof value !== 'string' || value.length === 0) continue;
    if (track.kind !== undefined && track.kind !== 'song') continue;
    if (typeof track.artistName !== 'string' || !artistMatches(song.artist, track.artistName)) continue;
    const name = track.trackName ?? track.trackCensoredName;
    if (typeof name !== 'string') continue;
    const score = titleScore(song.title, name);
    if (score === 0) continue;
    if (best === null || score > best.score) best = { score, value };
  }
  return best?.value ?? null;
}

/**
 * Picks the best iTunes result for the song: the artist must match, the title
 * must at least loosely match, and the closest title wins (first result on ties,
 * since iTunes orders by relevance).
 */
export function pickBestPreview(song: Pick<Song, 'artist' | 'title'>, results: readonly ItunesTrack[]): string | null {
  return pickBestTrack(song, results, 'previewUrl');
}

/** Normalizes an Apple artwork URL: upscales 100x100 to 300x300; only https on mzstatic.com is accepted. */
export function sanitizeCoverUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  const host = url.hostname.toLowerCase();
  if (host !== 'mzstatic.com' && !host.endsWith('.mzstatic.com')) return null;
  return url.toString().replace('100x100', '300x300');
}

/** Cover picture (artworkUrl100 upscaled to 300x300) of the best-matching result, or null. */
export function pickBestCover(song: Pick<Song, 'artist' | 'title'>, results: readonly ItunesTrack[]): string | null {
  const raw = pickBestTrack(song, results, 'artworkUrl100');
  return raw === null ? null : sanitizeCoverUrl(raw);
}
