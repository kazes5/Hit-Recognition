import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CATALOG_PATH, readCatalog, writeCatalog } from '../catalog-io.mjs';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-io-')), 'songs.json');

test('the real songs.json round-trips byte for byte', () => {
  const raw = fs.readFileSync(CATALOG_PATH);
  const songs = readCatalog();
  assert.ok(songs.length > 600);
  const out = tmp();
  writeCatalog(songs, out);
  assert.ok(fs.readFileSync(out).equals(raw));
});

test('writes one compact object per line, Hebrew unescaped', () => {
  const out = tmp();
  writeCatalog([{ id: 1, artist: 'א', title: 'ב' }, { id: 2, artist: 'C', title: 'D' }], out);
  assert.equal(fs.readFileSync(out, 'utf8'), '[\n  {"id":1,"artist":"א","title":"ב"},\n  {"id":2,"artist":"C","title":"D"}\n]\n');
  assert.equal(readCatalog(out).length, 2);
});

test('refuses a file in another layout', () => {
  const out = tmp();
  fs.writeFileSync(out, JSON.stringify([{ id: 1 }], null, 2));
  assert.throws(() => readCatalog(out), /round trip/);
});
