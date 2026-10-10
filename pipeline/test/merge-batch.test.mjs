import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCatalog } from '../build/catalog-io.mjs';
import { mergeBatch } from '../merge-batch.mjs';

const catalog = readCatalog();
const song = (o) => ({ artist: 'זמר', title: 'שיר', year: 1985, language: 'he', genre: 'pop', difficulty: 2, itunesTrackId: 1, ...o });
const genres = { 'זמר תווית': { genre: 'rock', exclude: false }, 'זמר מוחרג': { genre: 'pop', exclude: true } };

test('accepted and newly labelled pending songs are added; excluded, unlabelled and owner-decided ones are skipped', () => {
  const r = mergeBatch(
    catalog,
    {
      batch: [song({ title: 'שיר א' }), song({ artist: 'שוקי ודורית', title: 'גן נעול' })],
      pending: [song({ artist: 'זמר תווית', title: 'שיר ב', genre: null }), song({ artist: 'זמר מוחרג', title: 'שיר ג', genre: null }), song({ artist: 'זמר בלי תווית', title: 'שיר ד', genre: null })],
    },
    { artistGenres: genres, songDecisions: { exclude: [{ artist: 'שוקי ודורית', title: 'גן נעול' }] } },
  );
  assert.deepEqual(r.added.map((s) => [s.title, s.genre]), [['שיר א', 'pop'], ['שיר ב', 'rock']]);
  assert.deepEqual(r.skipped.map((s) => [s.title, s.reason]), [
    ['גן נעול', 'owner-excluded'],
    ['שיר ג', 'excluded-performer'],
    ['שיר ד', 'performer still has no genre label'],
  ]);
  assert.equal(r.catalog.length, catalog.length + 2);
});
