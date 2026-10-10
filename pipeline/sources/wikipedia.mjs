// Wikipedia (he, en) through the MediaWiki Action API.
//   search:  /w/api.php?action=query&list=search&srsearch=...&format=json&formatversion=2
//            → { query: { search: [ { ns, title, pageid, snippet } ] } }
//   page:    /w/api.php?action=parse&page=...&prop=wikitext|properties|categories&redirects=1&format=json&formatversion=2
//            → { parse: { title, pageid, wikitext: "...", properties: { wikibase_item: "Q…" },
//                         categories: [ { sortkey, category: "1969_singles", hidden? } ] } }
//            (formatversion=1 shapes — wikitext {'*'}, properties [{name,'*'}], categories [{'*'}] — are accepted too.)
//
// The year comes from the song's infobox release field only. "recorded"/"הוקלט" and
// re-release fields or segments are ignored (the two source-test bugs: Proud Mary
// read "recorded", Sultans of Swing read a re-release).
import { errorText, getJson as defaultGetJson } from './http.mjs';
import { artistMatches, norm, titleMatch, yearsIn } from './normalize.mjs';

/**
 * Release-date fields, compared after lower-casing and turning "_" into " ".
 * English: {{Infobox song}} / {{Infobox single}} use `released` (older pages `release_date`/`release date`).
 * Hebrew: {{סינגל}}, {{שיר}}, {{אלבום}} and older variants. "יצא לאור" is the field of the
 * single/album templates; the rest are variants seen on older or hand-made infoboxes.
 */
export const RELEASE_FIELDS = {
  en: ['released', 'release date', 'release', 'single released'],
  he: ['יצא לאור', 'תאריך יציאה', 'תאריך הוצאה', 'תאריך הוצאה לאור', 'שנת יציאה', 'שנת הוצאה', 'הוצאה', 'יציאה', 'שנת הוצאה לאור', 'פורסם', 'שנה'],
};
/** Fields that must never give the year (listed so tests can check they are ignored). */
export const IGNORED_FIELDS = ['recorded', 'הוקלט', 'תאריך הקלטה', 'שנת הקלטה', 'rereleased', 're-released', 'reissued', 'הוצאה מחודשת', 'יצא לאור מחדש'];
/** A segment of a release field that describes a later edition. */
const REISSUE = /re-?release|re-?issue|reissued|re-?recorded|remaster|re-?mix|re-?edit|re-?promot|הוצאה מחודשת|יצא מחדש|יצא לאור מחדש|גרסה מחודשת|מהדורה מחודשת|הקלטה מחודשת|רמיקס/i;
const NON_SONG_PAGE = /\b(album|film|novel|band|disambiguation|tv series|musical|play|book|ep)\b|אלבום|סרט|להקה|פירושונים|ספר|מחזה|סדרה/i;

const api = (lang) => `https://${lang}.wikipedia.org/w/api.php`;

// ---------- wikitext parsing (pure) ----------

/** Remove comments, <ref>…</ref>, <ref/>, <nowiki> so access dates in citations are not read as years. */
export function stripNoise(wikitext) {
  return String(wikitext ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '')
    .replace(/<\/?nowiki\s*\/?>/gi, '');
}

/**
 * Top-level templates of a wikitext: [{ name, params: [[key, value]], positional: [] }].
 * Pipes inside nested {{…}} and [[…]] do not split parameters.
 */
