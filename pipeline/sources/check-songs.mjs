#!/usr/bin/env node
// Run every source adapter on a list of songs whose years are known, and write a summary
// like the source test (poc/source-test.mjs): found / exact / ±1 per source and language,
// the year rule (accepted / correct / flagged), page views and Deezer.
//
//   node pipeline/sources/check-songs.mjs [--songs list.json] [--out dir] [--lang he|en] [--limit N] [--concurrency N]
//
// --songs: JSON array of { artist, title, year, language, artistAliases?, titleAliases?, chartYear? }.
//          Default: the 60-song spread sample of the source test, from server/data/songs.json.
// Writes <out>/sources-results.json and <out>/sources-summary.md (default out: .pipeline-out).
// Network: run it on GitHub Actions (the dev sandbox cannot reach these hosts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deezerTrack } from './deezer.mjs';
import { defaultHttp } from './http.mjs';
import { itunesTrack } from './itunes.mjs';
import { musicbrainzYear } from './musicbrainz.mjs';
import { pageviews12m } from './pageviews.mjs';
import { sitelinks, wikidataYear } from './wikidata.mjs';
import { lookupWikipedia, readSongPage } from './wikipedia.mjs';
import { applyYearRule } from './year-rule.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');

// The source test sampled the original catalog (ids up to 669); keep that sample as the catalog grows.
const ORIGINAL_MAX_ID = 669;

