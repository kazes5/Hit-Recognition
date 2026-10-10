// Catalog recheck (task 3.8) with stubbed lookups and catalog-io.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { applyCommand } from '../../recheck.mjs';
import { applyFixes, classifyRecheck, runRecheck } from '../recheck-flow.mjs';

const tmp = () => mkdtempSync(path.join(tmpdir(), 'recheck-test-'));
const res = (wikipedia, wikidata, musicbrainz, { preview = true, errors = {}, store = null } = {}) => {
  const ys = [wikipedia, wikidata, musicbrainz].filter(Number.isInteger);
  const counts = {};
  for (const y of ys) counts[y] = (counts[y] ?? 0) + 1;
  const agreed = Object.entries(counts).find(([, n]) => n >= 2);
  const agreeing = agreed ? ['wikipedia', 'wikidata', 'musicbrainz'].filter((k, i) => [wikipedia, wikidata, musicbrainz][i] === Number(agreed[0])) : [];
  return {
    years: { wikipedia, wikidata, musicbrainz, store },
    rule: { year: agreed ? Number(agreed[0]) : ys.length ? Math.min(...ys) : null, accepted: !!agreed, flags: [], notes: [], agreeing },
    itunes: preview ? { trackId: 42, preview: true, artistMatch: true, trackName: 't', artistName: 'a' } : null,
    errors,
  };
};
const en = (year) => ({ id: 1, artist: 'Roxette', title: 'The Look', year, language: 'en' });
const he = (year) => ({ id: 2, artist: 'זמר', title: 'שיר', year, language: 'he' });

test('classify: all three confirm the catalog → ok', () => {
  assert.deepEqual(classifyRecheck(en(1989), res(1989, 1989, 1989)).action, 'ok');
});

test('classify: one source confirms, others differ → ok (catalog checked by hand)', () => {
  const c = classifyRecheck(en(1989), res(1989, 1988, 1990));
  assert.equal(c.action, 'ok');
});

test('classify: no source has a year → ok', () => {
  assert.equal(classifyRecheck(en(1989), res(null, null, null)).action, 'ok');
});

test('classify: all three agree on another year → automatic fix (D8)', () => {
  const c = classifyRecheck(en(1989), res(1988, 1988, 1988));
  assert.equal(c.action, 'fix');
  assert.equal(c.fix, 1988);
  assert.deepEqual(c.sources, { wikipedia: 1988, wikidata: 1988, musicbrainz: 1988, store: null });
});

test('classify: Hebrew 1970+ unanimous → fix', () => {
  const c = classifyRecheck(he(2013), res(2012, 2012, 2012));
  assert.equal(c.action, 'fix');
  assert.equal(c.fix, 2012);
});

test('classify: Hebrew before 1970 is never fixed automatically (new or old year before 1970)', () => {
  assert.deepEqual(classifyRecheck(he(1958), res(1957, 1957, 1957)).reasons, ['pre-1970-hebrew']);
  assert.deepEqual(classifyRecheck(he(1971), res(1969, 1969, 1969)).reasons, ['pre-1970-hebrew']);
  assert.deepEqual(classifyRecheck(he(1968), res(1970, 1970, 1970)).reasons, ['pre-1970-hebrew']);
  // English before 1970 is fixed.
  assert.equal(classifyRecheck({ ...en(1969), title: 'Proud Mary' }, res(1968, 1968, 1968)).action, 'fix');
});

test('classify: two sources agree on another year → flagged', () => {
  const c = classifyRecheck(en(2004), res(2002, 2002, 2004));
  assert.equal(c.action, 'flag');
  assert.deepEqual(c.reasons, ['two-sources-differ']);
  assert.deepEqual(classifyRecheck(en(2004), res(2002, 2002, null)).reasons, ['two-sources-differ']);
});

test('classify: sources give years, none is the catalog year → flagged', () => {
  assert.deepEqual(classifyRecheck(en(2004), res(2001, null, 2003)).reasons, ['no-source-confirms']);
  assert.deepEqual(classifyRecheck(en(2004), res(null, 2003, null)).reasons, ['no-source-confirms']);
});

test('classify: no preview → flagged, also next to a fix reason; network errors marked', () => {
  assert.deepEqual(classifyRecheck(en(1989), res(1989, 1989, 1989, { preview: false })).reasons, ['no-preview']);
  const c = classifyRecheck(en(1989), res(1988, 1988, 1988, { preview: false, errors: { it: 'HTTP 503' } }));
  assert.equal(c.action, 'flag');
  assert.deepEqual(c.reasons, ['no-preview', 'lookup-error']);
});

const CATALOG = [
  { id: 1, artist: 'Roxette', title: 'The Look', year: 1989, language: 'en', genre: 'pop', difficulty: 1 },
  { id: 2, artist: 'Maroon 5', title: 'This Love', year: 2004, language: 'en', genre: 'pop', difficulty: 1 },
  { id: 3, artist: 'אריס סאן', title: 'ערב של שושנים', year: 1958, language: 'he', genre: 'classic-hebrew', difficulty: 1 },
  { id: 4, artist: 'Oasis', title: 'Wonderwall', year: 1995, language: 'en', genre: 'rock', difficulty: 1 },
  { id: 5, artist: 'עידן עמדי', title: 'נגמר', year: 2013, language: 'he', genre: 'pop', difficulty: 1, artistAliases: ['Idan Amedi'] },
];
const LOOK = {
  'The Look': res(1988, 1988, 1988),
  'This Love': res(2002, 2002, 2004),
  'ערב של שושנים': res(1957, 1957, 1957),
  Wonderwall: res(1995, 1995, 1995, { preview: false }),
  'נגמר': res(2013, 2013, 2012),
};