export function parseTemplates(wikitext) {
  const text = stripNoise(wikitext);
  const out = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('{{', i);
    if (start < 0) break;
    let depth = 0;
    let link = 0;
    let j = start;
    const parts = [];
    let partStart = start + 2;
    for (; j < text.length; j++) {
      const two = text.slice(j, j + 2);
      if (two === '{{') { depth++; j++; continue; }
      if (two === '}}') {
        depth--;
        if (depth === 0) { parts.push(text.slice(partStart, j)); break; }
        j++;
        continue;
      }
      if (two === '[[') { link++; j++; continue; }
      if (two === ']]') { link = Math.max(0, link - 1); j++; continue; }
      if (text[j] === '|' && depth === 1 && link === 0) { parts.push(text.slice(partStart, j)); partStart = j + 1; }
    }
    if (depth !== 0) break; // unbalanced: stop
    const [rawName, ...rest] = parts;
    const params = [];
    const positional = [];
    for (const p of rest) {
      const eq = p.indexOf('=');
      // "=" inside a nested template/link does not name a parameter
      const before = eq >= 0 ? p.slice(0, eq) : '';
      if (eq >= 0 && !/\{\{|\[\[/.test(before)) params.push([before.trim(), p.slice(eq + 1).trim()]);
      else positional.push(p.trim());
    }
    out.push({ name: rawName.trim().replace(/^(?:template|תבנית)\s*:\s*/i, ''), params, positional });
    i = j + 2;
  }
  return out;
}

const keyOf = (k) => k.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

/** Earliest year in a release-field value, ignoring segments that describe a re-release. */
export function yearFromReleaseValue(value) {
  const segments = String(value ?? '')
    .split(/<br\s*\/?>|\n|;|\{\{\s*(?:plainlist|ubl|unbulleted list|flatlist)\s*\|/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const ys = segments.filter((s) => !REISSUE.test(s)).flatMap((s) => yearsIn(s));
  return ys.length ? Math.min(...ys) : null;
}

const RELEASE_KEYS = new Set([...RELEASE_FIELDS.en, ...RELEASE_FIELDS.he].map(keyOf));
/** Generic names that also appear in small non-infobox templates (e.g. a chart template's שנה). */
const WEAK_KEYS = new Set(['שנה', 'release', 'פורסם']);
/** An infobox has several named parameters. */
const MIN_INFOBOX_PARAMS = 4;

/**
 * Year of a song page: the first infobox that has a release field (with a year) wins;
 * only release fields are read. Falls back to a "<year> songs/singles" category.
 * @param {string|{wikitext:string,categories?:string[]}} page
 * @returns {{ year: number|null, field: string|null, template: string|null, infoboxKeys: string[] }}
 */
export function songYear(page) {
  const wikitext = typeof page === 'string' ? page : page?.wikitext ?? '';
  const templates = parseTemplates(wikitext);
  for (const t of templates) {
    for (const [k, v] of t.params) {
      const key = keyOf(k);
      if (!RELEASE_KEYS.has(key)) continue;
      if (WEAK_KEYS.has(key) && t.params.length < MIN_INFOBOX_PARAMS) continue;
      const year = yearFromReleaseValue(v);
      if (year) return { year, field: k, template: t.name, infoboxKeys: [] };
    }
  }
  const cats = [...(typeof page === 'object' && page?.categories ? page.categories : []), ...categoriesIn(wikitext)];
  for (const c of cats) {
    const y = yearFromCategory(c);
    if (y) return { year: y, field: `category:${c}`, template: null, infoboxKeys: [] };
  }
  // Nothing found: report the keys of infobox-like templates so new field names can be added.
  const infoboxKeys = templates.filter((t) => t.params.length >= 3).flatMap((t) => t.params.map(([k]) => `${t.name}.${k}`));
  return { year: null, field: null, template: null, infoboxKeys: [...new Set(infoboxKeys)].slice(0, 40) };
}

/** Category names written in the wikitext. */
export function categoriesIn(wikitext) {
  return [...String(wikitext ?? '').matchAll(/\[\[\s*(?:category|קטגוריה)\s*:\s*([^\]|]+)/gi)].map((m) => m[1].trim());
}

/** "1969 singles", "1969_songs", "שירי 1958", "סינגלים מ-1978", "שירים משנת 1958" → year. */
export function yearFromCategory(cat) {
  const c = String(cat).replace(/_/g, ' ').trim();
  let m = c.match(/^(\d{4}) (?:songs|singles)$/i);
  if (m) return Number(m[1]);
  m = c.match(/^(?:שירים|שירי|סינגלים|סינגלי)\s+(?:משנת|מ-?|משנת-?|של)?\s*(\d{4})$/);
  if (m) return Number(m[1]);
  return null;
}

/** QID of a parsed page (formatversion 1 or 2), or null. */
export function wikibaseItem(page) {
  if (!page) return null;
  if (page.qid) return page.qid;
  const props = page.properties ?? page.parse?.properties;
  if (!props) return null;
  if (Array.isArray(props)) return props.find((p) => p.name === 'wikibase_item')?.['*'] ?? null;
  return props.wikibase_item ?? null;
}

/** Normalise an action=parse response to { title, wikitext, categories, qid }. */
export function pageFromParse(json) {
  const p = json?.parse;
  if (!p) return null;
  const wikitext = typeof p.wikitext === 'string' ? p.wikitext : p.wikitext?.['*'] ?? '';
  const categories = (p.categories ?? []).map((c) => String(c.category ?? c['*'] ?? '').replace(/_/g, ' ')).filter(Boolean);
  return { title: p.title, wikitext, categories, qid: wikibaseItem(p) };
}

/**
 * Rank search hits for a song: the hit title (without its "(…)" part) must match the
 * song title. Preferred: "(song)"/"(שיר)" or the performer in the parenthesis, then a
 * plain title, then other parentheses. Albums, films, disambiguation pages are skipped.
 * @returns {string[]} page titles, best first
 */
export function rankSearchHits(hits, titles, artists) {
  const scored = [];
  for (const h of hits ?? []) {
    const m = String(h.title).match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const base = m ? m[1] : h.title;
    const paren = m ? m[2] : '';
    const tm = Math.max(0, ...titles.filter(Boolean).map((t) => titleMatch(base, t)));
    if (!tm) continue;
    if (paren && NON_SONG_PAGE.test(paren) && !/song|single|שיר|סינגל/i.test(paren)) continue;
    let rank;
    if (paren && (/song|single|שיר|סינגל/i.test(paren) || artistMatches(paren, artists))) rank = 0;
    else if (!paren) rank = 1;
    else rank = 2;
    if (tm < 2) rank += 3; // prefix matches after all exact ones
    const snippetHasArtist = artists.some((a) => norm(h.snippet ?? '').includes(norm(a)));
    scored.push({ title: h.title, score: rank * 2 + (snippetHasArtist ? 0 : 1) });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.title);
}

// ---------- network ----------

export async function searchPages(lang, query, { getJson = defaultGetJson, limit = 8 } = {}) {
  const url = `${api(lang)}?action=query&list=search&format=json&formatversion=2&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const r = await getJson(url);
  return r?.query?.search ?? [];
}

/**
 * Find the Wikipedia page of a song.
 * @returns {Promise<string|null>} page title
 */
export async function findSongPage(lang, title, artist, { titleAliases = [], artistAliases = [], getJson = defaultGetJson } = {}) {
  const titles = [title, ...titleAliases];
  const artists = [artist, ...artistAliases].filter(Boolean);
  const queries = [`${title} ${artist}`, lang === 'he' ? `${title} שיר` : `${title} song`];
  for (const q of queries) {
    const ranked = rankSearchHits(await searchPages(lang, q, { getJson }), titles, artists);
    if (ranked.length) return ranked[0];
  }
  return null;
}

/** Fetch and parse a page (follows redirects). → { title, wikitext, categories, qid } | null */
export async function fetchPage(lang, pageTitle, { getJson = defaultGetJson } = {}) {
  const url = `${api(lang)}?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext%7Cproperties%7Ccategories&page=${encodeURIComponent(pageTitle)}`;
  return pageFromParse(await getJson(url));
}

/**
 * Find a song's page and read its year and QID. Never throws.
 * @returns {Promise<{found:boolean, page?:string, year?:number|null, field?:string|null, qid?:string|null, infoboxKeys?:string[], error?:string}>}
 */
export async function lookupWikipedia(lang, song, opts = {}) {
  try {
    const page = await findSongPage(lang, song.title, song.artist, { titleAliases: song.titleAliases ?? [], artistAliases: song.artistAliases ?? [], ...opts });
    if (!page) return { found: false };
    return await readSongPage(lang, page, opts);
  } catch (e) {
    return { found: false, error: errorText(e) };
  }
}

/** Read year + QID of a known page title. Never throws. */
export async function readSongPage(lang, pageTitle, opts = {}) {
  try {
    const p = await fetchPage(lang, pageTitle, opts);
    if (!p) return { found: false, error: 'no parse result' };
    const y = songYear(p);
    return { found: true, lang, page: p.title, year: y.year, field: y.field, qid: p.qid, infoboxKeys: y.infoboxKeys };
  } catch (e) {
    return { found: false, error: errorText(e) };
  }
}
