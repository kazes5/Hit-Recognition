import type { ParseResult } from './selection.js';
import { normalizeText } from './text.js';
import type { CatalogSong } from './types.js';

/** A player's typed guess. A missing or blank field counts as a wrong guess for that field. */
export interface GuessInput {
  artist: string;
  title: string;
}

/** Body of a successful POST /api/songs/:id/guess. Never contains the answer itself. */
export interface GuessResult {
  artistCorrect: boolean;
  titleCorrect: boolean;
}

export const MAX_GUESS_LENGTH = 200;

type GuessSong = Pick<CatalogSong, 'artist' | 'title' | 'artistKeys' | 'artistAliases' | 'titleAliases'>;

/** Apostrophes and Hebrew geresh / gershayim are dropped, not turned into spaces: ד'אור -> דאור, תש"ח -> תשח. */
const APOSTROPHES = /['’‘`´׳״"]/g;
const FINAL_FORMS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * normalizeText plus the extra folding a typed guess needs: no apostrophes,
 * Hebrew final letters as normal letters, a standalone "n" as "and"
 * ("Guns N' Roses", "Rock 'n' Roll") and no leading "the".
 */
export function normalizeGuess(text: string): string {
  return normalizeText(text.replace(APOSTROPHES, ''))
    .replace(/[ךםןףץ]/g, (c) => FINAL_FORMS[c] ?? c)
    .replace(/(^| )n(?= |$)/g, '$1and')
    .replace(/^the /, '');
}

/** normalizeGuess for an artist; a leading "להקת" ("the band") is dropped too. */
function normalizeArtistGuess(text: string): string {
  return normalizeGuess(text).replace(/^להקת /, '');
}

/** Typos allowed for an expected text of this many letters (spaces removed). */
function allowedTypos(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  if (length <= 14) return 2;
  if (length <= 20) return 3;
  return 4;
}

/** Edit distance where swapping two neighbouring letters counts as one edit (optimal string alignment). */
function editDistance(a: readonly string[], b: readonly string[]): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

function compact(normalized: string): string {
  return normalized.replace(/ /g, '');
}

/**
 * Every artist and title in the catalog, normalized without spaces. A guess
 * that is exactly one of these names is never accepted as a typo of another
 * name: typing "Believe" means Cher's song, not a slip for "Believer".
 */
export interface KnownNames {
  artists: ReadonlySet<string>;
  titles: ReadonlySet<string>;
}

/**
 * Both already normalized. Spaces are ignored ("acdc" = "ac dc"); typos are
 * allowed by the expected length, unless the guess is exactly another known name.
 */
function closeEnough(guess: string, expected: string, otherNames?: ReadonlySet<string>): boolean {
  const g = compact(guess);
  const e = compact(expected);
  if (g.length === 0 || e.length === 0) return false;
  if (g === e) return true;
  if (otherNames?.has(g)) return false;
  const max = allowedTypos(Array.from(e).length);
  const gChars = Array.from(g);
  const eChars = Array.from(e);
  if (Math.abs(gChars.length - eChars.length) > max) return false;
  return editDistance(gChars, eChars) <= max;
}

/** Splits a raw credit or guess into contributors: "&", "+", ",", feat./ft./featuring, with, and, x, vs., עם, and Hebrew "ו". */
const LATIN_SEPARATORS = /\s*(?:&|\+|,)\s*|\s+(?:feat\.?|ft\.?|featuring|with|and|x|vs\.?|עם)\s+/i;
const HEBREW_AND = /\s+ו(?=[א-ת])/;
const HEBREW = /[֐-׿]/;

function splitContributors(raw: string): string[] {
  let parts = raw.split(LATIN_SEPARATORS);
  if (HEBREW.test(raw)) parts = parts.flatMap((p) => p.split(HEBREW_AND));
  return parts.map(normalizeArtistGuess).filter((p) => p.length > 0);
}

/** True if every guessed part matches a different entry of `pool`. */
function matchesDistinct(parts: readonly string[], pool: readonly string[], otherNames?: ReadonlySet<string>): boolean {
  const used = new Set<number>();
  return parts.every((part) => {
    const index = pool.findIndex((entry, i) => !used.has(i) && closeEnough(part, entry, otherNames));
    if (index < 0) return false;
    used.add(index);
    return true;
  });
}

/**
 * Contributors that count when named on their own: a credited name of at least
 * two words ("Bradley Cooper" in "Lady Gaga & Bradley Cooper"), or any catalog
 * `artistKeys` entry. One-word parts of a band name ("Earth" in "Earth, Wind &
 * Fire", "חלב" in "חלב ודבש") never count alone.
 */
function soloContributors(song: GuessSong): string[] {
  const solo = splitContributors(song.artist).filter((p) => p.includes(' '));
  for (const key of song.artistKeys ?? []) solo.push(...splitContributors(key));
  return [...new Set(solo)];
}

/**
 * The artist guess is right if it matches the whole credit or an alias, names
 * the same contributors in any order, or names only contributors that count on
 * their own. A wrong extra name makes the whole guess wrong.
 */
export function isArtistCorrect(song: GuessSong, guess: string, known?: KnownNames): boolean {
  const others = known?.artists;
  const whole = normalizeArtistGuess(guess);
  if (whole.length === 0) return false;
  const names = [song.artist, ...(song.artistAliases ?? [])];
  if (names.some((name) => closeEnough(whole, normalizeArtistGuess(name), others))) return true;

  const parts = splitContributors(guess);
  if (parts.length === 0) return false;
  const credit = splitContributors(song.artist);
  if (credit.length > 1 && parts.length === credit.length && matchesDistinct(parts, credit, others)) return true;
  return matchesDistinct(parts, soloContributors(song), others);
}

const PART_SUFFIX = /,?\s*\b(?:part|pt\.?)\s*(?:\d+|[ivx]+)\s*$/i;
/** Bracketed text counts as a title on its own only from three words up: "(I Feel Good)" yes, "(Tell Me)" no. */
const MIN_BRACKET_WORDS = 3;

function titleCandidates(song: GuessSong): string[] {
  const out = new Set<string>();
  const add = (text: string): void => {
    const n = normalizeGuess(text);
    if (n.length > 0) out.add(n);
  };
  const core = song.title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ');
  for (const text of [song.title, core]) {
    add(text);
    add(text.replace(PART_SUFFIX, ''));
  }
  for (const match of song.title.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)) {
    const inner = normalizeGuess(match[1] ?? match[2] ?? '');
    if (inner.split(' ').length >= MIN_BRACKET_WORDS) out.add(inner);
  }
  for (const alias of song.titleAliases ?? []) add(alias);
  return [...out];
}

