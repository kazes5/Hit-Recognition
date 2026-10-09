export const LANGUAGES = ['he', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENRES = [
  'pop',
  'rock',
  'light-rock',
  'classic-rock',
  'classic-hebrew',
  'army-bands',
  'hiphop',
  'soul-rnb',
  'disco-dance',
] as const;
export type Genre = (typeof GENRES)[number];

/** 1 easy, 2 medium, 3 hard. */
export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const MAX_DIFFICULTY: Difficulty = 3;

/** The song as sent to clients: no genre, no difficulty, no catalog-only fields. */
export interface PublicSong {
  /** Unique, also the printed card number. */
  id: number;
  artist: string;
  title: string;
  /** Original release year (not remaster / compilation). */
  year: number;
  language: Language;
}

export interface Song extends PublicSong {
  /** Internal only (catalog balance and reports); never sent to clients. */
  genre: Genre;
}

/**
 * Catalog entry. `artistKeys` optionally lists every contributing artist (e.g. a
 * featured artist not named in `artist`). `itunesTrackId` optionally pins the
 * exact iTunes track, so the preview is looked up by id instead of by name.
 * `artistAliases` / `titleAliases` are other names a player's guess may use
 * (a Latin spelling of a Hebrew artist, a well-known alternative title).
 * `difficulty` (1 easy, 2 medium, 3 hard) is required.
 * All are internal only; never sent to clients.
 */
export interface CatalogSong extends Song {
  /** Internal only; used by the maxDifficulty filter of POST /api/songs/next. */
  difficulty: Difficulty;
  artistKeys?: string[];
  itunesTrackId?: number;
  artistAliases?: string[];
  titleAliases?: string[];
}

export function toPublicSong(song: PublicSong): PublicSong {
  const { id, artist, title, year, language } = song;
  return { id, artist, title, year, language };
}

export interface ApiError {
  error: string;
  message: string;
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && (GENRES as readonly string[]).includes(value);
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'number' && (DIFFICULTIES as readonly number[]).includes(value);
}
