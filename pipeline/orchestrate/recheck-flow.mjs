// Task 3.8: the year rule and the preview check on the songs already in the catalog.
//
// Per song (decision D8):
//   - all three trusted sources (Wikipedia, Wikidata, MusicBrainz) agree on a year that is not
//     the catalog year → automatic fix (recheck-fixes.json), EXCEPT a Hebrew song before 1970
//     (old or new year) → flagged 'pre-1970-hebrew' (first-recording trap);
//   - two sources agree on another year → flagged 'two-sources-differ';
//   - sources give years but none is the catalog year → flagged 'no-source-confirms';
//   - no iTunes preview → flagged 'no-preview'.
//   At least one source confirming the catalog year (or no source with a year) is fine: the
//   catalog years were checked by hand when the songs were added.
// The catalog itself is only changed by `recheck.mjs --apply` (applyFixes + catalog-io).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { countBy, createProgress, decadeOf, mapLimit, mdTable, toCsv, writeJson } from './util.mjs';

const TRUSTED = ['wikipedia', 'wikidata', 'musicbrainz'];

export const RECHECK_REASONS = {
  'pre-1970-hebrew': 'all three sources agree on another year, but Hebrew before 1970 is never fixed automatically',
  'two-sources-differ': 'two trusted sources agree on another year',
  'no-source-confirms': 'trusted sources give years, none is the catalog year',
  'no-preview': 'no iTunes preview',
  'lookup-error': 'a source failed (network); a re-run may resolve it',
};

/** → { action: 'ok' | 'fix' | 'flag', newYear?, reasons: [] , sources } */
export function classifyRecheck(song, res) {
  const years = res.years ?? {};
  const sources = Object.fromEntries(TRUSTED.map((k) => [k, years[k] ?? null]));
  const found = TRUSTED.filter((k) => Number.isInteger(sources[k]));
  const reasons = [];
  let fix = null;
  const unanimous = found.length === 3 && found.every((k) => sources[k] === sources[found[0]]);
  if (unanimous && sources.wikipedia !== song.year) {
    const y = sources.wikipedia;
    if (song.language === 'he' && (y < 1970 || song.year < 1970)) reasons.push('pre-1970-hebrew');
    else fix = y;
  } else if (!unanimous) {
    const ruleYear = res.rule?.year;
    const twoAgree = (res.rule?.agreeing?.length ?? 0) >= 2;
    if (twoAgree && ruleYear !== song.year) reasons.push('two-sources-differ');
    else if (found.length && !found.some((k) => sources[k] === song.year)) reasons.push('no-source-confirms');
  }
  if (!res.itunes?.preview) reasons.push('no-preview');
  if (reasons.length && Object.keys(res.errors ?? {}).length) reasons.push('lookup-error');
  return { action: reasons.length ? 'flag' : fix !== null ? 'fix' : 'ok', fix, reasons, sources: { ...sources, store: years.store ?? null } };
}

/**
 * @param {{ out: string, deps: { readCatalog, lookup, httpStats? }, concurrency?: number, limit?: number, ids?: number[], log?, now? }} o
 */
export async function runRecheck({ out, deps, concurrency = 3, limit, ids, log = () => {}, now = Date.now }) {
  const t0 = now();
  let songs = await deps.readCatalog();
  if (ids?.length) songs = songs.filter((s) => ids.includes(s.id));
  if (limit) songs = songs.slice(0, limit);
  const progress = createProgress(out, 'recheck-progress.jsonl');
  const fromLog = songs.filter((s) => progress.done.has(progressKey(s))).length;
  let n = 0;
  const rows = await mapLimit(songs, concurrency, async (song) => {
    const key = progressKey(song);
    let res = progress.done.get(key);
    if (!res) {
      try {
        res = await deps.lookup({ id: song.id, artist: song.artist, title: song.title, language: song.language, artistAliases: song.artistAliases, titleAliases: song.titleAliases });
      } catch (e) {
        res = { years: {}, rule: { year: null, accepted: false, flags: ['none'] }, itunes: null, errors: { lookup: String(e?.message ?? e) } };
      }
      if (!Object.keys(res.errors ?? {}).length) progress.record(key, res);
    }
    const c = classifyRecheck(song, res);
    n++;
    log(`[${n}/${songs.length}] ${song.id} ${song.artist} – ${song.title} (${song.year}): ${c.action}${c.fix ? ' → ' + c.fix : ''}${c.reasons.length ? ' ' + c.reasons.join(',') : ''}`);
    return { song, res, ...c };
  });

  const fixes = rows.filter((r) => r.action === 'fix').map((r) => ({ id: r.song.id, artist: r.song.artist, title: r.song.title, language: r.song.language, old: r.song.year, new: r.fix, sources: r.sources }));
  const flagged = rows
    .filter((r) => r.action === 'flag')
    .map((r) => ({
      id: r.song.id,
      artist: r.song.artist,
      title: r.song.title,
      language: r.song.language,
      year: r.song.year,
      wikipedia: r.sources.wikipedia,
      wikidata: r.sources.wikidata,
      musicbrainz: r.sources.musicbrainz,
      store: r.sources.store,
      proposedYear: r.res.rule?.year,
      reasons: r.reasons,
      itunesTrackId: r.res.itunes?.trackId ?? '',
      wikipediaPage: r.res.wikipedia?.page ?? '',
      errors: Object.entries(r.res.errors ?? {}).map(([k, v]) => `${k}: ${v}`),
    }));
  writeJson(path.join(out, 'recheck-fixes.json'), fixes);
  writeFileSync(path.join(out, 'recheck-flagged.csv'), toCsv(['id', 'artist', 'title', 'language', 'year', 'wikipedia', 'wikidata', 'musicbrainz', 'store', 'proposedYear', 'reasons', 'itunesTrackId', 'wikipediaPage', 'errors'], flagged));
  // Preview track ids found for songs that have none yet (input for a later itunesTrackId pass).
  writeJson(
    path.join(out, 'recheck-trackids.json'),
    rows.filter((r) => r.res.itunes?.preview && r.res.itunes.trackId && !r.song.itunesTrackId).map((r) => ({ id: r.song.id, itunesTrackId: r.res.itunes.trackId, artistMatch: r.res.itunes.artistMatch, trackName: r.res.itunes.trackName, artistName: r.res.itunes.artistName })),
  );
  const report = recheckReport({ rows, fixes, flagged, fromLog, seconds: Math.round((now() - t0) / 1000), http: deps.httpStats?.() });
  writeFileSync(path.join(out, 'recheck-report.md'), report);
  return { fixes, flagged, rows, report };
}

