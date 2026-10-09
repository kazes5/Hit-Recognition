// Task 3.9: difficulty of new songs (docs/SONG_PIPELINE.md).
//
//   - Songs with id <= LAST_ORIGINAL_ID are the original catalog: always 1, never scored,
//     and not part of any percentile.
//   - Each input (page views, Deezer rank) becomes a percentile among the NEW songs of the
//     same language that have that input (0 = least, 1 = most; equal values share the mean
//     of their positions; a single value is 0.5).
//   - fame  = mean of the available percentiles; chart = (21 − bestRank) / 20.
//   - score = 0.6·fame + 0.4·chart; with only one of fame / chart, that one alone.
//   - No input at all → difficulty 2, score null, `unscored: true` (listed in the report).
//   - Thirds of score among the scored new songs of each language: top 1, middle 2,
//     bottom 3. Order: score descending, then id ascending (deterministic ties).
export const LAST_ORIGINAL_ID = 669;
export const FAME_WEIGHT = 0.6;
export const CHART_WEIGHT = 0.4;

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** Percentile of each value among `values` (mid-rank for ties), as a Map value → percentile. */
export function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const out = new Map();
  if (n === 0) return out;
  if (n === 1) {
    out.set(sorted[0], 0.5);
    return out;
  }
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && sorted[j + 1] === sorted[i]) j++;
    out.set(sorted[i], (i + j) / 2 / (n - 1));
    i = j + 1;
  }
  return out;
}

/** chart = (21 − bestRank) / 20 for ranks 1..20, else null. */
export function chartScore(bestRank) {
  if (!isNum(bestRank) || bestRank < 1) return null;
  return Math.max(0, (21 - Math.min(bestRank, 21)) / 20);
}

/**
 * computeDifficulty(songs) → Map<id, { difficulty, score, fame, chart, unscored? }>
 * Input per song: { id, language, bestRank?, pageViews?, deezerRank? }. Every input id is in the map.
 */
export function computeDifficulty(songs) {
  const result = new Map();
  const byLanguage = new Map();
  for (const s of songs) {
    if (!(s.id > LAST_ORIGINAL_ID)) {
      result.set(s.id, { difficulty: 1, score: null, fame: null, chart: null });
      continue;
    }
    if (!byLanguage.has(s.language)) byLanguage.set(s.language, []);
    byLanguage.get(s.language).push(s);
  }

  for (const group of byLanguage.values()) {
    const views = percentiles(group.map((s) => s.pageViews).filter(isNum));
    const deezer = percentiles(group.map((s) => s.deezerRank).filter(isNum));
    const scored = [];
    for (const s of group) {
      const parts = [];
      if (isNum(s.pageViews)) parts.push(views.get(s.pageViews));
      if (isNum(s.deezerRank)) parts.push(deezer.get(s.deezerRank));
      const fame = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
      const chart = chartScore(s.bestRank);
      let score = null;
      if (fame !== null && chart !== null) score = FAME_WEIGHT * fame + CHART_WEIGHT * chart;
      else if (fame !== null) score = fame;
      else if (chart !== null) score = chart;
      if (score === null) {
        result.set(s.id, { difficulty: 2, score: null, fame: null, chart: null, unscored: true });
        continue;
      }
      scored.push({ id: s.id, score, fame, chart });
    }
    scored.sort((a, b) => b.score - a.score || a.id - b.id);
    const n = scored.length;
    scored.forEach((s, i) => {
      result.set(s.id, { difficulty: Math.floor((3 * i) / n) + 1, score: s.score, fame: s.fame, chart: s.chart });
    });
  }
  return result;
}

/** Ids that had no input and got the default difficulty 2 (for the report). */
export function unscoredIds(difficulties) {
  return [...difficulties].filter(([, d]) => d.unscored).map(([id]) => id);
}
