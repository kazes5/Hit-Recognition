// Task 3.7: one batch, from hit lists to songs ready to merge.
//
//   extract candidates → matchCatalog (drop songs already in the catalog) → assignGenre
//   (excluded performers → excluded.csv; unknown performer → flagged) → select N → per song:
//   year (Wikipedia, Wikidata, MusicBrainz, year rule with chartYear = firstChartYear),
//   iTunes preview (required), page views + Deezer rank → computeDifficulty over the
//   accepted songs → batch.json, flagged.csv, excluded.csv, provenance.json, report.md.
//
// Every dependency is injected (`deps`), see deps.mjs for the real ones.
// Resume: the selection is saved once (selection.json, tied to a hash of the request) and
// each looked-up song is appended to progress-<hash>.jsonl; a restarted run skips both.
// A lookup with a network error is not saved, so a restart retries it (the HTTP cache
// keeps the answers that did arrive).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { countBy, createProgress, decadeOf, mapLimit, mdTable, readJsonIf, sha, songKey, toCsv, writeJson } from './util.mjs';
import { norm, normArtist } from '../sources/normalize.mjs';

export const FLAG_REASONS = {
  'unknown-performer': 'performer not in artist-genres.json (label the genre; check it is not Mizrahi or Jewish/Hasidic, D5)',
  disagree: 'trusted sources give different years',
  'pre-1970-hebrew': 'Hebrew song before 1970 (first-recording trap)',
  'store-only': 'only the store (iTunes) year',
  none: 'no year from any source',
  'chart-range': 'year not within 2 years before the chart year',
  'no-preview': 'no iTunes preview',
  'lookup-error': 'a source failed (network); a re-run may resolve it',
};

export const FLAGGED_COLUMNS = ['artist', 'title', 'language', 'firstChartYear', 'bestRank', 'charts', 'genre', 'wikipedia', 'wikidata', 'musicbrainz', 'store', 'proposedYear', 'reasons', 'itunesTrackId', 'wikipediaPage', 'errors'];

export function validateRequest(r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['request must be a JSON object'];
  if (!Array.isArray(r.sources) || !r.sources.length) errs.push('"sources" must be a non-empty list');
  if (!Number.isInteger(r.fromYear) || !Number.isInteger(r.toYear) || r.fromYear > r.toYear) errs.push('"fromYear" and "toYear" must be years, fromYear ≤ toYear');
  if (r.size !== undefined && !(Number.isInteger(r.size) && r.size > 0)) errs.push('"size" must be a positive integer');
  if (r.language !== undefined && !['he', 'en'].includes(r.language)) errs.push('"language" must be "he" or "en"');
  return errs;
}

/** The fields of a (merged) candidate that the batch keeps. */
export function candidateInfo(c) {
  return {
    artist: c.artist,
    title: c.title,
    language: c.language,
    firstChartYear: c.firstChartYear ?? c.chartYear ?? null,
    bestRank: c.bestRank ?? c.rank ?? null,
    charts: c.charts ?? (c.source ? [{ source: c.source, chartYear: c.chartYear, rank: c.rank }] : []),
    ...(c.artistKeys ? { artistKeys: c.artistKeys } : {}),
    ...(c.artistAliases?.length ? { artistAliases: c.artistAliases } : {}),
    ...(c.titleAliases?.length ? { titleAliases: c.titleAliases } : {}),
  };
}

/** Owner decisions on single songs (pipeline/song-decisions.json) → Map key → reason. */
export function decisionIndex(decisions = {}) {
  const m = new Map();
  for (const d of decisions.exclude ?? []) m.set(`${normArtist(d.artist)}|${norm(d.title)}`, 'owner-excluded');
  for (const d of decisions.duplicate ?? []) m.set(`${normArtist(d.artist)}|${norm(d.title)}`, `duplicate-of-song-${d.songId}`);
  return m;
}

