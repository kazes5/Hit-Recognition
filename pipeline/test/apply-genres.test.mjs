import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GENRES, applyGenres, formatSongs } from '../apply-genres.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(dir, '..', 'apply-genres.mjs');
const catalog = path.join(dir, '..', '..', 'server', 'data', 'songs.json');

const sample = [
  { id: 1, artist: 'A', title: 'One', year: 1990, language: 'en', genre: 'pop', difficulty: 1 },
  { id: 2, artist: 'A', title: 'Two', year: 1991, language: 'en', genre: 'pop', difficulty: 1, artistAliases: ['Ay'] },
  { id: 3, artist: 'ב "ג"', title: 'שלוש', year: 1970, language: 'he', genre: 'rock', difficulty: 1 },
];

function tmpFiles({ songs = sample, artists, overrides = {} }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-genres-'));
  const f = { songs: path.join(d, 'songs.json'), artists: path.join(d, 'a.json'), overrides: path.join(d, 'o.json') };
  fs.writeFileSync(f.songs, formatSongs(songs));
  fs.writeFileSync(f.artists, JSON.stringify(artists));
  fs.writeFileSync(f.overrides, JSON.stringify(overrides));
  return f;
}
const run = (f, ...extra) =>
  spawnSync(process.execPath, [script, '--songs', f.songs, '--artists', f.artists, '--overrides', f.overrides, ...extra], { encoding: 'utf8' });

test('the real songs.json round-trips byte for byte', () => {
  const raw = fs.readFileSync(catalog, 'utf8');
  assert.equal(formatSongs(JSON.parse(raw)), raw);
});

test('GENRES matches server/src/types.ts', () => {
  const ts = fs.readFileSync(path.join(dir, '..', '..', 'server', 'src', 'types.ts'), 'utf8');
  const block = ts.match(/export const GENRES = \[([\s\S]*?)\]/)[1];
  assert.deepEqual([...block.matchAll(/'([^']+)'/g)].map((m) => m[1]), GENRES);
});

test('writing preserves format and key order', () => {
  const f = tmpFiles({ artists: { A: { genre: 'soul-rnb', exclude: false }, 'ב "ג"': { genre: 'rock', exclude: false } } });
  const r = run(f);
  assert.equal(r.status, 0, r.stderr);
  const raw = fs.readFileSync(f.songs, 'utf8');
  assert.equal(formatSongs(JSON.parse(raw)), raw);
  const lines = raw.split('\n');
  assert.equal(lines[0], '[');
  assert.equal(lines[2], '  {"id":2,"artist":"A","title":"Two","year":1991,"language":"en","genre":"soul-rnb","difficulty":1,"artistAliases":["Ay"]},');
  assert.match(r.stdout, /2 song\(s\) changed/);
  assert.equal(run(f, '--check').status, 0);
});

test('override wins over the performer default', () => {
  const { songs, changes } = applyGenres(
    sample,
    { A: { genre: 'disco-dance', exclude: false }, 'ב "ג"': { genre: 'rock', exclude: false } },
    { 2: 'pop' },
  );
  assert.deepEqual(songs.map((s) => s.genre), ['disco-dance', 'pop', 'rock']);
  assert.deepEqual(changes.map((c) => [c.id, c.from, c.to]), [[1, 'pop', 'disco-dance']]);
});

test('--check fails when a credit is missing', () => {
  const f = tmpFiles({ artists: { A: { genre: 'pop', exclude: false } } });
  const r = run(f, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing credit "ב "ג"" \(song 3\)/);
});

test('--check fails on an invalid genre id', () => {
  const f = tmpFiles({ artists: { A: { genre: 'pop', exclude: false }, 'ב "ג"': { genre: 'rock', exclude: false } }, overrides: { 1: 'jazz' } });
  const r = run(f, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /invalid genre "jazz"/);
});

test('--check fails when songs.json would change, and does not write', () => {
  const f = tmpFiles({ artists: { A: { genre: 'hiphop', exclude: false }, 'ב "ג"': { genre: 'rock', exclude: false } } });
  const before = fs.readFileSync(f.songs, 'utf8');
  assert.equal(run(f, '--check').status, 1);
  assert.equal(fs.readFileSync(f.songs, 'utf8'), before);
});

test('the committed catalog is in sync with the genre files', () => {
  const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
