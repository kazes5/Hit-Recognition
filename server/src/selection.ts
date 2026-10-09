import {
  LANGUAGES,
  MAX_DIFFICULTY,
  isDifficulty,
  isLanguage,
  type CatalogSong,
  type Difficulty,
  type Language,
} from './types.js';

export interface NextSongCriteria {
  excludeIds: number[];
  excludeArtists: string[];
  languages: Language[];
  /** Highest difficulty to deal (1 easy, 2 medium, 3 hard). Default 3 (all songs). */
  maxDifficulty?: Difficulty;
}

/** Returns a number in [0, 1). */
export type Rng = () => number;

export function normalizeArtistKey(artist: string): string {
  return artist.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^the /, '');
}

const HEBREW = /[֐-׿]/;
/** Latin collaboration separators: "&", "+", ",", "feat.", "ft.", "featuring", " and ", " x ", " vs. ". */
const LATIN_SEPARATORS = /\s*(?:&|\+|,)\s*|\s+(?:feat\.?|ft\.?|featuring|and|x|vs\.?)\s+/i;
/** Hebrew "and" connector: a word starting with "ו" after a space ("יזהר כהן והאלפבתא"). */
const HEBREW_AND = /\s+ו(?=[א-ת])/;

/**
 * Splits an artist credit into normalized contributor keys, so that
 * "Lady Gaga & Bradley Cooper" -> ["lady gaga", "bradley cooper"] and
 * "יזהר כהן והאלפבתא" -> ["יזהר כהן", "האלפבתא"].
 */
export function splitArtistKeys(artist: string): string[] {
  let parts = artist.split(LATIN_SEPARATORS);
  if (HEBREW.test(artist)) parts = parts.flatMap((p) => p.split(HEBREW_AND));
  const keys = parts.map(normalizeArtistKey).filter((k) => k.length > 0);
  return keys.length > 0 ? [...new Set(keys)] : [normalizeArtistKey(artist)];
}

/** All contributor keys of a song: its split credit plus any catalog `artistKeys`. */
export function songArtistKeys(song: Pick<CatalogSong, 'artist' | 'artistKeys'>): string[] {
  const keys = splitArtistKeys(song.artist);
  for (const extra of song.artistKeys ?? []) keys.push(...splitArtistKeys(extra));
  return [...new Set(keys)];
}

interface CatalogIndex {
  /** Normalized credit -> every contributor key of the catalog songs with that credit. */
  keysByCredit: Map<string, string[]>;
  keysBySong: Map<CatalogSong, string[]>;
}

const catalogIndexes = new WeakMap<readonly CatalogSong[], CatalogIndex>();

/**
 * Contributor keys of a catalog, computed once per catalog array. Without it
 * every excludeArtists entry re-scanned the whole catalog, which made a long
 * game (hundreds of entries) take seconds per request.
 */
function catalogIndex(songs: readonly CatalogSong[]): CatalogIndex {
  let index = catalogIndexes.get(songs);
  if (!index) {
    index = { keysByCredit: new Map(), keysBySong: new Map() };
    for (const s of songs) {
      const keys = songArtistKeys(s);
      index.keysBySong.set(s, keys);
      const credit = normalizeArtistKey(s.artist);
      index.keysByCredit.set(credit, [...new Set([...(index.keysByCredit.get(credit) ?? []), ...keys])]);
    }
    catalogIndexes.set(songs, index);
  }
  return index;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[index] as T;
}

/** In one game, at most this many songs by the same performer (a further one only when nothing else is left). */
export const MAX_SONGS_PER_ARTIST_IN_GAME = 2;

/**
 * Picks a random song that is not excluded, in one of the requested languages,
 * with a difficulty of at most `maxDifficulty` (default 3). If no such song is
 * left, the limit is raised one level at a time (up to 3) before giving up; the
 * language filter never falls back.
 * `excludeArtists` holds one entry per song already dealt in the game (full artist
 * strings as shown on cards; duplicates are meaningful). Each entry is split into
 * contributors and expanded with the catalog's extra `artistKeys` for that credit,
 * and counts once for every contributor. Selection is tiered and soft: first songs
 * whose contributors were not dealt yet, then songs whose contributors were dealt
 * fewer than MAX_SONGS_PER_ARTIST_IN_GAME times, then any remaining song.
 * Returns null when no song remains.
 */
export function selectNextSong<S extends CatalogSong>(
  songs: readonly S[],
  criteria: NextSongCriteria,
  rng: Rng = Math.random,
): S | null {
  const excludedIds = new Set(criteria.excludeIds);
  const languages = new Set(criteria.languages);

  const available = songs.filter((s) => !excludedIds.has(s.id) && languages.has(s.language));
  let candidates: S[] = [];
  for (let level = criteria.maxDifficulty ?? MAX_DIFFICULTY; level <= MAX_DIFFICULTY; level++) {
    candidates = available.filter((s) => s.difficulty <= level);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) return null;
  if (criteria.excludeArtists.length === 0) return pick(candidates, rng);

  const index = catalogIndex(songs);
  const counts = new Map<string, number>();
  for (const name of criteria.excludeArtists) {
    const keys = new Set(splitArtistKeys(name));
    for (const k of index.keysByCredit.get(normalizeArtistKey(name)) ?? []) keys.add(k);
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const maxCount = (s: S): number =>
    Math.max(0, ...(index.keysBySong.get(s) ?? songArtistKeys(s)).map((k) => counts.get(k) ?? 0));
  const fresh = candidates.filter((s) => maxCount(s) === 0);
  if (fresh.length > 0) return pick(fresh, rng);
  const underCap = candidates.filter((s) => maxCount(s) < MAX_SONGS_PER_ARTIST_IN_GAME);
  return pick(underCap.length > 0 ? underCap : candidates, rng);
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Validates the body of POST /api/songs/next. All fields optional. */
export function parseNextSongRequest(body: unknown): ParseResult<NextSongCriteria> {
  if (body === undefined || body === null) {
    return {
      ok: true,
      value: { excludeIds: [], excludeArtists: [], languages: [...LANGUAGES], maxDifficulty: MAX_DIFFICULTY },
    };
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  let excludeIds: number[] = [];
  if (b.excludeIds !== undefined) {
    if (!Array.isArray(b.excludeIds) || !b.excludeIds.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { ok: false, message: 'excludeIds must be an array of numbers' };
    }
    excludeIds = b.excludeIds as number[];
  }

  let excludeArtists: string[] = [];
  if (b.excludeArtists !== undefined) {
    if (!Array.isArray(b.excludeArtists) || !b.excludeArtists.every((v) => typeof v === 'string')) {
      return { ok: false, message: 'excludeArtists must be an array of strings' };
    }
    excludeArtists = b.excludeArtists as string[];
  }

  let languages: Language[] = [...LANGUAGES];
  if (b.languages !== undefined) {
    if (!Array.isArray(b.languages) || !b.languages.every(isLanguage)) {
      return { ok: false, message: 'languages must be an array containing only "he" and/or "en"' };
    }
    // An empty list means "no preference" -> both languages.
    if (b.languages.length > 0) languages = [...new Set(b.languages as Language[])];
  }

  let maxDifficulty: Difficulty = MAX_DIFFICULTY;
  if (b.maxDifficulty !== undefined) {
    if (!isDifficulty(b.maxDifficulty)) {
      return { ok: false, message: 'maxDifficulty must be 1, 2 or 3' };
    }
    maxDifficulty = b.maxDifficulty;
  }

  return { ok: true, value: { excludeIds, excludeArtists, languages, maxDifficulty } };
}
