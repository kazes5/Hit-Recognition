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
//
// With a chart year (batches), three extra rules settle more songs (batch 1 review, owner-approved):
//   - Off-song years are ignored: Wikipedia and Wikidata when the Wikipedia page is another
//     performer's song ("… (שיר של X)" / "… (X song)"), and any trusted year after chartYear + 1
//     (a song cannot come out after it charted; +1 allows for the Hebrew-calendar chart year).
//   - Chart window: with no two trusted sources agreeing, a year that is the chart year or the
//     year before is accepted when a trusted source gives it and the store year is not earlier.
//     When both window years are given, the one more sources give wins; a tie stays 'disagree'.
//   - A Hebrew song before 1970 is accepted only when two trusted sources agree on the chart year.
// Notes (informational, not blocking):
//   'unanimous'        all three trusted sources give the same year (D8: automatic fix of the catalog)
//   'store-earlier'    the store year is earlier than the accepted year (store is an upper bound)
//   'chart-window'     accepted by the chart-window rule
//   'other-song-page'  Wikipedia/Wikidata ignored: the page is another performer's song
//   'after-chart'      a trusted year after chartYear + 1 was ignored
export const TRUSTED = ['wikipedia', 'wikidata', 'musicbrainz'];

/**
 * @param {{ wikipedia?: number|null, wikidata?: number|null, musicbrainz?: number|null, store?: number|null }} years
 * @param {{ language?: 'he'|'en', chartYear?: number|null }} [ctx]
 * @returns {{ year: number|null, accepted: boolean, flags: string[], notes: string[], sources: object, agreeing: string[] }}
 */
export function applyYearRule(years, { language, chartYear = null, wikipediaPage = null, artist = null } = {}) {
  const sources = {};
  for (const k of [...TRUSTED, 'store']) {
    const v = years?.[k];
    sources[k] = Number.isInteger(v) ? v : null;
  }
  const flags = [];
  const notes = [];
  const hasChart = Number.isInteger(chartYear);

  // Years that belong to another song are left out of the vote (sources keeps them for the report).
  const usable = { ...sources };
  if (hasChart && otherPerformersPage(wikipediaPage, artist)) {
    if (usable.wikipedia !== null || usable.wikidata !== null) notes.push('other-song-page');
    usable.wikipedia = null;
    usable.wikidata = null;
  }
  if (hasChart) {
    for (const k of TRUSTED) {
      if (usable[k] !== null && usable[k] > chartYear + 1) {
        usable[k] = null;
        if (!notes.includes('after-chart')) notes.push('after-chart');
      }
    }
  }
  const trusted = TRUSTED.filter((k) => usable[k] !== null);
  let year = null;
  let agreeing = [];

  const counts = new Map();
  for (const k of trusted) counts.set(usable[k], [...(counts.get(usable[k]) ?? []), k]);
  const agreed = [...counts.entries()].find(([, ks]) => ks.length >= 2);
  const inWindow = (y) => hasChart && (y === chartYear || y === chartYear - 1);
  const windowPick = () => {
    const ys = [...counts.entries()].filter(([y]) => inWindow(y)).sort((a, b) => b[1].length - a[1].length);
    if (!ys.length || (ys.length > 1 && ys[0][1].length === ys[1][1].length)) return null;
    const [y, ks] = ys[0];
    return sources.store !== null && sources.store < y ? null : [y, ks];
  };

  if (agreed) {
    year = agreed[0];
    agreeing = agreed[1];
    if (agreeing.length === 3) notes.push('unanimous');
  } else if (trusted.length) {
    const pick = windowPick();
    if (pick) {
      [year, agreeing] = pick;
      notes.push('chart-window');
    } else {
      year = Math.min(...trusted.map((k) => usable[k])); // proposal for the reviewer
      flags.push('disagree');
    }
  } else if (sources.store !== null) {
    year = sources.store;
    flags.push('store-only');
  } else {
    flags.push('none');
  }

  const chartConfirmsEarlyHebrew = agreed && hasChart && year === chartYear;
  if (language === 'he' && year !== null && year < 1970 && !chartConfirmsEarlyHebrew) flags.push('pre-1970-hebrew');
  if (year !== null && hasChart && !(year <= chartYear && year >= chartYear - 2)) flags.push('chart-range');
  if (agreed && sources.store !== null && sources.store < year) notes.push('store-earlier');

  return { year, accepted: flags.length === 0, flags, notes, sources, agreeing };
}

const loose = (s) => String(s ?? '').toLowerCase().replace(/[׳'"״`]/g, '').replace(/\s+/g, ' ').trim();

/**
 * True when a Wikipedia page title names another performer's song: "שמח (שיר של עברי לידר)"
 * for פינג פונג, "Alone (i-Ten song)" for Heart. A page that names this performer, or no
 * performer, is fine.
 */
export function otherPerformersPage(page, artist) {
  if (!page || !artist) return false;
  const m = String(page).match(/\((?:שיר|סינגל)\s+של\s+([^)]+)\)\s*$/) ?? String(page).match(/\(([^)]+?)\s+song\)\s*$/i);
  if (!m) return false;
  const who = loose(m[1]);
  const credit = loose(artist);
  return !(credit.includes(who) || who.includes(credit));
}
