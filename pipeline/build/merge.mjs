// Task 3.3: add accepted songs to the catalog.
//
// addSongs(catalog, accepted) → a new catalog array (inputs are not changed).
//   - ids: the next ids after the highest id in the catalog, in the order given
//     (an `id` on an accepted song is ignored);
//   - key order: id, artist, title, year, language, genre, difficulty, then artistKeys,
//     artistAliases, titleAliases and itunesTrackId when present;
//   - throws (adding nothing) when any song is invalid, already in the catalog (also
//     under another spelling, see match.mjs), or repeated within `accepted`.
import { GENRES } from '../apply-genres.mjs';
import { findInCatalog, indexCatalog, sameSong } from './match.mjs';

export const LANGUAGES = ['he', 'en'];
export const KEY_ORDER = ['id', 'artist', 'title', 'year', 'language', 'genre', 'difficulty', 'artistKeys', 'artistAliases', 'titleAliases', 'itunesTrackId'];
const ARRAY_KEYS = ['artistKeys', 'artistAliases', 'titleAliases'];

const HEBREW_LETTER = /[א-ת]/;
const LATIN_LETTER = /[A-Za-z]/;

/** Problems of one song (without its id). [] when valid. */
export function validateSong(song, { maxYear = new Date().getUTCFullYear() + 1 } = {}) {
  const errors = [];
  const label = `"${song?.artist} - ${song?.title}"`;
  if (!song || typeof song !== 'object') return ['not an object'];
  for (const key of Object.keys(song)) if (!KEY_ORDER.includes(key)) errors.push(`${label}: unknown field "${key}"`);
  for (const key of ['artist', 'title']) {
    if (typeof song[key] !== 'string' || song[key].trim() === '' || song[key] !== song[key].trim()) errors.push(`${label}: ${key} must be a non-empty trimmed string`);
  }
  if (!Number.isInteger(song.year) || song.year < 1900 || song.year > maxYear) errors.push(`${label}: invalid year ${song.year}`);
  if (!LANGUAGES.includes(song.language)) errors.push(`${label}: invalid language ${song.language}`);
  if (!GENRES.includes(song.genre)) errors.push(`${label}: invalid genre ${song.genre}`);
  if (![1, 2, 3].includes(song.difficulty)) errors.push(`${label}: invalid difficulty ${song.difficulty}`);
  if (typeof song.artist === 'string' && typeof song.title === 'string') {
    if (song.language === 'he' && !(HEBREW_LETTER.test(song.artist) && HEBREW_LETTER.test(song.title))) {
      errors.push(`${label}: a Hebrew song needs its artist and title in Hebrew script`);
    }
    if (song.language === 'en' && (HEBREW_LETTER.test(song.artist) || HEBREW_LETTER.test(song.title) || !LATIN_LETTER.test(song.title))) {
      errors.push(`${label}: an English song needs its artist and title in Latin script`);
    }
  }
  for (const key of ARRAY_KEYS) {
    if (song[key] === undefined) continue;
    const v = song[key];
    if (!Array.isArray(v) || v.length === 0 || v.some((x) => typeof x !== 'string' || x.trim() === '') || new Set(v).size !== v.length) {
      errors.push(`${label}: ${key} must be a non-empty array of distinct non-empty strings`);
    }
  }
  if (song.itunesTrackId !== undefined && !(Number.isInteger(song.itunesTrackId) && song.itunesTrackId > 0)) {
    errors.push(`${label}: itunesTrackId must be a positive integer`);
  }
  return errors;
}

/** A copy of the song with keys in catalog order (absent optional keys left out). */
export function orderKeys(song) {
  const out = {};
  for (const key of KEY_ORDER) if (song[key] !== undefined) out[key] = song[key];
  return out;
}

export function addSongs(catalog, accepted, options = {}) {
  const errors = [];
  const index = indexCatalog(catalog);
  let nextId = catalog.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  const added = [];
  for (const raw of accepted) {
    const { id: _ignored, ...song } = raw;
    const problems = validateSong(song, options);
    errors.push(...problems);
    if (problems.length) continue;
    const { match } = findInCatalog(song, index);
    if (match) {
      errors.push(`"${song.artist} - ${song.title}": already in the catalog as song ${match.id} ("${match.artist} - ${match.title}")`);
      continue;
    }
    const twin = added.find((s) => sameSong(s, song));
    if (twin) {
      errors.push(`"${song.artist} - ${song.title}": repeated in the batch ("${twin.artist} - ${twin.title}")`);
      continue;
    }
    added.push(orderKeys({ ...song, id: nextId++ }));
  }
  if (errors.length) {
    const err = new Error(`addSongs: ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
    err.problems = errors;
    throw err;
  }
  return [...catalog, ...added];
}
