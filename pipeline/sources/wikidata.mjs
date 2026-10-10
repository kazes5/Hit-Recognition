// Wikidata through Special:EntityData.
//   https://www.wikidata.org/wiki/Special:EntityData/Q123.json
//   → { entities: { Q123: { id, labels, claims: { P577: [ { rank, mainsnak: { snaktype: "value",
//        datavalue: { value: { time: "+1969-01-06T00:00:00Z", precision: 11 } } } } ] },
//        sitelinks: { enwiki: { site, title }, hewiki: { site, title } } } } }
// A redirected QID comes back under its target id, so the first entity is used.
import { errorText, getJson as defaultGetJson } from './http.mjs';

const entityUrl = (qid) => `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;

/** The entity of an EntityData response (handles redirects). */
export function entityOf(json, qid) {
  const ents = json?.entities ?? {};
  return ents[qid] ?? Object.values(ents)[0] ?? null;
}

/** Earliest publication year (P577) of an entity; deprecated claims and years before 1900 are skipped. */
export function earliestP577(entity) {
  const claims = entity?.claims?.P577 ?? [];
  const ys = claims
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value')
    .map((c) => String(c.mainsnak?.datavalue?.value?.time ?? '').match(/^\+?(\d{4})-/))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1900);
  return ys.length ? Math.min(...ys) : null;
}

/** { enwiki: "Title", hewiki: "כותרת", … } */
export function sitelinkTitles(entity) {
  return Object.fromEntries(Object.entries(entity?.sitelinks ?? {}).map(([k, v]) => [k, v?.title]).filter(([, t]) => t));
}

export async function fetchEntity(qid, { getJson = defaultGetJson } = {}) {
  return entityOf(await getJson(entityUrl(qid)), qid);
}

/** Earliest P577 year for a QID. Never throws. → { found, year, error? } */
export async function wikidataYear(qid, opts = {}) {
  if (!qid) return { found: false };
  try {
    const e = await fetchEntity(qid, opts);
    if (!e) return { found: false };
    return { found: true, qid: e.id ?? qid, year: earliestP577(e) };
  } catch (e) {
    return { found: false, error: errorText(e) };
  }
}

/** Sitelink titles of a QID (empty object on failure). */
export async function sitelinks(qid, opts = {}) {
  try {
    return sitelinkTitles(await fetchEntity(qid, opts));
  } catch {
    return {};
  }
}