/** Stage 1: candidates → selection (saved to selection.json). */
export async function prepareSelection(request, deps) {
  const catalog = await deps.readCatalog();
  const top = request.top ?? 20;
  const { candidates = [], problems = [] } = await deps.extract({ sources: request.sources, fromYear: request.fromYear, toYear: request.toYear, top });
  const inScope = candidates.filter((c) => (!request.language || c.language === request.language) && (!c.rank || c.rank <= top));
  const { fresh = [], existing = [], merged = [], possibleDuplicates = [] } = await deps.matchCatalog(inScope, catalog);
  // A near-identical title by the same performer ("שיר הפריחה" / catalog "שיר הפרחה") is not looked
  // up: it is listed in excluded.csv for a person to confirm (batch 1 review).
  const likelyDuplicate = new Map(possibleDuplicates.filter((p) => p.reason === 'similar-title-same-performer').map((p) => [p.candidate, p.songId]));

  const excluded = [];
  const pool = [];
  const genreOf = new Map();
  const decided = decisionIndex(deps.songDecisions);
  for (const c of fresh) {
    const d = decided.get(`${normArtist(c.artist)}|${norm(c.title)}`);
    if (d) {
      excluded.push({ ...candidateInfo(c), genre: '', reason: d });
      continue;
    }
    if (likelyDuplicate.has(c)) {
      excluded.push({ ...candidateInfo(c), genre: '', reason: `possible-duplicate-of-song-${likelyDuplicate.get(c)}` });
      continue;
    }
    const g = deps.assignGenre(c, deps.artistGenres) ?? {};
    if (g.excluded) excluded.push({ ...candidateInfo(c), genre: g.genre ?? '', reason: 'excluded-performer' });
    else {
      pool.push(c);
      genreOf.set(c, g);
    }
  }
  const size = request.size ?? 300;
  const chosen = await deps.select(pool, { size, language: request.language, fromYear: request.fromYear, toYear: request.toYear });
  const byKey = new Map(pool.map((c) => [songKey(c), c]));
  const selected = chosen.slice(0, size).map((c) => {
    const g = genreOf.get(c) ?? genreOf.get(byKey.get(songKey(c))) ?? {};
    return { key: songKey(c), candidate: candidateInfo(c), genre: g.genre ?? null, genreFlag: g.flag ?? null };
  });
  const maxCatalogId = catalog.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
  return {
    counts: {
      candidates: candidates.length,
      inScope: inScope.length,
      merged: merged.length || fresh.length + existing.length,
      existing: existing.length,
      fresh: fresh.length,
      excluded: excluded.length,
      eligible: pool.length,
      unknownPerformers: [...genreOf.values()].filter((g) => g.flag === 'unknown-performer').length,
      selected: selected.length,
    },
    problems,
    excluded,
    selected,
    maxCatalogId,
    catalogSize: catalog.length,
  };
}

/** Why a looked-up song needs a person ([] = accepted). */
export function flagReasons(item, res) {
  const reasons = [];
  if (item.genreFlag) reasons.push(item.genreFlag);
  if (!item.genre && !item.genreFlag) reasons.push('unknown-performer');
  if (!res.rule?.accepted) reasons.push(...(res.rule?.flags?.length ? res.rule.flags : ['none']));
  if (!res.itunes?.preview) reasons.push('no-preview');
  if (reasons.length && Object.keys(res.errors ?? {}).length) reasons.push('lookup-error');
  return [...new Set(reasons)];
}

/** The accepted song in catalog key order (no id: merge.mjs assigns it). */
export function catalogSong(item, res, difficulty) {
  const c = item.candidate;
  const artistAliases = [...new Set([...(c.artistAliases ?? []), ...(res.aliases?.artistAliases ?? [])])];
  const titleAliases = [...new Set([...(c.titleAliases ?? []), ...(res.aliases?.titleAliases ?? [])])];
  return {
    artist: c.artist,
    title: c.title,
    year: res.rule.year,
    language: c.language,
    genre: item.genre,
    difficulty,
    ...(c.artistKeys ? { artistKeys: c.artistKeys } : {}),
    ...(artistAliases.length ? { artistAliases } : {}),
    ...(titleAliases.length ? { titleAliases } : {}),
    itunesTrackId: res.itunes.trackId,
  };
}

