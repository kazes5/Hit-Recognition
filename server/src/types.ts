export const LANGUAGES = ['he', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENRES = ['pop', 'rock', 'light-rock', 'classic-rock'] as const;
export type Genre = (typeof GENRES)[number];

export interface Song {
  /** Unique, also the printed card number. */
  id: number;
  artist: string;
  title: string;
  /** Original release year (not remaster / compilation). */
  year: number;
  language: Language;
  genre: Genre;
}

/**
 * Catalog entry. `artistKeys` optionally lists every contributing artist (e.g. a
 * featured artist not named in `artist`). `itunesTrackId` optionally pins the
 * exact iTunes track, so the preview is looked up by id instead of by name.
 * `artistAliases` / `titleAliases` are other names a player's guess may use
 * (a Latin spelling of a Hebrew artist, a well-known alternative title).
 * All are internal only; never sent to clients.
 */
export interface CatalogSong extends Song {
  artistKeys?: string[];
  itunesTrackId?: number;
  artistAliases?: string[];
  titleAliases?: string[];
}

export function toPublicSong(song: Song): Song {
  const { id, artist, title, year, language, genre } = song;
  return { id, artist, title, year, language, genre };
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
