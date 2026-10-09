// iTunes Search API: preview check, trackId and store year (the store year is an upper bound only:
// stores date the edition they sell). About 20 requests per minute (http.mjs), retry on 429.
//   https://itunes.apple.com/search?term=...&entity=song&limit=25&country=IL
//   → { resultCount, results: [ { wrapperType: "track", kind: "song", trackId, artistName, trackName,
//        collectionName, previewUrl, releaseDate: "1969-01-06T08:00:00Z", primaryGenreName, country } ] }
import { errorText, getJson as defaultGetJson } from './http.mjs';
import { artistMatches, titleMatch } from './normalize.mjs';

export const countryFor = (language) => (language === 'he' ? 'IL' : 'US');

/**
 * Pick the best track of a search response for a song.
 * Title must match (exact before prefix); the performer should match one of our names.
 * @returns {null | { trackId, previewUrl, preview, year, artistName, trackName, collectionName, genre, artistMatch }}
 */
export function pickTrack(json, song) {
  const titles = [song.title, ...(song.titleAliases ?? [])];
  const artists = [song.artist, ...(song.artistAliases ?? [])];
  const hits = (json?.results ?? [])
    .filter((r) => (r.kind ?? 'song') === 'song')
    .map((r) => ({ r, tm: Math.max(0, ...titles.map((t) => titleMatch(r.trackName, t))), am: artistMatches(r.artistName, artists) }))
    .filter((h) => h.tm > 0);
  if (!hits.length) return null;
  const pool = hits.some((h) => h.am) ? hits.filter((h) => h.am) : hits;
  const years = pool.map((h) => Number(String(h.r.releaseDate ?? '').slice(0, 4))).filter((y) => y >= 1900);
  const best = [...pool].sort((a, b) => b.tm - a.tm || Number(!!b.r.previewUrl) - Number(!!a.r.previewUrl))[0];
  return {
    trackId: best.r.trackId,
    previewUrl: best.r.previewUrl ?? null,
    preview: !!best.r.previewUrl,
    year: years.length ? Math.min(...years) : null,
    artistName: best.r.artistName,
    trackName: best.r.trackName,
    collectionName: best.r.collectionName,
    genre: best.r.primaryGenreName,
    artistMatch: best.am,
  };
}

export function searchUrl(term, country, limit = 25) {
  return `https://itunes.apple.com/search?entity=song&limit=${limit}&country=${country}&term=${encodeURIComponent(term)}`;
}

/**
 * Preview + trackId + store year. Tries "artist title", then the first alias. Never throws.
 * @returns {Promise<{found:boolean, country:string, error?:string} & Partial<ReturnType<typeof pickTrack>>>}
 */
export async function itunesTrack(song, { getJson = defaultGetJson } = {}) {
  const country = countryFor(song.language);
  const terms = [`${song.artist} ${song.title}`];
  if (song.artistAliases?.[0]) terms.push(`${song.artistAliases[0]} ${song.title}`);
  let fallback = null;
  try {
    for (const term of terms) {
      const t = pickTrack(await getJson(searchUrl(term, country)), song);
      if (t?.artistMatch) return { found: true, country, ...t };
      fallback ??= t;
    }
  } catch (e) {
    if (!fallback) return { found: false, country, error: errorText(e) };
  }
  return fallback ? { found: true, country, ...fallback } : { found: false, country };
}
