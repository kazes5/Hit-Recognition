// Deezer public search: popularity `rank` (task 3.9) and a preview. No key.
//   https://api.deezer.com/search?q=...&limit=25
//   → { data: [ { id, title, title_short, title_version, rank, preview: "https://cdnt-preview.dzcdn.net/…",
//        artist: { id, name }, album: { id, title } } ], total, next? }
//   Errors come back as HTTP 200: { error: { type, message, code } }
//   (code 4 = quota exceeded, 700 = service busy → retry; 800 = no data → empty result).
//
// Source-test bug: English found 0 of 30. The POC sent only the advanced form
// artist:"…" track:"…" (with artistAliases[0] when present, i.e. a Latin transliteration
// for Hebrew songs) and fell back to a plain query only for Hebrew, and it returned early
// on any `error` body. Here every song tries, in order:
//   1. plain   "<artist> <title>"           (the form that found the Hebrew songs)
//   2. advanced artist:"<artist>" track:"<title>"  (documented Deezer syntax; kept as a second chance)
//   3. plain   "<alias> <title>" for the first artist alias / title alias
// and accepts a hit only when the title matches and (when any hit's artist matches) the artist matches.
// An error body other than quota/busy counts as "no results" for that query, not as a failure.
import { errorText, getJson as defaultGetJson } from './http.mjs';
import { artistMatches, titleMatch } from './normalize.mjs';

const RETRY_CODES = new Set([4, 700]);
export const deezerRetryIf = (body) => RETRY_CODES.has(Number(body?.error?.code));

export const advancedQuery = (artist, title) => `artist:"${String(artist).replace(/"/g, '')}" track:"${String(title).replace(/"/g, '')}"`;
export const plainQuery = (artist, title) => `${artist} ${title}`.replace(/"/g, '');

export function searchUrl(q, limit = 25) {
  return `https://api.deezer.com/search?limit=${limit}&q=${encodeURIComponent(q)}`;
}

/** The queries tried for a song, in order: [{ via, q }]. */
export function queriesFor(song) {
  const out = [
    { via: 'plain', q: plainQuery(song.artist, song.title) },
    { via: 'advanced', q: advancedQuery(song.artist, song.title) },
  ];
  const alias = song.artistAliases?.[0];
  const tAlias = song.titleAliases?.[0];
  if (alias) out.push({ via: 'plain-alias', q: plainQuery(alias, song.title) });
  if (alias && tAlias) out.push({ via: 'plain-alias-title', q: plainQuery(alias, tAlias) });
  return out;
}

/** Best hit of a search response, or null. */
export function pickHit(json, song) {
  const titles = [song.title, ...(song.titleAliases ?? [])];
  const artists = [song.artist, ...(song.artistAliases ?? [])];
  const hits = (json?.data ?? [])
    .map((x) => ({ x, tm: Math.max(0, ...titles.map((t) => Math.max(titleMatch(x.title, t), titleMatch(x.title_short ?? '', t)))), am: artistMatches(x.artist?.name, artists) }))
    .filter((h) => h.tm > 0);
  if (!hits.length) return null;
  const pool = hits.some((h) => h.am) ? hits.filter((h) => h.am) : hits;
  // Highest rank among the matching hits: the popular recording is the one players know.
  const best = [...pool].sort((a, b) => b.tm - a.tm || (b.x.rank ?? 0) - (a.x.rank ?? 0))[0];
  return { id: best.x.id, rank: best.x.rank ?? null, preview: !!best.x.preview, previewUrl: best.x.preview || null, artistName: best.x.artist?.name, title: best.x.title, artistMatch: best.am };
}

/** Rank + preview for a song. Never throws. → { found, via?, rank?, preview?, … , error? } */
export async function deezerTrack(song, { getJson = defaultGetJson } = {}) {
  let fallback = null;
  let lastError = null;
  for (const { via, q } of queriesFor(song)) {
    let json;
    try {
      json = await getJson(searchUrl(q), { retryIf: deezerRetryIf, cacheIf: (b) => !deezerRetryIf(b) });
    } catch (e) {
      lastError = errorText(e);
      continue;
    }
    const hit = pickHit(json, song); // an { error } body has no data → null
    if (hit?.artistMatch) return { found: true, via, ...hit };
    if (hit && !fallback) fallback = { found: true, via, ...hit };
  }
  if (fallback) return fallback;
  return lastError ? { found: false, error: lastError } : { found: false };
}