const progressKey = (s) => `${s.id}|${s.artist}|${s.title}`;

export function recheckReport({ rows, fixes, flagged, fromLog, seconds, http }) {
  const L = [];
  L.push('# Catalog re-check (task 3.8)', '');
  L.push(`${rows.length} songs, ${seconds} s${fromLog ? ` (${fromLog} from the progress log)` : ''}${http ? `; requests ${http.requests}, cache hits ${http.cacheHits}, retries ${http.retries}, failed ${http.errors}` : ''}.`, '');
  const langs = [...new Set(rows.map((r) => r.song.language))].sort();
  L.push('## Counts', '');
  const cell = (pred) => langs.map((l) => rows.filter((r) => r.song.language === l && pred(r)).length);
  L.push(
    mdTable(['', ...langs, 'Total'], [
      ['Songs', ...cell(() => true), rows.length],
      ['Year confirmed (or no source data)', ...cell((r) => r.action === 'ok'), rows.filter((r) => r.action === 'ok').length],
      ['All three sources agree with the catalog', ...cell((r) => TRUSTED.every((k) => r.sources[k] === r.song.year)), rows.filter((r) => TRUSTED.every((k) => r.sources[k] === r.song.year)).length],
      ['No trusted year at all', ...cell((r) => TRUSTED.every((k) => r.sources[k] == null)), rows.filter((r) => TRUSTED.every((k) => r.sources[k] == null)).length],
      ['**Automatic fixes** (D8)', ...cell((r) => r.action === 'fix'), fixes.length],
      ['**Flagged**', ...cell((r) => r.action === 'flag'), flagged.length],
      ['No iTunes preview', ...cell((r) => r.reasons.includes('no-preview')), rows.filter((r) => r.reasons.includes('no-preview')).length],
    ]),
  );
  L.push('', '### Flagged, by reason', '');
  const rc = countBy(flagged, (f) => f.reasons);
  L.push(rc.length ? mdTable(['Reason', 'Songs', 'Meaning'], rc.map(([r, n]) => [r, n, RECHECK_REASONS[r] ?? ''])) : 'None.');

  L.push('', '## Automatic year fixes (all three trusted sources agree)', '');
  L.push(fixes.length ? mdTable(['Id', 'Performer', 'Title', 'Old', 'New'], fixes.map((f) => [f.id, f.artist, f.title, f.old, f.new])) : 'None.');

  L.push('', '## Flagged per decade (catalog year)', '');
  L.push(mdTable(['Decade', 'Flagged'], countBy(flagged, (f) => decadeOf(f.year)).sort((a, b) => a[0].localeCompare(b[0]))));

  const errs = countBy(rows.flatMap((r) => Object.entries(r.res.errors ?? {}).map(([k, v]) => `${k}: ${v}`)), (x) => x);
  if (errs.length) L.push('', '## Source errors', '', ...errs.map(([e, n]) => `- ${e} ×${n}`));

  if (flagged.length) {
    L.push('', `<details><summary>Flagged songs (${flagged.length})</summary>`, '');
    L.push(mdTable(['Id', 'Performer', 'Title', 'Year', 'WP', 'WD', 'MB', 'Store', 'Reasons'], flagged.map((f) => [f.id, f.artist, f.title, f.year, f.wikipedia, f.wikidata, f.musicbrainz, f.store, f.reasons.join(', ')])));
    L.push('', '</details>');
  }
  return L.join('\n') + '\n';
}

/**
 * Apply recheck-fixes.json to the catalog. A fix is applied only when the song still has the
 * old year (a song changed by hand since the recheck is left alone and reported).
 * → { songs, applied: [fix], skipped: [{ fix, why }] }
 */
export function applyFixes(catalog, fixes) {
  const byId = new Map(fixes.map((f) => [f.id, f]));
  const applied = [];
  const skipped = [];
  const seen = new Set();
  const songs = catalog.map((s) => {
    const f = byId.get(s.id);
    if (!f) return s;
    seen.add(s.id);
    if (s.year !== f.old) {
      skipped.push({ fix: f, why: `catalog year is ${s.year}, expected ${f.old}` });
      return s;
    }
    if (!Number.isInteger(f.new)) {
      skipped.push({ fix: f, why: 'new year is not a year' });
      return s;
    }
    applied.push(f);
    return { ...s, year: f.new }; // spread keeps the key order
  });
  for (const f of fixes) if (!seen.has(f.id)) skipped.push({ fix: f, why: 'no song with this id' });
  return { songs, applied, skipped };
}