/**
 * @param {object} request  batch-request.json
 * @param {{ out: string, deps: object, concurrency?: number, log?: (s:string)=>void, now?: ()=>number }} o
 */
export async function runBatch(request, { out, deps, concurrency = 3, log = () => {}, now = Date.now }) {
  const errs = validateRequest(request);
  if (errs.length) throw new Error(`bad batch request: ${errs.join('; ')}`);
  const t0 = now();
  const hash = sha({ ...request, name: undefined });
  const selFile = path.join(out, 'selection.json');
  let sel = readJsonIf(selFile);
  const resumed = sel?.requestHash === hash;
  if (!resumed) {
    log('Extracting candidates…');
    sel = { requestHash: hash, request, createdAt: new Date(now()).toISOString(), ...(await prepareSelection(request, deps)) };
    writeJson(selFile, sel);
  }
  log(`${resumed ? 'Resuming' : 'Selected'}: ${sel.selected.length} songs (${sel.counts.candidates} candidates, ${sel.counts.existing} already in the catalog, ${sel.counts.excluded} excluded).`);

  const progress = createProgress(out, `progress-${hash}.jsonl`);
  const fromLog = sel.selected.filter((it) => progress.done.has(it.key)).length;
  let n = 0;
  const results = await mapLimit(sel.selected, concurrency, async (item) => {
    let res = progress.done.get(item.key);
    if (!res) {
      const c = item.candidate;
      try {
        res = await deps.lookup({ artist: c.artist, title: c.title, language: c.language, chartYear: c.firstChartYear, artistAliases: c.artistAliases, titleAliases: c.titleAliases });
      } catch (e) {
        res = { years: {}, rule: { year: null, accepted: false, flags: ['none'] }, itunes: null, errors: { lookup: String(e?.message ?? e) } };
      }
      if (!Object.keys(res.errors ?? {}).length) progress.record(item.key, res);
    }
    n++;
    const reasons = flagReasons(item, res);
    log(`[${n}/${sel.selected.length}] ${item.candidate.artist} – ${item.candidate.title}: ${reasons.length ? 'flagged ' + reasons.join(',') : `ok ${res.rule.year}`}`);
    return { item, res, reasons };
  });

  // A song held back only because its performer has no genre label yet keeps its settled year:
  // it goes to pending-genre.json, and merge-batch.mjs adds it once the performer is labelled.
  const onlyGenre = (r) => r.reasons.length === 1 && r.reasons[0] === 'unknown-performer';
  const acceptedRows = results.filter((r) => !r.reasons.length || onlyGenre(r));
  const flaggedRows = results.filter((r) => r.reasons.length && !onlyGenre(r));

  // Difficulty over the accepted new songs. Temporary ids above the catalog's, in batch order
  // (the ids merge.mjs will give them), so computeDifficulty treats them as new songs.
  const inputs = acceptedRows.map((r, i) => ({ id: sel.maxCatalogId + 1 + i, language: r.item.candidate.language, bestRank: r.item.candidate.bestRank ?? undefined, pageViews: r.res.pageViews ?? undefined, deezerRank: r.res.deezerRank ?? undefined }));
  const diff = acceptedRows.length ? await deps.computeDifficulty(inputs) : new Map();
  const accepted = acceptedRows.map((r, i) => {
    const d = diff.get(inputs[i].id);
    return { song: catalogSong(r.item, r.res, d?.difficulty ?? 2), row: r, diff: d ?? null, input: inputs[i] };
  });

  const songs = accepted.filter((a) => a.song.genre).map((a) => a.song);
  const pending = accepted.filter((a) => !a.song.genre).map((a) => ({ ...a.song, genre: null }));
  writeJson(path.join(out, 'batch.json'), songs);
  writeJson(path.join(out, 'pending-genre.json'), pending);
  writeJson(
    path.join(out, 'provenance.json'),
    accepted.map((a) => ({
      artist: a.song.artist,
      title: a.song.title,
      year: a.song.year,
      yearSources: a.row.res.years,
      agreeing: a.row.res.rule.agreeing ?? [],
      notes: a.row.res.rule.notes ?? [],
      decision: 'year-rule',
      charts: a.row.item.candidate.charts,
      bestRank: a.row.item.candidate.bestRank,
      wikipedia: a.row.res.wikipedia?.page ?? null,
      pageViews: a.row.res.pageViews,
      deezerRank: a.row.res.deezerRank,
      difficulty: a.diff ? { difficulty: a.diff.difficulty, score: a.diff.score, fame: a.diff.fame, chart: a.diff.chart } : null,
    })),
  );

  const flagged = flaggedRows.map(({ item, res, reasons }) => ({
    artist: item.candidate.artist,
    title: item.candidate.title,
    language: item.candidate.language,
    firstChartYear: item.candidate.firstChartYear,
    bestRank: item.candidate.bestRank,
    charts: (item.candidate.charts ?? []).map((c) => `${c.source} ${c.chartYear} #${c.rank}`),
    genre: item.genre ?? '',
    wikipedia: res.years?.wikipedia,
    wikidata: res.years?.wikidata,
    musicbrainz: res.years?.musicbrainz,
    store: res.years?.store,
    proposedYear: res.rule?.year,
    reasons,
    itunesTrackId: res.itunes?.trackId ?? '',
    wikipediaPage: res.wikipedia?.page ?? '',
    errors: Object.entries(res.errors ?? {}).map(([k, v]) => `${k}: ${v}`),
  }));
  writeFileSync(path.join(out, 'flagged.csv'), toCsv(FLAGGED_COLUMNS, flagged));
  writeFileSync(path.join(out, 'excluded.csv'), toCsv(['artist', 'title', 'language', 'firstChartYear', 'bestRank', 'genre', 'reason'], sel.excluded));

  const report = batchReport({ request, sel, accepted: accepted.filter((a) => a.song.genre), pending, flagged, results, resumed, fromLog, seconds: Math.round((now() - t0) / 1000), http: deps.httpStats?.() });
  writeFileSync(path.join(out, 'report.md'), report);
  return { songs, pending, flagged, excluded: sel.excluded, counts: sel.counts, report, results };
}

