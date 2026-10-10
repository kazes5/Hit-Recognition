// Candidate extractors (SONG_PIPELINE task 3.2, contract in pipeline/INTERFACES.md).
//
//   extract({ sources, fromYear, toYear, top = 20, getJson? }) → { candidates, problems, pages }
//
// candidates: { source, chartYear, rank, artist, title, language, page, creditRaw[, placing][, soloist] }
//   - Hebrew annual parades (annual.mjs): both stations' rankings come from the same yearly
//     pages; a military band credit "להקה, סולן: X" gives artist = the band, soloist = X.
//   - artist is the main performer: a "feat."/"featuring"/"בהשתתפות" suffix is cut off;
//     creditRaw keeps the full credit as written (cleaned of links and refs).
//   - Hebrew-calendar charts: chartYear = the civil year the Hebrew year ended in (תשמ"ג → 1983).
//   - Top `top` ranks only (decision D7). Eurovision: rank 1 (the entry), final placing in
//     `placing`. Israel Song Festival: rank = placing, or 1 when the page gives none.
// problems: { source, page, reason } for every page, table, row or year that could not be read,
//   and for expected years with no chart or fewer than `top` ranks.
// pages: what each fetched page gave (for the run summary): { source, title, url, years, entries, notes }.
//
// Network: MediaWiki Action API (action=parse&prop=wikitext, list=allpages, list=search)
// through the shared client of sources/http.mjs (cache, retries, rate limits).
import { errorText, getJson as defaultGetJson } from '../sources/http.mjs';
import { yearsIn } from '../sources/normalize.mjs';
import { parseAnnualPage } from './annual.mjs';
import { parseChartPage, yearFromText } from './chart-page.mjs';
import { hebrewYearsIn } from './hebrew-year.mjs';
import { ALL_SOURCES, SOURCES } from './sources.mjs';

