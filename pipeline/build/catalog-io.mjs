// Reads and writes server/data/songs.json in its exact format: one compact JSON
// object per line inside `[\n ... \n]\n` (the same layout as apply-genres.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSongs } from '../apply-genres.mjs';

export { formatSongs };

export const CATALOG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'data', 'songs.json');

/** Parses songs.json. Throws if the file would not round-trip byte for byte (a hand edit in another layout). */
export function readCatalog(file = CATALOG_PATH) {
  const raw = fs.readFileSync(file, 'utf8');
  const songs = JSON.parse(raw);
  if (!Array.isArray(songs)) throw new Error(`${file}: expected a JSON array`);
  if (formatSongs(songs) !== raw) throw new Error(`${file}: unexpected format (round trip differs); refusing to use it`);
  return songs;
}

/** Writes songs in the songs.json layout. */
export function writeCatalog(songs, file = CATALOG_PATH) {
  if (!Array.isArray(songs)) throw new Error('writeCatalog: expected an array of songs');
  fs.writeFileSync(file, formatSongs(songs));
}
