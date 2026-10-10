// Task 3.6: pick a batch of fresh candidates.
//
// selectBatch(candidates, request) → { chosen, leftOut: [{ candidate, reason, detail? }], counts }
//
// candidates: merged fresh candidates (match.mjs), each with language, firstChartYear (or
//   chartYear), bestRank (or rank) and, after genre.mjs, `excluded` (+ optional `excludeReason`).
// request:
//   size           batch size (default 300)
//   languages      languages allowed (default: all)
//   fromYear/toYear chart-year range (inclusive, optional)
//   languageShare  { he: 1, en: 2 } relative weights; default: in proportion to the eligible candidates
//   decadeShare    'even' (default), 'proportional', or { 1980: 2, 1990: 1 } relative weights
//                  (applied within each language; a decade with weight 0 or missing is not used)
//   isExcluded(c)  → reason string or null; default reads c.excluded / c.excludeReason
//
// Quotas are given one place at a time to the group (language, then decade) furthest below
// its share, skipping groups with no candidates left, so a short group's places go to the
// others and the batch is filled when enough candidates exist. Within a group, higher-ranked
// songs go first (bestRank, then more chart entries, then earlier year, then artist/title).
//
// Reasons: 'excluded', 'outside-top-20' (D7), 'language-not-requested', 'outside-year-range',
// 'decade-not-requested', 'batch-full'.
export const TOP = 20;

const yearOf = (c) => c.firstChartYear ?? c.chartYear;
const rankOf = (c) => c.bestRank ?? c.rank;
export const decadeOf = (c) => Math.floor(yearOf(c) / 10) * 10;

const defaultIsExcluded = (c) => (c.excluded ? (c.excludeReason ?? 'excluded performer (D5)') : null);

export function compareCandidates(a, b) {
  return (
    rankOf(a) - rankOf(b) ||
    (b.charts?.length ?? 1) - (a.charts?.length ?? 1) ||
    yearOf(a) - yearOf(b) ||
    (a.artist < b.artist ? -1 : a.artist > b.artist ? 1 : 0) ||
    (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)
  );
}

/** Splits `total` places over groups [{ key, weight, capacity }] → Map key → quota. */
export function allocate(total, groups) {
  const quota = new Map(groups.map((g) => [g.key, 0]));
  for (let left = total; left > 0; left--) {
    let best = null;
    let bestValue = -Infinity;
    for (const g of groups) {
      if (!(g.weight > 0) || quota.get(g.key) >= g.capacity) continue;
      const value = g.weight / (quota.get(g.key) + 1);
      if (value > bestValue) {
        best = g;
        bestValue = value;
      }
    }
    if (!best) break;
    quota.set(best.key, quota.get(best.key) + 1);
  }
  return quota;
}

function countBy(list, keyOf) {
  const out = {};
  for (const c of list) out[keyOf(c)] = (out[keyOf(c)] ?? 0) + 1;
  return out;
}

export function selectBatch(candidates, request = {}) {
  const { size = 300, languages, fromYear, toYear, languageShare, decadeShare = 'even', isExcluded = defaultIsExcluded } = request;
  const leftOut = [];
  const eligible = [];
  for (const c of candidates) {
    const excluded = isExcluded(c);
    if (excluded) leftOut.push({ candidate: c, reason: 'excluded', detail: excluded });
    else if (!(rankOf(c) >= 1 && rankOf(c) <= TOP)) leftOut.push({ candidate: c, reason: 'outside-top-20' });
    else if (languages && !languages.includes(c.language)) leftOut.push({ candidate: c, reason: 'language-not-requested' });
    else if ((fromYear !== undefined && yearOf(c) < fromYear) || (toYear !== undefined && yearOf(c) > toYear)) leftOut.push({ candidate: c, reason: 'outside-year-range' });
    else if (typeof decadeShare === 'object' && !(decadeShare[decadeOf(c)] > 0)) leftOut.push({ candidate: c, reason: 'decade-not-requested' });
    else eligible.push(c);
  }

  const byLanguage = new Map();
  for (const c of [...eligible].sort(compareCandidates)) {
    if (!byLanguage.has(c.language)) byLanguage.set(c.language, new Map());
    const decades = byLanguage.get(c.language);
    const d = decadeOf(c);
    if (!decades.has(d)) decades.set(d, []);
    decades.get(d).push(c);
  }

  const langKeys = [...byLanguage.keys()].sort();
  const langCount = (l) => [...byLanguage.get(l).values()].reduce((n, g) => n + g.length, 0);
  const langQuota = allocate(
    size,
    langKeys.map((l) => ({ key: l, weight: languageShare ? (languageShare[l] ?? 0) : langCount(l), capacity: langCount(l) })),
  );

  const chosen = [];
  for (const l of langKeys) {
    const decades = byLanguage.get(l);
    const decadeKeys = [...decades.keys()].sort((a, b) => a - b);
    const weight = (d) => (decadeShare === 'even' ? 1 : decadeShare === 'proportional' ? decades.get(d).length : (decadeShare[d] ?? 0));
    const q = allocate(langQuota.get(l), decadeKeys.map((d) => ({ key: d, weight: weight(d), capacity: decades.get(d).length })));
    for (const d of decadeKeys) {
      const group = decades.get(d);
      chosen.push(...group.slice(0, q.get(d)));
      for (const c of group.slice(q.get(d))) leftOut.push({ candidate: c, reason: 'batch-full' });
    }
  }

  return {
    chosen,
    leftOut,
    counts: {
      byLanguage: countBy(chosen, (c) => c.language),
      byDecade: countBy(chosen, (c) => `${c.language} ${decadeOf(c)}s`),
      leftOut: countBy(leftOut, (x) => x.reason),
    },
  };
}
