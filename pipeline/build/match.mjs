// Task 3.3: merge the same song across charts and years, and find candidates that
// are already in the catalog, also under another spelling.
//
// Matching rule: two entries are the same song when a normalized TITLE key is
// equal AND the PERFORMER keys overlap. Title alone is never enough: Yardena
// Arazi's "בן אדם" and Odeya's "בן אדם" are different songs.
//
// Normalization is a re-implementation of the server's (server/src/guess.ts
// normalizeGuess + splitContributors; server/dist is not built in the pipeline),
// on top of sources/normalize.mjs `norm`: lower case, no niqqud or accents, no
// brackets or store suffixes, apostrophes / geresh dropped, "&" = "and",
// punctuation -> space, Hebrew final letters folded, spaces ignored. Performer
// keys also drop a leading "the" / "להקת" and are split into contributors on
// & + , / feat. ft. featuring with and x vs. עם and the Hebrew "ו" prefix.
import { norm } from '../sources/normalize.mjs';

const FINAL_FORMS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const HEBREW = /[֐-׿]/;
const LATIN_SEPARATORS = /\s*(?:&|\+|,|\/|;)\s*|\s+(?:feat\.?|ft\.?|featuring|with|and|x|vs\.?|עם)\s+/i;
const HEBREW_AND = /\s+ו-?(?=[א-ת])/;

/** norm() plus Hebrew final letters folded and a standalone "n" read as "and". */
export function fold(text) {
  return norm(text)
    .replace(/[ךםןףץ]/g, (c) => FINAL_FORMS[c])
    .replace(/(^| )n(?= |$)/g, '$1and');
}

const compact = (s) => s.replace(/ /g, '');

/**
 * Hebrew spelling-variant key for performer names (batch 1: "בעז שרעבי" / "בועז שרעבי"): per
 * word, no leading article ה and no ו / י after the first letter. Added next to the exact key;
 * a match still needs the title to agree. (Title variants are reported as possible duplicates.)
 */
export function looseHebrew(folded) {
  if (!HEBREW.test(folded)) return null;
  return folded
    .split(' ')
    .map((w) => (w.length > 2 && w.startsWith('ה') ? w.slice(1) : w))
    .map((w) => w[0] + w.slice(1).replace(/[וי]/g, ''))
    .join('');
}

/** Title match keys (spaces removed): the full title and the title without a " - …" tail. */
export function titleKeys(title) {
  const raw = String(title ?? '');
  const keys = new Set();
  for (const t of [raw, raw.replace(/\s[-–—]\s.*$/, '')]) {
    let k = compact(fold(t));
    if (!k) k = compact(fold(t.replace(/[()[\]]/g, ' '))); // a title that is all brackets
    if (k) keys.add(k);
  }
  return [...keys];
}

function artistKey(name) {
  return compact(fold(name).replace(/^the /, '').replace(/^להקת /, ''));
}

/** Splits a credit into contributor names (raw text). */
export function splitCredit(credit) {
  const raw = String(credit ?? '');
  let parts = raw.split(LATIN_SEPARATORS);
  if (HEBREW.test(raw)) parts = parts.flatMap((p) => p.split(HEBREW_AND));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Performer keys of a credit: the whole credit and each contributor. */
export function creditKeys(credit) {
  const names = [credit, ...splitCredit(credit)];
  const keys = new Set(names.map(artistKey));
  for (const n of names) {
    const l = looseHebrew(fold(n).replace(/^להקת /, ''));
    if (l) keys.add(`~${l}`);
  }
  keys.delete('');
  return [...keys];
}

/** Performer keys of a catalog song: credit, artistAliases and artistKeys. */
export function songPerformerKeys(song) {
  const keys = new Set();
  for (const name of [song.artist, ...(song.artistAliases ?? []), ...(song.artistKeys ?? [])]) {
    for (const k of creditKeys(name)) keys.add(k);
  }
  return [...keys];
}

/** Title keys of a catalog song: title and titleAliases. */
export function songTitleKeys(song) {
  return [...new Set([song.title, ...(song.titleAliases ?? [])].flatMap(titleKeys))];
}

const overlaps = (a, b) => {
  const set = new Set(a);
  return b.some((k) => set.has(k));
};

/** True when two catalog-shaped songs (artist/title plus optional aliases) are the same song. */
export function sameSong(a, b) {
  return overlaps(songTitleKeys(a), songTitleKeys(b)) && overlaps(songPerformerKeys(a), songPerformerKeys(b));
}

/** Edit distance with adjacent swaps (as in server/src/guess.ts). */
function editDistance(x, y) {
  const a = Array.from(x);
  const b = Array.from(y);
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2][j - 2] + 1);
      d[i][j] = best;
    }
  }
  return d[a.length][b.length];
}

/** Hebrew spelling skeleton: without the vowel letters ו and י (כתיב מלא / חסר: "אימא" = "אמא"). */
const skeleton = (key) => (HEBREW.test(key) ? key.replace(/[וי]/g, '') : key);

/** Titles close enough to be the same song when the performer is the same (never used alone). */
function similarTitle(a, b) {
  if (a === b) return true;
  if (HEBREW.test(a) && skeleton(a) === skeleton(b) && skeleton(a).length >= 2) return true;
  const len = Math.min(Array.from(a).length, Array.from(b).length);
  const max = len < 6 ? 0 : len <= 14 ? 1 : 2;
  return max > 0 && editDistance(a, b) <= max;
}

