import { readFileSync } from 'node:fs';
import { isGenre, isLanguage, type CatalogSong } from './types.js';

export const MIN_YEAR = 1950;
export const MAX_YEAR = 2025;

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates raw catalog data. Throws a CatalogError listing every problem found.
 */
export function validateCatalog(data: unknown): CatalogSong[] {
  if (!Array.isArray(data)) {
    throw new CatalogError('Song catalog must be a JSON array');
  }
  const problems: string[] = [];
  const ids = new Set<number>();
  const keys = new Set<string>();
  const songs: CatalogSong[] = [];

  data.forEach((raw: unknown, index) => {
    const where = `song #${index}`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      problems.push(`${where}: must be an object`);
      return;
    }
    const s = raw as Record<string, unknown>;
    const label = `${where} (id ${String(s.id)})`;
    let ok = true;
    const fail = (msg: string): void => {
      problems.push(`${label}: ${msg}`);
      ok = false;
    };

    if (typeof s.id !== 'number' || !Number.isInteger(s.id) || s.id <= 0) {
      fail('id must be a positive integer');
    } else if (ids.has(s.id)) {
      fail('duplicate id');
    } else {
      ids.add(s.id);
    }
    if (!isNonEmptyString(s.artist)) fail('artist is required');
    if (!isNonEmptyString(s.title)) fail('title is required');
    if (typeof s.year !== 'number' || !Number.isInteger(s.year) || s.year < MIN_YEAR || s.year > MAX_YEAR) {
      fail(`year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}`);
    }
    if (!isLanguage(s.language)) fail('language must be "he" or "en"');
    if (!isGenre(s.genre)) fail('genre must be one of pop, rock, light-rock, classic-rock');
    if (
      s.artistKeys !== undefined &&
      (!Array.isArray(s.artistKeys) || s.artistKeys.length === 0 || !s.artistKeys.every(isNonEmptyString))
    ) {
      fail('artistKeys, if present, must be a non-empty array of non-empty strings');
    }
    if (
      s.itunesTrackId !== undefined &&
      (typeof s.itunesTrackId !== 'number' || !Number.isInteger(s.itunesTrackId) || s.itunesTrackId <= 0)
    ) {
      fail('itunesTrackId, if present, must be a positive integer');
    }

    if (isNonEmptyString(s.artist) && isNonEmptyString(s.title)) {
      const key = `${s.artist.trim().toLowerCase()}|${s.title.trim().toLowerCase()}`;
      if (keys.has(key)) fail('duplicate artist + title');
      keys.add(key);
    }

    if (ok) {
      const song: CatalogSong = {
        id: s.id as number,
        artist: (s.artist as string).trim(),
        title: (s.title as string).trim(),
        year: s.year as number,
        language: s.language as CatalogSong['language'],
        genre: s.genre as CatalogSong['genre'],
      };
      if (Array.isArray(s.artistKeys)) song.artistKeys = (s.artistKeys as string[]).map((k) => k.trim());
      if (typeof s.itunesTrackId === 'number') song.itunesTrackId = s.itunesTrackId;
      songs.push(song);
    }
  });

  if (songs.length === 0 && problems.length === 0) {
    problems.push('catalog is empty');
  }
  if (problems.length > 0) {
    const shown = problems.slice(0, 20).join('\n  ');
    const more = problems.length > 20 ? `\n  ...and ${problems.length - 20} more` : '';
    throw new CatalogError(`Invalid song catalog (${problems.length} problem(s)):\n  ${shown}${more}`);
  }
  return songs;
}

export function loadCatalog(filePath: string): CatalogSong[] {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new CatalogError(`Cannot read song catalog at ${filePath}: ${(err as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new CatalogError(`Song catalog ${filePath} is not valid JSON: ${(err as Error).message}`);
  }
  return validateCatalog(data);
}
