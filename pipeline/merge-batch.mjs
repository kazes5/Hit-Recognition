#!/usr/bin/env node
// Merge one batch into server/data/songs.json (task 3.7, last step).
//
//   node pipeline/merge-batch.mjs <batch dir> [--dry-run]
//
// Reads <dir>/batch.json (accepted songs) and <dir>/pending-genre.json (year settled, performer
// had no genre label). A pending song gets its genre from artist-genres.json now; it is skipped
// when its performer is excluded (D5) or still has no label. Songs in song-decisions.json
// (owner exclusions and known duplicates) are skipped. merge.mjs assigns ids and refuses
// duplicates of catalog songs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog, writeCatalog } from './build/catalog-io.mjs';
import { assignGenre } from './build/genre.mjs';
import { addSongs } from './build/merge.mjs';
import { decisionIndex } from './orchestrate/batch-flow.mjs';
import { readArtistGenres, readSongDecisions } from './orchestrate/deps.mjs';
import { norm, normArtist } from './sources/normalize.mjs';

const GENRES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artist-genres.json');

/** Pure: → { catalog, added: songs[], skipped: [{ artist, title, reason }] } */
export function mergeBatch(catalog, { batch = [], pending = [] }, { artistGenres, songDecisions = {} }) {
  const decided = decisionIndex(songDecisions);
  const skipped = [];
  const ready = [];
  for (const s of [...batch, ...pending.map((p) => ({ ...p, pending: true }))]) {
    const { pending: isPending, ...song } = s;
    const d = decided.get(`${normArtist(song.artist)}|${norm(song.title)}`);
    if (d) {
      skipped.push({ artist: song.artist, title: song.title, reason: d });
      continue;
    }
    if (isPending || !song.genre) {
      const g = assignGenre({ ...song, source: 'batch' }, artistGenres) ?? {};
      if (g.excluded) {
        skipped.push({ artist: song.artist, title: song.title, reason: 'excluded-performer' });
        continue;
      }
      if (!g.genre) {
        skipped.push({ artist: song.artist, title: song.title, reason: 'performer still has no genre label' });
        continue;
      }
      song.genre = g.genre;
    }
    ready.push(song);
  }
  const out = addSongs(catalog, ready);
  const added = out.slice(catalog.length);
  // Every catalog credit needs its own artist-genres entry (apply-genres --check): a credit whose
  // genre came from its members or from the army-band prefix gets one, saying where it came from.
  const newCredits = {};
  for (const s of added) {
    if (artistGenres[s.artist] || newCredits[s.artist]) continue;
    const g = assignGenre({ ...s, source: 'batch' }, artistGenres) ?? {};
    newCredits[s.artist] = { genre: s.genre, exclude: false, note: g.via?.length ? `from ${g.via.join(' + ')}` : g.genre === 'army-bands' ? 'army band (name)' : 'genre given by the batch' };
  }
  return { catalog: out, added, skipped, newCredits };
}

function main(argv) {
  const dir = argv.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: node pipeline/merge-batch.mjs <batch dir> [--dry-run]');
    process.exit(2);
  }
  const read = (f) => (existsSync(path.join(dir, f)) ? JSON.parse(readFileSync(path.join(dir, f), 'utf8')) : []);
  const catalog = readCatalog();
  const r = mergeBatch(catalog, { batch: read('batch.json'), pending: read('pending-genre.json') }, { artistGenres: readArtistGenres(), songDecisions: readSongDecisions() });
  if (!argv.includes('--dry-run')) {
    writeCatalog(r.catalog);
    if (Object.keys(r.newCredits).length) writeFileSync(GENRES_FILE, JSON.stringify({ ...readArtistGenres(), ...r.newCredits }, null, 2) + '\n');
  }
  for (const [credit, v] of Object.entries(r.newCredits)) console.log(`  artist-genres: + "${credit}" ${v.genre} (${v.note})`);
  console.log(`${argv.includes('--dry-run') ? '[dry run] ' : ''}catalog ${catalog.length} -> ${r.catalog.length}: ${r.added.length} added${r.added.length ? ` (ids ${r.added[0].id}-${r.added.at(-1).id})` : ''}, ${r.skipped.length} skipped.`);
  for (const s of r.skipped) console.log(`  skipped: ${s.artist} – ${s.title}: ${s.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