const SOURCE_ORDER = ['reshet-gimel', 'galgalatz', 'billboard', 'israel-song-festival', 'eurovision'];
const sourceIndex = (s) => (SOURCE_ORDER.includes(s) ? SOURCE_ORDER.indexOf(s) : SOURCE_ORDER.length);
const rankOf = (c) => (Number.isFinite(c.rank) ? c.rank : Infinity);

function mergeGroup(entries) {
  const best = [...entries].sort((a, b) => rankOf(a) - rankOf(b) || a.chartYear - b.chartYear || sourceIndex(a.source) - sourceIndex(b.source))[0];
  const charts = entries
    .map((c) => ({ source: c.source, chartYear: c.chartYear, rank: c.rank, ...(c.page ? { page: c.page } : {}) }))
    .sort((a, b) => a.chartYear - b.chartYear || rankOf(a) - rankOf(b) || sourceIndex(a.source) - sourceIndex(b.source));
  const firstChartYear = Math.min(...entries.map((c) => c.chartYear));
  return {
    ...best,
    chartYear: firstChartYear,
    rank: best.rank,
    bestRank: best.rank,
    firstChartYear,
    charts,
  };
}

/**
 * Merges the same song across charts and years. Two candidates are the same song
 * when a title key is equal and the performer keys overlap. Already-merged
 * candidates (with `charts`) are expanded first, so merging is idempotent.
 */
export function mergeCandidates(candidates) {
  const flat = candidates.flatMap((c) =>
    Array.isArray(c.charts) && c.charts.length ? c.charts.map((ch) => ({ ...c, ...ch, charts: undefined, bestRank: undefined, firstChartYear: undefined })) : [c],
  );
  const groups = []; // { titleKeys:Set, artistKeys:Set, entries:[] }
  const byTitle = new Map();
  for (const raw of flat) {
    const c = { ...raw };
    delete c.charts;
    delete c.bestRank;
    delete c.firstChartYear;
    const tks = titleKeys(c.title);
    const aks = creditKeys(c.artist);
    let group = null;
    for (const tk of tks) {
      group = (byTitle.get(tk) ?? []).find((g) => aks.some((k) => g.artistKeys.has(k))) ?? null;
      if (group) break;
    }
    if (!group) {
      group = { titleKeys: new Set(), artistKeys: new Set(), entries: [] };
      groups.push(group);
    }
    group.entries.push(c);
    for (const k of aks) group.artistKeys.add(k);
    for (const tk of tks) {
      if (group.titleKeys.has(tk)) continue;
      group.titleKeys.add(tk);
      byTitle.set(tk, [...(byTitle.get(tk) ?? []), group]);
    }
  }
  return groups.map((g) => mergeGroup(g.entries));
}

/** Index of a catalog for findInCatalog. */
export function indexCatalog(catalogSongs) {
  const byTitle = new Map();
  const byPerformer = new Map();
  const info = new Map();
  for (const song of catalogSongs) {
    const t = songTitleKeys(song);
    const p = songPerformerKeys(song);
    info.set(song, { t, p });
    for (const k of t) byTitle.set(k, [...(byTitle.get(k) ?? []), song]);
    for (const k of p) byPerformer.set(k, [...(byPerformer.get(k) ?? []), song]);
  }
  return { byTitle, byPerformer, info };
}

/**
 * Looks one song (catalog-shaped: artist, title, optional aliases) up in an indexed catalog.
 * → { match: song|null, similar: [{ song, reason }] }, where reason is
 *   'similar-title-same-performer' (a spelling variant: a person should check) or
 *   'same-title-other-performer' (usually a different song, e.g. a cover or a namesake).
 */
export function findInCatalog(song, index) {
  const tks = songTitleKeys(song);
  const aks = songPerformerKeys(song);
  const sameTitle = [...new Set(tks.flatMap((k) => index.byTitle.get(k) ?? []))].sort((a, b) => a.id - b.id);
  const match = sameTitle.find((s) => overlaps(aks, index.info.get(s).p)) ?? null;
  if (match) return { match, similar: [] };
  const similar = [];
  for (const s of sameTitle) similar.push({ song: s, reason: 'same-title-other-performer' });
  const samePerformer = [...new Set(aks.flatMap((k) => index.byPerformer.get(k) ?? []))].sort((a, b) => a.id - b.id);
  for (const s of samePerformer) {
    if (index.info.get(s).t.some((x) => tks.some((y) => similarTitle(x, y)))) similar.push({ song: s, reason: 'similar-title-same-performer' });
  }
  return { match: null, similar };
}

/**
 * → { fresh, existing, merged, possibleDuplicates }
 *   merged:  every distinct song of the input, merged across charts/years
 *            (`bestRank`, `firstChartYear`, `charts`; `chartYear`/`rank` are set to those too);
 *   existing: [{ candidate, songId }] for merged candidates already in the catalog;
 *   fresh:   the other merged candidates;
 *   possibleDuplicates: [{ candidate, songId, reason }] for fresh candidates that look like a
 *            catalog song without matching it (see findInCatalog); the orchestrator decides
 *            whether to flag them. `same-title-other-performer` is common and usually fine.
 */
export function matchCatalog(candidates, catalogSongs) {
  const merged = mergeCandidates(candidates);
  const index = indexCatalog(catalogSongs);
  const fresh = [];
  const existing = [];
  const possibleDuplicates = [];
  for (const candidate of merged) {
    const { match, similar } = findInCatalog(candidate, index);
    if (match) {
      existing.push({ candidate, songId: match.id });
      continue;
    }
    fresh.push(candidate);
    for (const s of similar) possibleDuplicates.push({ candidate, songId: s.song.id, reason: s.reason });
  }
  return { fresh, existing, merged, possibleDuplicates };
}
