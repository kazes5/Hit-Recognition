// Batch flow (task 3.7) with every dependency stubbed: no network, no build/ or candidates/ code.
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { candidateInfo, flagReasons, runBatch, validateRequest } from '../batch-flow.mjs';
import { defaultSelect } from '../deps.mjs';
import { songKey, toCsv } from '../util.mjs';

const tmp = () => mkdtempSync(path.join(tmpdir(), 'batch-test-'));
const REQ = { name: 'test-batch', sources: ['reshet-gimel'], language: 'he', fromYear: 1969, toYear: 1999, size: 300 };

const cand = (artist, title, chartYear, rank, extra = {}) => ({ source: 'reshet-gimel', chartYear, rank, artist, title, language: 'he', page: 'https://he.wikipedia.org/wiki/x', ...extra });

// Lookup results per title.
const ok = (year, extra = {}) => ({
  years: { wikipedia: year, wikidata: year, musicbrainz: year, store: year + 5 },
  rule: { year, accepted: true, flags: [], notes: ['unanimous'], agreeing: ['wikipedia', 'wikidata', 'musicbrainz'] },
  wikipedia: { page: 'P', lang: 'he', qid: 'Q1' },
  itunes: { trackId: 1000 + year, preview: true, artistMatch: true },
  pageViews: 5000,
  deezerRank: 300000,
  errors: {},
  ...extra,
});
const flaggedRule = (flags, year = 1980, years = {}) => ok(year, { rule: { year, accepted: false, flags, notes: [], agreeing: [] }, years: { wikipedia: null, wikidata: null, musicbrainz: null, store: null, ...years } });

const LOOKUPS = {
  'שיר טוב': ok(1987, { aliases: { titleAliases: ['Shir Tov'], artistAliases: ['Known Singer'] } }),
  'שיר שני': ok(1990, { pageViews: null, deezerRank: null }),
  'מחלוקת': flaggedRule(['disagree'], 1984, { wikipedia: 1984, wikidata: 1986 }),
  'ישן': flaggedRule(['pre-1970-hebrew'], 1969, { wikipedia: 1969, wikidata: 1969 }),
  'חנות': flaggedRule(['store-only'], 1991, { store: 1991 }),
  'כלום': flaggedRule(['none'], null),
  'מחוץ לטווח': flaggedRule(['chart-range'], 1975, { wikipedia: 1975, wikidata: 1975 }),
  'בלי תצוגה': ok(1988, { itunes: null }),
  'רשת נפלה': ok(1989, { itunes: null, errors: { it: 'ECONNRESET' } }),
  'זמר חדש': ok(1992),
};

function stubs({ candidates, catalog = [{ id: 669, artist: 'קיים', title: 'שיר קיים', year: 1980, language: 'he' }], lookup, select } = {}) {
  const calls = { extract: 0, lookup: [], difficulty: null, select: null };
  const cands = candidates ?? [
    cand('זמר ידוע', 'שיר טוב', 1987, 1),
    cand('זמר ידוע', 'שיר טוב', 1988, 4), // same song, second year → merged
    cand('זמר ידוע', 'שיר שני', 1990, 7),
    cand('זמר ידוע', 'מחלוקת', 1985, 2),
    cand('זמר ידוע', 'ישן', 1970, 3),
    cand('זמר ידוע', 'חנות', 1991, 5),
    cand('זמר ידוע', 'כלום', 1980, 6),
    cand('זמר ידוע', 'מחוץ לטווח', 1985, 8),
    cand('זמר ידוע', 'בלי תצוגה', 1988, 9),
    cand('זמר ידוע', 'רשת נפלה', 1989, 10),
    cand('זמר לא מוכר', 'זמר חדש', 1992, 11),
    cand('זמר מוחרג', 'שיר מוחרג', 1993, 1),
    cand('קיים', 'שיר קיים', 1980, 2),
    cand('Some Band', 'English Song', 1990, 1, { language: 'en' }), // other language: out of scope
  ];
  const deps = {
    readCatalog: async () => catalog,
    extract: async (o) => {
      calls.extract++;
      calls.extractArgs = o;
      return { candidates: cands, problems: [{ page: 'https://he.wikipedia.org/wiki/1977', reason: 'table not found' }] };
    },
    matchCatalog: (cs, cat) => {
      const groups = new Map();
      for (const c of cs) {
        const k = songKey(c);
        const g = groups.get(k);
        if (g) {
          g.bestRank = Math.min(g.bestRank, c.rank);
          g.firstChartYear = Math.min(g.firstChartYear, c.chartYear);
          g.charts.push({ source: c.source, chartYear: c.chartYear, rank: c.rank });
        } else groups.set(k, { ...c, bestRank: c.rank, firstChartYear: c.chartYear, charts: [{ source: c.source, chartYear: c.chartYear, rank: c.rank }] });
      }
      const merged = [...groups.values()];
      const existing = merged.filter((m) => cat.some((s) => s.title === m.title)).map((m) => ({ candidate: m, songId: 669 }));
      return { merged, existing, fresh: merged.filter((m) => !cat.some((s) => s.title === m.title)) };
    },
    artistGenres: { 'זמר ידוע': { genre: 'pop', exclude: false }, 'זמר מוחרג': { genre: 'pop', exclude: true } },
    assignGenre: (c, ag) => {
      const e = ag[c.artist];
      if (!e) return { genre: null, excluded: false, flag: 'unknown-performer' };
      return { genre: e.genre, excluded: e.exclude, flag: null };
    },
    select:
      select ??
      ((cs, o) => {
        calls.select = o;
        return defaultSelect(cs, o);
      }),
    lookup:
      lookup ??
      (async (song) => {
        calls.lookup.push(song);
        return structuredClone(LOOKUPS[song.title]);
      }),
    computeDifficulty: (songs) => {
      calls.difficulty = songs;
      return new Map(songs.map((s, i) => [s.id, { difficulty: (i % 3) + 1, score: 0.5, fame: 0.5, chart: 0.5 }]));
    },
    httpStats: () => ({ requests: 10, cacheHits: 2, retries: 0, errors: 0 }),
  };
  return { deps, calls };
}

