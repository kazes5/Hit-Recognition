#!/usr/bin/env node
// Applies performer genres (artist-genres.json) and per-song overrides
// (genre-overrides.json) to server/data/songs.json.
//
//   node apply-genres.mjs           write songs.json and print the change list
//   node apply-genres.mjs --check   exit 1 if songs.json would change, a credit is
//                                   missing from artist-genres.json, or a genre id is invalid
//
// Paths can be replaced with --songs <file> --artists <file> --overrides <file> (used by tests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Must match GENRES in server/src/types.ts (a test checks this). */
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
];

/** songs.json layout: one compact JSON object per line inside `[\n ... \n]\n`. */
export function formatSongs(songs) {
  return '[\n' + songs.map((s) => '  ' + JSON.stringify(s)).join(',\n') + '\n]\n';
}

/**
 * Returns { songs, changes, errors }. `songs` are copies with the new genre (key order kept);
 * `changes` lists { id, artist, title, year, language, from, to }; `errors` are problems
 * that make the input files invalid.
 */
export function applyGenres(songs, artistGenres, overrides) {
  const errors = [];
  const ids = new Set(songs.map((s) => String(s.id)));
  for (const [artist, entry] of Object.entries(artistGenres)) {
    if (!entry || !GENRES.includes(entry.genre)) errors.push(`artist-genres: invalid genre "${entry?.genre}" for "${artist}"`);
    if (typeof entry?.exclude !== 'boolean') errors.push(`artist-genres: "exclude" must be true or false for "${artist}"`);
  }
  for (const [id, genre] of Object.entries(overrides)) {
    if (!GENRES.includes(genre)) errors.push(`genre-overrides: invalid genre "${genre}" for song ${id}`);
    if (!ids.has(id)) errors.push(`genre-overrides: unknown song id ${id}`);
  }
  const changes = [];
  const out = songs.map((s) => {
    const entry = artistGenres[s.artist];
    if (!entry) {
      errors.push(`artist-genres: missing credit "${s.artist}" (song ${s.id})`);
      return s;
    }
    const genre = overrides[String(s.id)] ?? entry.genre;
    if (genre === s.genre) return s;
    changes.push({ id: s.id, artist: s.artist, title: s.title, year: s.year, language: s.language, from: s.genre, to: genre });
    return { ...s, genre };
  });
  return { songs: out, changes, errors: [...new Set(errors)] };
}

function parseArgs(argv) {
  const opts = {
    check: false,
    songs: path.join(here, '..', 'server', 'data', 'songs.json'),
    artists: path.join(here, 'artist-genres.json'),
    overrides: path.join(here, 'genre-overrides.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--songs' || a === '--artists' || a === '--overrides') opts[a.slice(2)] = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(opts.songs, 'utf8');
  const songs = JSON.parse(raw);
  if (formatSongs(songs) !== raw) {
    console.error(`${opts.songs}: unexpected format (round trip differs); refusing to rewrite it`);
    process.exit(1);
  }
  const artistGenres = JSON.parse(fs.readFileSync(opts.artists, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(opts.overrides, 'utf8'));
  const { songs: next, changes, errors } = applyGenres(songs, artistGenres, overrides);

  for (const e of errors) console.error('error: ' + e);
  for (const c of changes) console.log(`${c.id}\t${c.artist} - ${c.title} (${c.year})\t${c.from} -> ${c.to}`);
  console.log(`${changes.length} song(s) ${opts.check ? 'would change' : 'changed'}`);

  if (errors.length) process.exit(1);
  if (opts.check) process.exit(changes.length ? 1 : 0);
  if (changes.length) fs.writeFileSync(opts.songs, formatSongs(next));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