/** The title guess is right if it matches the full title, the title without brackets, a long enough bracketed part, or an alias. */
export function isTitleCorrect(song: GuessSong, guess: string, known?: KnownNames): boolean {
  const g = normalizeGuess(guess);
  if (g.length === 0) return false;
  return titleCandidates(song).some((candidate) => closeEnough(g, candidate, known?.titles));
}

export function judgeGuess(song: GuessSong, guess: GuessInput, known?: KnownNames): GuessResult {
  return {
    artistCorrect: isArtistCorrect(song, guess.artist, known),
    titleCorrect: isTitleCorrect(song, guess.title, known),
  };
}

/** Builds the KnownNames of a catalog once, at startup. */
export function buildKnownNames(songs: readonly GuessSong[]): KnownNames {
  const artists = new Set<string>();
  const titles = new Set<string>();
  for (const song of songs) {
    for (const name of [song.artist, ...(song.artistKeys ?? []), ...(song.artistAliases ?? [])]) {
      artists.add(compact(normalizeArtistGuess(name)));
      for (const part of splitContributors(name)) artists.add(compact(part));
    }
    for (const candidate of titleCandidates(song)) titles.add(compact(candidate));
  }
  artists.delete('');
  titles.delete('');
  return { artists, titles };
}

/** Validates the body of POST /api/songs/:id/guess. Both fields optional; an empty body is a blank guess. */
export function parseGuessRequest(body: unknown): ParseResult<GuessInput> {
  if (body === undefined || body === null) return { ok: true, value: { artist: '', title: '' } };
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const value: GuessInput = { artist: '', title: '' };
  for (const field of ['artist', 'title'] as const) {
    const raw = b[field];
    if (raw === undefined) continue;
    if (typeof raw !== 'string') return { ok: false, message: `${field} must be a string` };
    if (raw.length > MAX_GUESS_LENGTH) return { ok: false, message: `${field} must be at most ${MAX_GUESS_LENGTH} characters` };
    value[field] = raw;
  }
  return { ok: true, value };
}