/** The source test's sample: n songs per language spread evenly over the years. */
export function spreadSample(songs, n = 30) {
  const spread = (list) => {
    const sorted = [...list].sort((a, b) => a.year - b.year || a.id - b.id);
    return Array.from({ length: Math.min(n, sorted.length) }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
  };
  return [...spread(songs.filter((s) => s.language === 'he')), ...spread(songs.filter((s) => s.language === 'en'))];
}

/** All sources for one song. */
export async function checkSong(song, opts = {}) {
  const lang = song.language === 'he' ? 'he' : 'en';
  const [wp, mb, it, dz] = await Promise.all([
    wikipediaWithFallback(song, lang, opts),
    musicbrainzYear(song, opts),
    itunesTrack(song, opts),
    deezerTrack(song, opts),
  ]);
  const [wd, pv] = await Promise.all([
    wikidataYear(wp.qid, opts),
    wp.found && wp.lang === lang ? pageviews12m(lang, wp.page, opts) : Promise.resolve({ found: false }),
  ]);
  const rule = applyYearRule(
    { wikipedia: wp.year ?? null, wikidata: wd.year ?? null, musicbrainz: mb.year ?? null, store: it.year ?? null },
    { language: lang, chartYear: song.chartYear ?? null, wikipediaPage: wp.found ? wp.page : null, artist: song.artist },
  );
  return { id: song.id, lang, year: song.year, artist: song.artist, title: song.title, wp, wd, mb, it, dz, pv, rule };
}

/**
 * Wikipedia in the song's language. For a Hebrew song without a he page, try the English
 * page found by the aliases, then follow its Wikidata sitelink back to hewiki.
 */
async function wikipediaWithFallback(song, lang, opts) {
  const wp = await lookupWikipedia(lang, song, opts);
  if (wp.found || lang !== 'he' || !song.titleAliases?.length) return { ...wp, lang };
  const enSong = { ...song, title: song.titleAliases[0], titleAliases: song.titleAliases.slice(1), artist: song.artistAliases?.[0] ?? song.artist, artistAliases: song.artistAliases?.slice(1) ?? [] };
  const en = await lookupWikipedia('en', enSong, opts);
  if (!en.found) return { ...wp, lang };
  const he = en.qid ? (await sitelinks(en.qid, opts)).hewiki : null;
  if (he) {
    const hp = await readSongPage('he', he, opts);
    if (hp.found) return { ...hp, lang: 'he', via: 'en-sitelink', qid: hp.qid ?? en.qid };
  }
  return { ...en, lang: 'en', via: 'en-alias' };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, limit) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// Source-test baseline (SONG_PIPELINE.md section 2), for comparison in the summary.
const BASELINE = {
  'Wikipedia infobox': { he: '19/30, 100%', en: '30/30, 93%' },
  'Wikidata P577': { he: '26/30, 96%', en: '28/30, 86%' },
  MusicBrainz: { he: '28/30, 79%', en: '29/30, 69%' },
  'iTunes store date': { he: '27/30, 78%', en: '30/30, 83%' },
};

export function summarize(rows) {
  const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');
  const langs = ['he', 'en'].filter((l) => rows.some((r) => r.lang === l));
  const L = [];
  L.push('## Sources (years compared with the verified catalog year)', '');
  L.push('| Source | Lang | Found | Year exact | Year ±1 | Wrong (>1) | Source test (found, exact) |', '|---|---|---|---|---|---|---|');
  const sources = {
    'Wikipedia infobox': (r) => r.wp.year,
    'Wikidata P577': (r) => r.wd.year,
    MusicBrainz: (r) => r.mb.year,
    'iTunes store date': (r) => (r.it.found ? r.it.year : null),
  };
  for (const [name, get] of Object.entries(sources)) {
    for (const lang of langs) {
      const rs = rows.filter((r) => r.lang === lang);
      const ys = rs.map((r) => [get(r), r.year]).filter(([y]) => y);
      const exact = ys.filter(([y, t]) => y === t).length;
      const near = ys.filter(([y, t]) => Math.abs(y - t) <= 1).length;
      L.push(`| ${name} | ${lang} | ${ys.length}/${rs.length} | ${pct(exact, ys.length)} | ${pct(near, ys.length)} | ${ys.length - near} | ${BASELINE[name][lang]} |`);
    }
  }
  for (const lang of langs) {
    const rs = rows.filter((r) => r.lang === lang);
    L.push(`| Wikipedia page found | ${lang} | ${rs.filter((r) => r.wp.found).length}/${rs.length} | | | | |`);
    L.push(`| iTunes preview | ${lang} | ${rs.filter((r) => r.it.preview).length}/${rs.length} | | | | ${lang === 'he' ? '27/30' : '30/30'} |`);
  }

  L.push('', '## Year rule (2 of Wikipedia / Wikidata / MusicBrainz agree exactly)', '');
  L.push('| Lang | Accepted | Correct among accepted | Flagged | Flags | Unanimous (3/3) | Source test |', '|---|---|---|---|---|---|---|');
  for (const lang of langs) {
    const rs = rows.filter((r) => r.lang === lang);
    const acc = rs.filter((r) => r.rule.accepted);
    const ok = acc.filter((r) => r.rule.year === r.year);
    const flagCounts = {};
    for (const r of rs) for (const f of r.rule.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    const flags = Object.entries(flagCounts).map(([f, n]) => `${f} ${n}`).join(', ') || '-';
    const base = lang === 'he' ? '27/30 accepted, 26 correct, 3 flagged' : '28/30 accepted, 26 correct, 2 flagged';
    L.push(`| ${lang} | ${acc.length}/${rs.length} | ${ok.length}/${acc.length} | ${rs.length - acc.length} | ${flags} | ${rs.filter((r) => r.rule.notes.includes('unanimous')).length} | ${base} |`);
  }
  const wrong = rows.filter((r) => r.rule.accepted && r.rule.year !== r.year);
  if (wrong.length) {
    L.push('', '**Accepted but different from the catalog** (catalog may be wrong, or the rule):', '');
    for (const r of wrong) L.push(`- ${r.lang} ${r.artist} – ${r.title}: catalog ${r.year}, rule ${r.rule.year} (${r.rule.agreeing.join(', ')})`);
  }

  L.push('', '## Fame signals (task 3.9)', '');
  L.push('| Lang | Page views found | Median views (12 months) | Deezer found | Deezer preview | Deezer query that hit |', '|---|---|---|---|---|---|');
  for (const lang of langs) {
    const rs = rows.filter((r) => r.lang === lang);
    const views = rs.filter((r) => r.pv.found).map((r) => r.pv.views).sort((a, b) => a - b);
    const median = views.length ? views[Math.floor(views.length / 2)] : '-';
    const via = {};
    for (const r of rs) if (r.dz.found) via[r.dz.via] = (via[r.dz.via] ?? 0) + 1;
    L.push(`| ${lang} | ${views.length}/${rs.length} | ${median} | ${rs.filter((r) => r.dz.found).length}/${rs.length} | ${rs.filter((r) => r.dz.preview).length} | ${Object.entries(via).map(([k, n]) => `${k} ${n}`).join(', ') || '-'} |`);
  }

  const noYear = rows.filter((r) => r.wp.found && !r.wp.year);
  if (noYear.length) {
    L.push('', '## Wikipedia pages without a year (infobox keys, to extend RELEASE_FIELDS)', '');
    for (const r of noYear) L.push(`- ${r.lang} ${r.title} → [${r.wp.page}]: ${(r.wp.infoboxKeys ?? []).join(', ') || 'no infobox'}`);
  }
  const fields = {};
  for (const r of rows) if (r.wp.field) fields[`${r.lang}:${r.wp.field.startsWith('category:') ? 'category' : r.wp.field}`] = (fields[`${r.lang}:${r.wp.field.startsWith('category:') ? 'category' : r.wp.field}`] ?? 0) + 1;
  L.push('', `Wikipedia year fields used: ${Object.entries(fields).map(([k, n]) => `${k} ${n}`).join(', ') || '-'}`);
  const errors = rows.flatMap((r) => ['wp', 'wd', 'mb', 'it', 'dz', 'pv'].filter((k) => r[k]?.error).map((k) => `${k}: ${r[k].error}`));
  if (errors.length) {
    const byErr = {};
    for (const e of errors) byErr[e] = (byErr[e] ?? 0) + 1;
    L.push('', `Errors: ${Object.entries(byErr).map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  }
  return L.join('\n') + '\n';
}

function rowLine(r) {
  const s = r.rule.sources;
  return `${r.lang} ${r.year} ${r.artist} – ${r.title} | WP ${s.wikipedia ?? (r.wp.found ? 'no year' : r.wp.error ?? '-')} WD ${s.wikidata ?? '-'} MB ${s.musicbrainz ?? r.mb.note ?? r.mb.error ?? '-'} iT ${r.it.found ? `${r.it.year}${r.it.preview ? ' ▶' : ''}` : r.it.error ?? '-'} | DZ ${r.dz.found ? `rank ${r.dz.rank} (${r.dz.via})` : r.dz.error ?? '-'} PV ${r.pv.found ? r.pv.views : '-'} | rule ${r.rule.year ?? '-'} ${r.rule.accepted ? 'OK' : r.rule.flags.join(',')}`;
}

function parseArgs(argv) {
  const a = { out: '.pipeline-out', concurrency: 3 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--songs') { a.songs = v; i++; }
    else if (k === '--out') { a.out = v; i++; }
    else if (k === '--lang') { a.lang = v; i++; }
    else if (k === '--limit') { a.limit = Number(v); i++; }
    else if (k === '--concurrency') { a.concurrency = Number(v); i++; }
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let songs = args.songs
    ? JSON.parse(readFileSync(args.songs, 'utf8'))
    : spreadSample(JSON.parse(readFileSync(path.join(REPO, 'server/data/songs.json'), 'utf8')).filter((s) => s.id <= ORIGINAL_MAX_ID));
  if (args.lang) songs = songs.filter((s) => s.language === args.lang);
  if (args.limit) songs = songs.slice(0, args.limit);
  console.log(`Checking ${songs.length} songs…`);
  const t0 = Date.now();
  const rows = await mapLimit(songs, args.concurrency, async (s) => {
    const r = await checkSong(s);
    console.log(rowLine(r));
    return r;
  });
  const http = defaultHttp().stats;
  const summary = `# Source adapters check\n\n${rows.length} songs, ${Math.round((Date.now() - t0) / 1000)} s; requests ${http.requests}, cache hits ${http.cacheHits}, retries ${http.retries}, failed ${http.errors}.\n\n${summarize(rows)}`;
  mkdirSync(args.out, { recursive: true });
  writeFileSync(path.join(args.out, 'sources-results.json'), JSON.stringify(rows, null, 1));
  writeFileSync(path.join(args.out, 'sources-summary.md'), summary);
  console.log('\n' + summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
