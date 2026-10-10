// MusicBrainz web service (JSON, Lucene search). 1 request per 1.1 s (http.mjs), retry on 503.
//   artist:    /ws/2/artist?fmt=json&limit=5&query=artist:"X" OR alias:"X"
//              → { count, artists: [ { id, name, "sort-name", score: 100, aliases?: [ { name } ] } ] }
//   recording: /ws/2/recording?fmt=json&limit=100&query=arid:<mbid> AND recording:"T"
//              → { count, recordings: [ { id, title, disambiguation?, "first-release-date": "1969-01", video?, score } ] }
import { errorText, getJson as defaultGetJson } from './http.mjs';
import { titleMatch } from './normalize.mjs';

const WS = 'https://musicbrainz.org/ws/2';
export const MIN_ARTIST_SCORE = 90;
/** Versions that are not the original release. */
export const SKIP_VERSION = /\b(live|remix(ed)?|demo|karaoke|instrumental|version|acoustic|re-?recorded|rehearsal|mix)\b|הופעה|הקלטה חיה|\(חי\)|רמיקס|גרסה|קריוקי|אינסטרומנטלי|דמו/i;

/** Escape a phrase for a quoted Lucene term. */
export const lucenePhrase = (s) => `"${String(s).replace(/[\\"]/g, '\\$&')}"`;

/** Artists with score ≥ 90, best first. */
export function goodArtists(json, minScore = MIN_ARTIST_SCORE) {
  return (json?.artists ?? []).filter((a) => Number(a.score ?? 0) >= minScore);
}

/**
 * Earliest first-release year among recordings whose title matches one of `titles`.
 * Live/remix/demo/karaoke/instrumental/"version" recordings are skipped (by disambiguation
 * or a parenthesis in the title). Exact title matches win over prefix matches.
 */
export function earliestRecordingYear(json, titles) {
  const exact = [];
  const prefix = [];
  for (const rec of json?.recordings ?? []) {
    const tm = Math.max(0, ...titles.filter(Boolean).map((t) => titleMatch(rec.title, t)));
    if (!tm) continue;
    if (rec.video) continue;
    if (SKIP_VERSION.test(rec.disambiguation ?? '')) continue;
    const paren = (String(rec.title).match(/\(([^)]*)\)|\[([^\]]*)\]/g) ?? []).join(' ');
    if (paren && SKIP_VERSION.test(paren)) continue;
    const y = Number(String(rec['first-release-date'] ?? '').slice(0, 4));
    if (!(y >= 1900)) continue;
    (tm === 2 ? exact : prefix).push(y);
  }
  const ys = exact.length ? exact : prefix;
  return ys.length ? Math.min(...ys) : null;
}

export async function searchArtists(name, { getJson = defaultGetJson } = {}) {
  const q = `artist:${lucenePhrase(name)} OR alias:${lucenePhrase(name)}`;
  return goodArtists(await getJson(`${WS}/artist?fmt=json&limit=5&query=${encodeURIComponent(q)}`));
}

export async function searchRecordings(arid, title, { getJson = defaultGetJson } = {}) {
  const q = `arid:${arid} AND recording:${lucenePhrase(title)}`;
  return getJson(`${WS}/recording?fmt=json&limit=100&query=${encodeURIComponent(q)}`);
}

/**
 * Artist MBID (Hebrew name first, then the aliases; score ≥ 90), then the earliest
 * first-release-date among that artist's matching recordings. Never throws.
 * @returns {Promise<{found:boolean, year?:number, arid?:string, artistName?:string, note?:string, error?:string}>}
 */
export async function musicbrainzYear(song, { getJson = defaultGetJson, maxNames = 4, maxTitles = 3 } = {}) {
  const names = [...new Set([song.artist, ...(song.artistAliases ?? [])].filter(Boolean))].slice(0, maxNames);
  const titles = [...new Set([song.title, ...(song.titleAliases ?? [])].filter(Boolean))].slice(0, maxTitles);
  const tried = new Set();
  let anyArtist = false;
  try {
    for (const name of names) {
      const artists = (await searchArtists(name, { getJson })).slice(0, 2);
      for (const a of artists) {
        if (tried.has(a.id)) continue;
        tried.add(a.id);
        anyArtist = true;
        for (const t of titles) {
          const year = earliestRecordingYear(await searchRecordings(a.id, t, { getJson }), titles);
          if (year) return { found: true, year, arid: a.id, artistName: a.name };
        }
      }
    }
  } catch (e) {
    return { found: false, error: errorText(e) };
  }
  return { found: false, note: anyArtist ? 'artist found, song not' : 'artist not found' };
}