test('validateRequest', () => {
  assert.deepEqual(validateRequest(REQ), []);
  assert.equal(validateRequest({ ...REQ, sources: [] }).length, 1);
  assert.equal(validateRequest({ ...REQ, fromYear: 2000 }).length, 1);
  assert.equal(validateRequest({ ...REQ, size: 0 }).length, 1);
  assert.equal(validateRequest({ ...REQ, language: 'fr' }).length, 1);
  assert.equal(validateRequest(null).length, 1);
});

test('the shipped batch-request.json is valid', () => {
  const r = JSON.parse(readFileSync(new URL('../../batch-request.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateRequest(r), []);
  assert.ok(r.name);
});

test('full batch: accepted, every flag reason, excluded, existing', async () => {
  const out = tmp();
  const { deps, calls } = stubs();
  const res = await runBatch(REQ, { out, deps });

  assert.equal(calls.extract, 1);
  assert.deepEqual(calls.extractArgs, { sources: ['reshet-gimel'], fromYear: 1969, toYear: 1999, top: 20 });
  assert.equal(calls.select.size, 300);
  // Excluded and existing songs are never looked up; the English candidate is out of scope.
  const looked = calls.lookup.map((s) => s.title);
  assert.ok(!looked.includes('שיר מוחרג') && !looked.includes('שיר קיים') && !looked.includes('English Song'));
  assert.equal(looked.length, 10);
  // chartYear = firstChartYear of the merged candidate.
  assert.equal(calls.lookup.find((s) => s.title === 'שיר טוב').chartYear, 1987);

  // Accepted: catalog shape, key order, no id, aliases, itunesTrackId.
  const batch = JSON.parse(readFileSync(path.join(out, 'batch.json'), 'utf8'));
  assert.deepEqual(batch.map((s) => s.title).sort(), ['שיר טוב', 'שיר שני'].sort());
  const good = batch.find((s) => s.title === 'שיר טוב');
  assert.deepEqual(Object.keys(good), ['artist', 'title', 'year', 'language', 'genre', 'difficulty', 'artistAliases', 'titleAliases', 'itunesTrackId']);
  assert.equal(good.year, 1987);
  assert.equal(good.genre, 'pop');
  assert.equal(good.itunesTrackId, 2987);
  assert.deepEqual(good.titleAliases, ['Shir Tov']);
  assert.ok(!('id' in good));
  assert.ok([1, 2, 3].includes(good.difficulty));

  // Difficulty inputs: temporary ids above the catalog's, best rank, fame signals.
  assert.deepEqual(
    calls.difficulty.map((d) => d.id),
    [670, 671],
  );
  const dIn = calls.difficulty.find((d) => d.bestRank === 1);
  assert.deepEqual(dIn, { id: dIn.id, language: 'he', bestRank: 1, pageViews: 5000, deezerRank: 300000 });
  assert.equal(calls.difficulty.find((d) => d.bestRank === 7).pageViews, undefined);

  // Flagged: one row per song, with the expected reasons.
  const reasons = Object.fromEntries(res.flagged.map((f) => [f.title, f.reasons]));
  assert.deepEqual(reasons, {
    'מחלוקת': ['disagree'],
    'ישן': ['pre-1970-hebrew'],
    'חנות': ['store-only'],
    'כלום': ['none'],
    'מחוץ לטווח': ['chart-range'],
    'בלי תצוגה': ['no-preview'],
    'רשת נפלה': ['no-preview', 'lookup-error'],
    'זמר חדש': ['unknown-performer'],
  });
  const csv = readFileSync(path.join(out, 'flagged.csv'), 'utf8');
  assert.ok(csv.startsWith('﻿artist,title,language,firstChartYear,bestRank,charts,genre,wikipedia,wikidata,musicbrainz,store,proposedYear,reasons'));
  assert.match(csv, /זמר ידוע,מחלוקת,he,1985,2,reshet-gimel 1985 #2,pop,1984,1986,,,1984,disagree/);
  assert.match(csv, /רשת נפלה.*no-preview;lookup-error.*it: ECONNRESET/);

  // Excluded.
  const ex = readFileSync(path.join(out, 'excluded.csv'), 'utf8');
  assert.match(ex, /זמר מוחרג,שיר מוחרג,he,1993,1,pop,excluded-performer/);
  assert.equal(res.excluded.length, 1);

  // Provenance for sources.json.
  const prov = JSON.parse(readFileSync(path.join(out, 'provenance.json'), 'utf8'));
  const p = prov.find((x) => x.title === 'שיר טוב');
  assert.deepEqual(p.charts.map((c) => c.chartYear), [1987, 1988]);
  assert.equal(p.yearSources.musicbrainz, 1987);

  // Report.
  const report = readFileSync(path.join(out, 'report.md'), 'utf8');
  assert.match(report, /# Song batch: test-batch/);
  assert.match(report, /Candidates extracted \(chart entries\) \| 14/);
  assert.match(report, /Already in the catalog \| 1/);
  assert.match(report, /Left out: excluded performers \(D5\) \| 1/);
  assert.match(report, /Selected for this batch \| 10/);
  assert.match(report, /\*\*Accepted\*\* \(batch.json\) \| \*\*2\*\*/);
  assert.match(report, /\*\*Flagged\*\* \(flagged.csv\) \| \*\*8\*\*/);
  assert.match(report, /No iTunes preview \| 2/);
  assert.match(report, /\| no-preview \| 2 \|/);
  assert.match(report, /\| 1980s \| 6 \| 1 \| 5 \|/);
  assert.match(report, /\| he \| 1 \| 1 \| 0 \| 2 \|/);
  assert.match(report, /No fame signal .*: 1/);
  assert.match(report, /\| זמר ידוע \| 9 \|/);
  assert.match(report, /1977: table not found/);
  assert.match(report, /it: ECONNRESET ×1/);
  assert.match(report, /requests 10, cache hits 2/);
});

test('selection size is respected and the injected select decides', async () => {
  const out = tmp();
  const { deps, calls } = stubs({ select: (cs) => cs.filter((c) => c.title === 'שיר טוב') });
  const res = await runBatch({ ...REQ, size: 5 }, { out, deps });
  assert.equal(calls.lookup.length, 1);
  assert.equal(res.songs.length, 1);
  assert.equal(res.counts.selected, 1);
});

test('defaultSelect: best rank first, then more charts, then earlier year', () => {
  const cs = [
    { title: 'a', bestRank: 3, firstChartYear: 1980, charts: [1] },
    { title: 'b', bestRank: 1, firstChartYear: 1990, charts: [1] },
    { title: 'c', bestRank: 1, firstChartYear: 1985, charts: [1] },
    { title: 'd', bestRank: 1, firstChartYear: 1995, charts: [1, 2] },
  ];
  assert.deepEqual(defaultSelect(cs, { size: 3 }).map((c) => c.title), ['d', 'c', 'b']);
});

test('resume: a finished run repeats no extraction and no lookup', async () => {
  const out = tmp();
  const first = stubs();
  await runBatch(REQ, { out, deps: first.deps });
  const second = stubs();
  const res = await runBatch(REQ, { out, deps: second.deps });
  assert.equal(second.calls.extract, 0);
  // Only the song whose lookup had a network error is retried.
  assert.deepEqual(second.calls.lookup.map((s) => s.title), ['רשת נפלה']);
  assert.equal(res.songs.length, 2);
  assert.match(res.report, /resumed; 9 songs from the progress log/);
});

test('resume: an interrupted run continues with the songs not yet done', async () => {
  const out = tmp();
  const crash = stubs();
  // The process is killed after 3 songs: the log throws, which aborts runBatch.
  let logged = 0;
  await assert.rejects(
    runBatch(REQ, {
      out,
      deps: crash.deps,
      concurrency: 1,
      log: (s) => {
        if (s.startsWith('[') && ++logged === 3) throw new Error('killed');
      },
    }),
    /killed/,
  );
  const hash = readdirSync(out).find((f) => f.startsWith('progress-'));
  appendFileSync(path.join(out, hash), '{"key":"he|cut'); // a line cut off by the kill
  const again = stubs();
  const res = await runBatch(REQ, { out, deps: again.deps, concurrency: 1 });
  assert.equal(again.calls.extract, 0);
  assert.equal(again.calls.lookup.length, 10 - 3);
  assert.equal(res.songs.length + res.flagged.length, 10);
});

test('a changed request starts a new selection', async () => {
  const out = tmp();
  await runBatch(REQ, { out, deps: stubs().deps });
  const next = stubs();
  await runBatch({ ...REQ, toYear: 1995 }, { out, deps: next.deps });
  assert.equal(next.calls.extract, 1);
  assert.equal(next.calls.lookup.length, 10);
});

test('a renamed request keeps the progress (same parameters)', async () => {
  const out = tmp();
  await runBatch(REQ, { out, deps: stubs().deps });
  const next = stubs();
  await runBatch({ ...REQ, name: 'renamed' }, { out, deps: next.deps });
  assert.equal(next.calls.extract, 0);
});

test('a lookup that throws is flagged, not fatal, and retried on the next run', async () => {
  const out = tmp();
  const { deps } = stubs({ candidates: [cand('זמר ידוע', 'שיר טוב', 1987, 1)], lookup: async () => { throw new Error('boom'); } });
  const res = await runBatch(REQ, { out, deps });
  assert.deepEqual(res.flagged[0].reasons, ['none', 'no-preview', 'lookup-error']);
  assert.ok(!existsSync(path.join(out, 'batch.json')) || JSON.parse(readFileSync(path.join(out, 'batch.json'), 'utf8')).length === 0);
  const again = stubs({ candidates: [cand('זמר ידוע', 'שיר טוב', 1987, 1)] });
  const res2 = await runBatch(REQ, { out, deps: again.deps });
  assert.equal(again.calls.lookup.length, 1);
  assert.equal(res2.songs.length, 1);
});

test('no accepted songs: computeDifficulty is not called, files are still written', async () => {
  const out = tmp();
  const { deps, calls } = stubs({ candidates: [cand('זמר ידוע', 'כלום', 1980, 1)] });
  const res = await runBatch(REQ, { out, deps });
  assert.equal(calls.difficulty, null);
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'batch.json'), 'utf8')), []);
  assert.match(res.report, /No accepted songs/);
});

test('flagReasons: missing genre without a flag counts as unknown performer', () => {
  assert.deepEqual(flagReasons({ genre: null, genreFlag: null }, ok(1990)), ['unknown-performer']);
  assert.deepEqual(flagReasons({ genre: 'pop' }, ok(1990)), []);
});

test('candidateInfo keeps artistKeys and aliases, and accepts unmerged candidates', () => {
  const c = candidateInfo({ ...cand('A ו B', 'T', 1990, 3), artistKeys: ['A', 'B'] });
  assert.equal(c.firstChartYear, 1990);
  assert.equal(c.bestRank, 3);
  assert.deepEqual(c.charts, [{ source: 'reshet-gimel', chartYear: 1990, rank: 3 }]);
  assert.deepEqual(c.artistKeys, ['A', 'B']);
});

test('toCsv escapes commas, quotes and newlines; lists join with ;', () => {
  const csv = toCsv(['a', 'b'], [{ a: 'x, "y"', b: ['p', 'q'] }, { a: null, b: 'l1\nl2' }]);
  assert.equal(csv, '﻿a,b\n"x, ""y""",p;q\n,"l1\nl2"\n');
});