export function batchReport({ request, sel, accepted, pending = [], flagged, results, resumed, fromLog, seconds, http }) {
  const c = sel.counts;
  const L = [];
  L.push(`# Song batch: ${request.name ?? 'unnamed'}`, '');
  L.push(`Sources: ${request.sources.join(', ')} · years ${request.fromYear}–${request.toYear} · language ${request.language ?? 'all'} · size ${request.size ?? 300}.`);
  L.push(`Run: ${seconds} s${resumed ? ` (resumed; ${fromLog} songs from the progress log)` : ''}${http ? `; requests ${http.requests}, cache hits ${http.cacheHits}, retries ${http.retries}, failed ${http.errors}` : ''}.`, '');

  L.push('## Counts', '');
  const reasonCounts = countBy(flagged, (f) => f.reasons);
  const noPreview = flagged.filter((f) => f.reasons.includes('no-preview')).length;
  L.push(
    mdTable(['Step', 'Songs'], [
      ['Candidates extracted (chart entries)', c.candidates],
      ['Unique songs after matching', c.merged],
      ['Already in the catalog', c.existing],
      ['New songs', c.fresh],
      ['Left out: excluded performers (D5)', c.excluded],
      ['Eligible', c.eligible],
      ['Selected for this batch', c.selected],
      ['**Accepted** (batch.json)', `**${accepted.length}**`],
      ['**Year settled, performer needs a genre label** (pending-genre.json)', `**${pending.length}**`],
      ['**Flagged** (flagged.csv)', `**${flagged.length}**`],
      ['No iTunes preview', noPreview],
    ]),
  );
  L.push('', '### Flagged, by reason (a song can have several)', '');
  L.push(reasonCounts.length ? mdTable(['Reason', 'Songs', 'Meaning'], reasonCounts.map(([r, n]) => [r, n, FLAG_REASONS[r] ?? ''])) : 'None.');

  L.push('', '## Per decade (by first chart year)', '');
  const decades = [...new Set(results.map((r) => decadeOf(r.item.candidate.firstChartYear)))].sort();
  const accByDec = new Map(countBy(accepted, (a) => decadeOf(a.row.item.candidate.firstChartYear)));
  const flagByDec = new Map(countBy(flagged, (f) => decadeOf(f.firstChartYear)));
  const langs = [...new Set(results.map((r) => r.item.candidate.language))].sort();
  const accByDecLang = new Map(countBy(accepted, (a) => `${decadeOf(a.row.item.candidate.firstChartYear)}|${a.song.language}`));
  L.push(
    mdTable(
      ['Decade', 'Selected', 'Accepted', 'Flagged', ...(langs.length > 1 ? langs.map((l) => `Accepted ${l}`) : [])],
      decades.map((d) => [d, results.filter((r) => decadeOf(r.item.candidate.firstChartYear) === d).length, accByDec.get(d) ?? 0, flagByDec.get(d) ?? 0, ...(langs.length > 1 ? langs.map((l) => accByDecLang.get(`${d}|${l}`) ?? 0) : [])]),
    ),
  );

  L.push('', '## Difficulty (accepted songs)', '');
  const dRows = langs.map((l) => {
    const xs = accepted.filter((a) => a.song.language === l);
    return [l, ...[1, 2, 3].map((d) => xs.filter((a) => a.song.difficulty === d).length), xs.length];
  });
  L.push(accepted.length ? mdTable(['Language', '1 easy', '2 medium', '3 hard', 'Total'], dRows) : 'No accepted songs.');
  const noFame = accepted.filter((a) => a.row.res.pageViews == null && a.row.res.deezerRank == null);
  if (noFame.length) {
    L.push('', `No fame signal (no page views, no Deezer rank): ${noFame.length}`, '');
    for (const a of noFame.slice(0, 30)) L.push(`- ${a.song.artist} – ${a.song.title} (${a.song.year}, best rank ${a.row.item.candidate.bestRank ?? '-'}) → difficulty ${a.song.difficulty}`);
  }

  L.push('', '## Top performers (accepted + flagged)', '');
  const top = countBy(results, (r) => r.item.candidate.artist).slice(0, 15);
  L.push(mdTable(['Performer', 'Songs'], top));

  L.push('', '## Problems from extraction', '');
  if (sel.problems?.length) {
    L.push(`${sel.problems.length} pages or rows could not be parsed:`, '');
    for (const p of sel.problems.slice(0, 50)) L.push(`- ${p.page ?? ''}: ${p.reason ?? JSON.stringify(p)}`);
    if (sel.problems.length > 50) L.push(`- … and ${sel.problems.length - 50} more (selection.json)`);
  } else L.push('None.');

  const errs = countBy(
    results.flatMap((r) => Object.entries(r.res.errors ?? {}).map(([k, v]) => `${k}: ${v}`)),
    (x) => x,
  );
  if (errs.length) L.push('', '## Source errors', '', ...errs.map(([e, n]) => `- ${e} ×${n}`));

  if (flagged.length) {
    L.push('', `<details><summary>Flagged songs (${flagged.length})</summary>`, '');
    L.push(mdTable(['Performer', 'Title', 'Chart', 'WP', 'WD', 'MB', 'Store', 'Reasons'], flagged.map((f) => [f.artist, f.title, `${f.firstChartYear} #${f.bestRank}`, f.wikipedia, f.wikidata, f.musicbrainz, f.store, f.reasons.join(', ')])));
    L.push('', '</details>');
  }
  return L.join('\n') + '\n';
}