const api = (wiki) => `https://${wiki}.wikipedia.org/w/api.php`;
export const pageUrl = (wiki, title) => `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;

/** Wikitext of a page (redirects followed) → { title, wikitext } or null when the page does not exist. */
export async function fetchWikitext(wiki, title, getJson) {
  const url = `${api(wiki)}?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page=${encodeURIComponent(title)}`;
  const r = await getJson(url);
  if (r?.error) {
    if (r.error.code === 'missingtitle' || r.error.code === 'invalidtitle') return null;
    throw new Error(`API error ${r.error.code}: ${r.error.info ?? ''}`.trim());
  }
  const p = r?.parse;
  if (!p) throw new Error('no parse result');
  const wikitext = typeof p.wikitext === 'string' ? p.wikitext : p.wikitext?.['*'] ?? '';
  return { title: p.title ?? title, wikitext };
}

/** Page titles by prefix (non-redirect articles). */
export async function pagesByPrefix(wiki, prefix, getJson) {
  const url = `${api(wiki)}?action=query&list=allpages&apnamespace=0&apfilterredir=nonredirects&aplimit=100&format=json&formatversion=2&apprefix=${encodeURIComponent(prefix)}`;
  const r = await getJson(url);
  return (r?.query?.allpages ?? []).map((p) => p.title);
}

/** Page titles from a full-text search. */
export async function pagesBySearch(wiki, query, getJson) {
  const url = `${api(wiki)}?action=query&list=search&srnamespace=0&srlimit=50&format=json&formatversion=2&srsearch=${encodeURIComponent(query)}`;
  const r = await getJson(url);
  return (r?.query?.search ?? []).map((p) => p.title);
}

/** Year of a page from its title, when the title names exactly one year. */
export function titleYear(title) {
  const n = hebrewYearsIn(title).length + yearsIn(title).length;
  return n === 1 ? yearFromText(title) : null;
}

async function discover(cfg, getJson, problem) {
  const found = [];
  const add = (t) => { if (!found.includes(t)) found.push(t); };
  for (const prefix of cfg.prefixes ?? []) {
    try {
      (await pagesByPrefix(cfg.wiki, prefix, getJson)).filter(cfg.accept).forEach(add);
    } catch (e) {
      problem(`${cfg.wiki}:allpages "${prefix}"`, `page discovery failed: ${errorText(e)}`);
    }
  }
  for (const q of cfg.searches ?? []) {
    try {
      (await pagesBySearch(cfg.wiki, q, getJson)).filter(cfg.accept).forEach(add);
    } catch (e) {
      problem(`${cfg.wiki}:search "${q}"`, `page discovery failed: ${errorText(e)}`);
    }
  }
  return found;
}

/**
 * Read one source. → { entries (with page url), problems, pages }
 */
async function extractSource(id, { fromYear, toYear, top, getJson, memo = new Map() }) {
  const cfg = SOURCES[id];
  const problems = [];
  const pages = [];
  const problem = (page, reason) => problems.push({ source: id, page, reason });
  const rankMode = cfg.rankMode ?? 'rank';
  const lo = Math.max(fromYear, cfg.firstYear);
  const hi = Math.min(toYear, cfg.lastYear);
  if (lo > hi) return { entries: [], problems, pages };

  /** [{ title, pageYear }] to fetch; a list of alternatives is tried in order. */
  const jobs = [];
  if (cfg.titlesForYear) {
    for (let y = lo; y <= hi; y++) jobs.push({ alternatives: cfg.titlesForYear(y), pageYear: y });
  } else {
    const titles = [...(cfg.pages ?? []), ...(await discover(cfg, getJson, problem))];
    for (const t of cfg.fallbackPages ?? []) if (!titles.includes(t)) titles.push(t);
    for (const t of titles) jobs.push({ alternatives: [t], pageYear: titleYear(t), optional: !(cfg.pages ?? []).includes(t) && (cfg.fallbackPages ?? []).includes(t) });
  }

  const seen = new Set();
  const byYear = new Map(); // chartYear → [{ url, entries }]
  for (const job of jobs) {
    let got = null;
    let failed = false;
    for (const t of job.alternatives) {
      try {
        got = await fetchWikitext(cfg.wiki, t, getJson);
      } catch (e) {
        problem(pageUrl(cfg.wiki, t), `fetch failed: ${errorText(e)}`);
        failed = true;
        break;
      }
      if (got) break;
    }
    if (!got) {
      if (!failed && !job.optional) {
        const what = job.pageYear && cfg.titlesForYear ? `year ${job.pageYear}: ` : '';
        problem(pageUrl(cfg.wiki, job.alternatives[0]), `${what}page not found (tried: ${job.alternatives.join(' | ')})`);
      }
      continue;
    }
    if (seen.has(got.title)) continue; // a redirect to a page already read
    seen.add(got.title);
    const url = pageUrl(cfg.wiki, got.title);
    let r;
    if (cfg.annual) {
      // The annual Hebrew pages hold both stations' rankings: parse each page once per run.
      let parsed = memo.get(got.title);
      const first = !parsed;
      if (first) memo.set(got.title, (parsed = parseAnnualPage({ wikitext: got.wikitext, page: url })));
      const all = parsed.entries;
      r = { entries: all.filter((e) => e.source === id), problems: [], notes: parsed.notes };
      for (const p of parsed.problems) {
        if (p.source === id) problems.push(p);
        else if (!p.source && first) problems.push({ source: 'hebrew-annual', ...p });
      }
      if (!all.length && !parsed.problems.length) problem(url, 'no ranking list found on the page');
    } else {
      r = parseChartPage({ wikitext: got.wikitext, page: url, pageYear: job.pageYear, skip: cfg.skip ?? null, rankMode });
      for (const p of r.problems) problems.push({ source: id, ...p });
      if (!r.entries.length && !r.problems.length) problem(url, `no chart table or list found on the page${r.notes.length ? ` (${r.notes.length} tables/lists ignored, see summary)` : ''}`);
    }
    const years = new Map();
    for (const e of r.entries) {
      if (!years.has(e.chartYear)) years.set(e.chartYear, []);
      years.get(e.chartYear).push(e);
    }
    for (const [y, es] of years) {
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push({ url, entries: es });
    }
    pages.push({ source: id, title: got.title, url, years: [...years.keys()].sort((a, b) => a - b), entries: r.entries.length, notes: r.notes });
  }

  const entries = [];
  for (const y of [...byYear.keys()].sort((a, b) => a - b)) {
    if (y < lo || y > hi) continue;
    // The same year on several pages (e.g. a main article and a decade page): use the fullest.
    const options = byYear.get(y).sort((a, b) => b.entries.length - a.entries.length);
    if (options.length > 1) {
      problem(options[1].url, `year ${y} is also on ${options[0].url}; used that page (${options[0].entries.length} vs ${options[1].entries.length} rows)`);
    }
    const { url, entries: es } = options[0];
    let kept = es.map((e) => ({ ...e, page: url }));
    if (rankMode === 'rank') {
      kept = kept.filter((e) => e.rank >= 1 && e.rank <= top);
      const ranks = kept.map((e) => e.rank);
      const single = kept.filter((e) => !e.tie).map((e) => e.rank); // "7א"/"7ב" ties are expected
      const dup = [...new Set(single.filter((r, i) => single.indexOf(r) !== i))];
      if (dup.length) problem(url, `year ${y}: rank ${dup.join(', ')} appears more than once (ties or a parsing error)`);
      const missing = [];
      for (let r = 1; r <= top; r++) if (!ranks.includes(r)) missing.push(r);
      if (missing.length) problem(url, `year ${y}: ${missing.length} of the top ${top} ranks missing (${missing.length > 8 ? `${missing.slice(0, 8).join(', ')}, …` : missing.join(', ')})`);
    } else if (cfg.rankFromPlacing) {
      // No placing column: rank 1 (the entry). A placing column but no placing for this song
      // (only the first places were announced): the lowest rank, `top`.
      kept = kept.map((e) => ({ ...e, rank: !('placing' in e) ? 1 : e.placing ?? top })).filter((e) => e.rank >= 1 && e.rank <= top);
    }
    entries.push(...kept);
  }
  if (cfg.expectEveryYear !== false) {
    const have = new Set(entries.map((e) => e.chartYear));
    const missing = [];
    for (let y = lo; y <= hi; y++) if (!have.has(y)) missing.push(y);
    if (missing.length) problem(`${id}`, `no chart found for ${missing.length} year(s): ${compactYears(missing)}`);
  }
  return { entries, problems, pages, cfg };
}

/** [1970,1971,1972,1980] → "1970–1972, 1980" */
export function compactYears(ys) {
  const out = [];
  for (let i = 0; i < ys.length; i++) {
    let j = i;
    while (j + 1 < ys.length && ys[j + 1] === ys[j] + 1) j++;
    out.push(j > i ? `${ys[i]}–${ys[j]}` : `${ys[i]}`);
    i = j;
  }
  return out.join(', ');
}

function languageOf(cfg, e) {
  if (e.languageText) {
    const t = e.languageText;
    if (/אנגלית|english/i.test(t) && !/עברית|hebrew/i.test(t)) return 'en';
    return 'he';
  }
  return cfg.language;
}

/**
 * @param {object} o
 * @param {string[]} [o.sources]  default: all
 * @param {number} [o.fromYear]
 * @param {number} [o.toYear]
 * @param {number} [o.top=20]
 * @param {(url:string)=>Promise<any>} [o.getJson]
 */
export async function extract({ sources = ALL_SOURCES, fromYear = 1900, toYear = 2100, top = 20, getJson = defaultGetJson } = {}) {
  const candidates = [];
  const problems = [];
  const pages = [];
  const memo = new Map();
  for (const id of sources) {
    if (!SOURCES[id]) {
      problems.push({ source: id, page: id, reason: `unknown source (known: ${ALL_SOURCES.join(', ')})` });
      continue;
    }
    const r = await extractSource(id, { fromYear, toYear, top, getJson, memo });
    problems.push(...r.problems);
    pages.push(...r.pages);
    for (const e of r.entries) {
      const c = { source: id, chartYear: e.chartYear, rank: e.rank, artist: e.artist, title: e.title, language: languageOf(SOURCES[id], e), page: e.page, creditRaw: e.creditRaw };
      if ('placing' in e) c.placing = e.placing;
      if (e.soloist) c.soloist = e.soloist;
      candidates.push(c);
    }
  }
  return { candidates, problems, pages };
}

export { ALL_SOURCES, SOURCES };
