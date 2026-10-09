// Year rule (SONG_PIPELINE.md sections 2 and 3.4).
// Accept a year when at least two of the trusted sources {wikipedia, wikidata, musicbrainz}
// give exactly that year. The store (iTunes) year is never trusted: alone it only proposes
// a year ('store-only'); otherwise it is an upper bound (a note, not a flag).
//
// Flags (any flag → accepted = false, a person checks the song):
//   'pre-1970-hebrew'  Hebrew song whose year (agreed or proposed) is before 1970 (first-recording trap)
//   'disagree'         one or more trusted years, but no two agree exactly
//   'store-only'       no trusted year, only the store year
//   'none'             no year from any source
//   'chart-range'      chartYear given and the year is not in [chartYear − 2, chartYear]
// Notes (informational, not blocking):
//   'unanimous'        all three trusted sources give the same year (D8: automatic fix of the catalog)
//   'store-earlier'    the store year is earlier than the accepted year (store is an upper bound)
export const TRUSTED = ['wikipedia', 'wikidata', 'musicbrainz'];

/**
 * @param {{ wikipedia?: number|null, wikidata?: number|null, musicbrainz?: number|null, store?: number|null }} years
 * @param {{ language?: 'he'|'en', chartYear?: number|null }} [ctx]
 * @returns {{ year: number|null, accepted: boolean, flags: string[], notes: string[], sources: object, agreeing: string[] }}
 */
export function applyYearRule(years, { language, chartYear = null } = {}) {
  const sources = {};
  for (const k of [...TRUSTED, 'store']) {
    const v = years?.[k];
    sources[k] = Number.isInteger(v) ? v : null;
  }
  const trusted = TRUSTED.filter((k) => sources[k] !== null);
  const flags = [];
  const notes = [];
  let year = null;
  let agreeing = [];

  const counts = new Map();
  for (const k of trusted) counts.set(sources[k], [...(counts.get(sources[k]) ?? []), k]);
  const agreed = [...counts.entries()].find(([, ks]) => ks.length >= 2);

  if (agreed) {
    year = agreed[0];
    agreeing = agreed[1];
    if (agreeing.length === 3) notes.push('unanimous');
  } else if (trusted.length) {
    year = Math.min(...trusted.map((k) => sources[k])); // proposal for the reviewer
    flags.push('disagree');
  } else if (sources.store !== null) {
    year = sources.store;
    flags.push('store-only');
  } else {
    flags.push('none');
  }

  if (language === 'he' && year !== null && year < 1970) flags.push('pre-1970-hebrew');
  if (year !== null && Number.isInteger(chartYear) && !(year <= chartYear && year >= chartYear - 2)) flags.push('chart-range');
  if (agreed && sources.store !== null && sources.store < year) notes.push('store-earlier');

  return { year, accepted: flags.length === 0, flags, notes, sources, agreeing };
}
