import type { Language, Song } from '../types.js';

/** Subset of an iTunes Search / Lookup API result that we use. */
export interface ItunesTrack {
  kind?: string;
  wrapperType?: string;
  trackId?: number;
  artistId?: number;
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

/**
 * Hebrew "and" connector after normalization: a "ו" prefixed to a word (or standing
 * alone) after a space, as in "דטנר וקושניר" / "דטנר ו קושניר". Same idea as
 * HEBREW_AND in selection.ts; a leading "ו" ("ורד") is never touched.
 */
const HEBREW_AND = / ו ?(?=[א-ת])/g;

/** Normalized artist credit; the Hebrew "ו" connector becomes " and " like "&". */
export function normalizeArtist(artist: string): string {
  return normalizeText(artist).replace(HEBREW_AND, ' and ').replace(/^the /, '');
}

/** Contributors of a normalized credit, sorted: "b and a" -> ["a", "b"]. */
function contributors(normalized: string): string[] {
  return normalized.split(' and ').filter((c) => c.length > 0).sort();
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
 * Artist must match: equal (ignoring case, diacritics, punctuation, leading "the",
 * "&" vs "and" vs Hebrew "ו"), or the same contributors in another order, or iTunes
 * adds featured artists ("Mark Ronson feat. Bruno Mars"), or iTunes uses a shorter
 * multi-word form of our name ("Jimi Hendrix" for "The Jimi Hendrix Experience").
 */
export function artistMatches(expected: string, actual: string): boolean {
  const a = normalizeArtist(expected);
  const b = normalizeArtist(actual);
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  const ca = contributors(a);
  if (ca.length > 1 && ca.join('|') === contributors(b).join('|')) return true;
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

type MatchSong = Pick<Song, 'artist' | 'title'> & { language?: Language };
type TrackField = 'previewUrl' | 'artworkUrl100';

/** The track's value for `field` if the track is a usable song result, else null. */
function usableValue(track: ItunesTrack, field: TrackField): string | null {
  const value = track[field];
  if (typeof value !== 'string' || value.length === 0) return null;
  if (track.kind !== undefined && track.kind !== 'song') return null;
  return value;
}

function trackTitle(track: ItunesTrack): string | undefined {
  return track.trackName ?? track.trackCensoredName;
}

const HEBREW_LETTER = /\p{Script=Hebrew}/u;

function isLatinOnly(text: string): boolean {
  return !HEBREW_LETTER.test(text);
}

/** Strict match: the artist must match and the title must at least loosely match; closest title wins. */
function pickStrictTrack(song: MatchSong, results: readonly ItunesTrack[], field: TrackField): string | null {
  let best: { score: number; value: string } | null = null;
  for (const track of results) {
    const value = usableValue(track, field);
    if (value === null) continue;
    if (typeof track.artistName !== 'string' || !artistMatches(song.artist, track.artistName)) continue;
    const name = trackTitle(track);
    if (typeof name !== 'string') continue;
    const score = titleScore(song.title, name);
    if (score === 0) continue;
    if (best === null || score > best.score) best = { score, value };
  }
  return best?.value ?? null;
}

/**
 * Cross-script fallback for Hebrew songs, used only when strict matching found
 * nothing. The IL storefront often returns Hebrew songs with transliterated
 * names ("Shlomo Artzi" / "Yareach"), which can never be text-equal to the
 * Hebrew card. Accepted, in iTunes relevance order:
 *  1. a result where one of artist / title matches strictly and the other field
 *     contains no Hebrew letters (a transliteration, not a different Hebrew name);
 *  2. otherwise the top result, only if every result with a preview shares one
 *     artistId and the top result's artist and title are both Latin-only.
 * Why this is safe: the search term is the Hebrew artist + title, so iTunes has
 * already matched these results against it; a result in Hebrew script that
 * fails strict matching is a visibly different song and is still rejected; and
 * rule 2 only fires when iTunes returns a single artist, i.e. no ambiguity about
 * whose recording it is. Never applied to English songs.
 */
export function pickCrossScriptTrack(song: MatchSong, results: readonly ItunesTrack[], field: TrackField): string | null {
  for (const track of results) {
    const value = usableValue(track, field);
    const name = trackTitle(track);
    if (value === null || typeof track.artistName !== 'string' || typeof name !== 'string') continue;
    const artistOk = artistMatches(song.artist, track.artistName);
    const titleOk = titleScore(song.title, name) > 0;
    if (artistOk && isLatinOnly(name)) return value;
    if (titleOk && isLatinOnly(track.artistName)) return value;
  }

  const playable = results.filter((track) => usableValue(track, 'previewUrl') !== null);
  const top = playable[0];
  if (top === undefined) return null;
  const artistId = top.artistId;
  if (typeof artistId !== 'number' || !playable.every((track) => track.artistId === artistId)) return null;
  const name = trackTitle(top);
  if (typeof top.artistName !== 'string' || typeof name !== 'string') return null;
  if (!isLatinOnly(top.artistName) || !isLatinOnly(name)) return null;
  return usableValue(top, field);
}

function pickBestTrack(song: MatchSong, results: readonly ItunesTrack[], field: TrackField): string | null {
  const strict = pickStrictTrack(song, results, field);
  if (strict !== null || song.language !== 'he') return strict;
  return pickCrossScriptTrack(song, results, field);
}

/**
 * Picks the best iTunes result for the song: the artist must match, the title
 * must at least loosely match, and the closest title wins (first result on ties,
 * since iTunes orders by relevance). Hebrew songs (`language: 'he'`) fall back
 * to pickCrossScriptTrack when nothing matches strictly.
 */
export function pickBestPreview(song: MatchSong, results: readonly ItunesTrack[]): string | null {
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
export function pickBestCover(song: MatchSong, results: readonly ItunesTrack[]): string | null {
  const raw = pickBestTrack(song, results, 'artworkUrl100');
  return raw === null ? null : sanitizeCoverUrl(raw);
}