function deps() {
  const calls = { lookup: [], written: null };
  return {
    calls,
    readCatalog: async () => structuredClone(CATALOG),
    writeCatalog: async (songs) => {
      calls.written = songs;
    },
    lookup: async (song) => {
      calls.lookup.push(song);
      return structuredClone(LOOK[song.title]);
    },
    httpStats: () => ({ requests: 5, cacheHits: 0, retries: 0, errors: 0 }),
  };
}

test('runRecheck writes fixes, flagged CSV, track ids and the report', async () => {
  const out = tmp();
  const d = deps();
  const r = await runRecheck({ out, deps: d });
  assert.equal(d.calls.lookup.length, 5);
  assert.deepEqual(d.calls.lookup.find((s) => s.id === 5).artistAliases, ['Idan Amedi']);
  const fixes = JSON.parse(readFileSync(path.join(out, 'recheck-fixes.json'), 'utf8'));
  assert.deepEqual(fixes, [{ id: 1, artist: 'Roxette', title: 'The Look', language: 'en', old: 1989, new: 1988, sources: { wikipedia: 1988, wikidata: 1988, musicbrainz: 1988, store: null } }]);
  assert.deepEqual(
    r.flagged.map((f) => [f.id, f.reasons]),
    [
      [2, ['two-sources-differ']],
      [3, ['pre-1970-hebrew']],
      [4, ['no-preview']],
    ],
  );
  const csv = readFileSync(path.join(out, 'recheck-flagged.csv'), 'utf8');
  assert.match(csv, /^﻿id,artist,title,language,year,wikipedia,wikidata,musicbrainz,store,proposedYear,reasons/);
  assert.match(csv, /3,אריס סאן,ערב של שושנים,he,1958,1957,1957,1957,,1957,pre-1970-hebrew/);
  const ids = JSON.parse(readFileSync(path.join(out, 'recheck-trackids.json'), 'utf8'));
  assert.deepEqual(ids.map((x) => x.id), [1, 2, 3, 5]);
  const report = readFileSync(path.join(out, 'recheck-report.md'), 'utf8');
  assert.match(report, /\*\*Automatic fixes\*\* \(D8\) \| 1 \| 0 \| 1 \|/); // columns: en, he, total
  assert.match(report, /\| 1 \| Roxette \| The Look \| 1989 \| 1988 \|/);
  assert.match(report, /\| two-sources-differ \| 1 \|/);
  assert.match(report, /\*\*Flagged\*\* \| 2 \| 1 \| 3 \|/);
});

test('runRecheck resumes from the progress log; --ids and --limit narrow the run', async () => {
  const out = tmp();
  await runRecheck({ out, deps: deps(), limit: 2 });
  const d = deps();
  const r = await runRecheck({ out, deps: d });
  assert.deepEqual(d.calls.lookup.map((s) => s.id), [3, 4, 5]);
  assert.match(r.report, /2 from the progress log/);
  const d2 = deps();
  await runRecheck({ out: tmp(), deps: d2, ids: [4] });
  assert.deepEqual(d2.calls.lookup.map((s) => s.id), [4]);
});

test('applyFixes changes only matching songs and keeps key order', () => {
  const fixes = [
    { id: 1, artist: 'Roxette', title: 'The Look', old: 1989, new: 1988 },
    { id: 2, artist: 'Maroon 5', title: 'This Love', old: 2003, new: 2002 }, // catalog changed since
    { id: 99, artist: 'x', title: 'y', old: 2000, new: 2001 },
  ];
  const { songs, applied, skipped } = applyFixes(CATALOG, fixes);
  assert.equal(songs[0].year, 1988);
  assert.deepEqual(Object.keys(songs[0]), Object.keys(CATALOG[0]));
  assert.equal(songs[1].year, 2004);
  assert.deepEqual(applied.map((f) => f.id), [1]);
  assert.deepEqual(skipped.map((s) => s.fix.id), [2, 99]);
  assert.equal(CATALOG[0].year, 1989, 'input not mutated');
});

test('recheck --apply writes the catalog through catalog-io only when a fix applies', async () => {
  const dir = tmp();
  const file = path.join(dir, 'recheck-fixes.json');
  writeFileSync(file, JSON.stringify([{ id: 1, artist: 'Roxette', title: 'The Look', old: 1989, new: 1988 }]));
  const d = deps();
  const r = await applyCommand({ fixesFile: file, deps: d, log: () => {} });
  assert.equal(r.applied.length, 1);
  assert.equal(d.calls.written.find((s) => s.id === 1).year, 1988);
  assert.equal(d.calls.written.length, 5);

  writeFileSync(file, JSON.stringify([{ id: 1, artist: 'Roxette', title: 'The Look', old: 1990, new: 1988 }]));
  const d2 = deps();
  await applyCommand({ fixesFile: file, deps: d2, log: () => {} });
  assert.equal(d2.calls.written, null);
});

test('the recheck request file exists (it triggers the workflow)', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../recheck-request.json', import.meta.url), 'utf8')), { reason: 'first run' });
});
