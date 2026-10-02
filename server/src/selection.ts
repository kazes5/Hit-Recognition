import { LANGUAGES, isLanguage, type CatalogSong, type Language } from './types.js';

export interface NextSongCriteria {
  excludeIds: number[];
  excludeArtists: string[];
  languages: Language[];
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

function pick<T>(items: readonly T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[index] as T;
}

/**
 * Picks a random song that is not excluded, in one of the requested languages.
 * Prefers songs sharing no contributing artist with `excludeArtists` (full artist
 * strings as shown on cards; each is split into contributors and expanded with the
 * catalog's extra `artistKeys` for that credit). Falls back to a repeated artist
 * only when nothing else is left. Returns null when no song remains.
 */
export function selectNextSong<S extends CatalogSong>(
  songs: readonly S[],
  criteria: NextSongCriteria,
  rng: Rng = Math.random,
): S | null {
  const excludedIds = new Set(criteria.excludeIds);
  const languages = new Set(criteria.languages);

  const candidates = songs.filter((s) => !excludedIds.has(s.id) && languages.has(s.language));
  if (candidates.length === 0) return null;

  const excludedKeys = new Set<string>();
  if (criteria.excludeArtists.length > 0) {
    const wanted = new Set(criteria.excludeArtists.map(normalizeArtistKey));
    for (const name of criteria.excludeArtists) for (const k of splitArtistKeys(name)) excludedKeys.add(k);
    for (const s of songs) {
      if (wanted.has(normalizeArtistKey(s.artist))) for (const k of songArtistKeys(s)) excludedKeys.add(k);
    }
  }

  const fresh = candidates.filter((s) => !songArtistKeys(s).some((k) => excludedKeys.has(k)));
  return pick(fresh.length > 0 ? fresh : candidates, rng);
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Validates the body of POST /api/songs/next. All fields optional. */
export function parseNextSongRequest(body: unknown): ParseResult<NextSongCriteria> {
  if (body === undefined || body === null) {
    return { ok: true, value: { excludeIds: [], excludeArtists: [], languages: [...LANGUAGES] } };
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

  return { ok: true, value: { excludeIds, excludeArtists, languages } };
}
