// One song through every source: year (Wikipedia, Wikidata, MusicBrainz + year rule),
// iTunes preview and trackId, Wikipedia page views and Deezer rank. Reuses checkSong of
// sources/check-songs.mjs and keeps only what the batch and recheck need (it is stored
// per song in the resume log).
import { checkSong } from '../sources/check-songs.mjs';
import { fetchEntity } from '../sources/wikidata.mjs';
import { norm } from '../sources/normalize.mjs';

const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}&'’!?.,-]+$/u;
export const isLatin = (s) => typeof s === 'string' && /\p{Script=Latin}/u.test(s) && LATIN.test(s);

/** The compact result kept per song. */
export function compact(row) {
  const errors = {};
  for (const k of ['wp', 'wd', 'mb', 'it', 'dz', 'pv']) if (row[k]?.error) errors[k] = row[k].error;
  return {
    years: { wikipedia: row.rule.sources.wikipedia, wikidata: row.rule.sources.wikidata, musicbrainz: row.rule.sources.musicbrainz, store: row.rule.sources.store },
    rule: { year: row.rule.year, accepted: row.rule.accepted, flags: row.rule.flags, notes: row.rule.notes, agreeing: row.rule.agreeing },
    wikipedia: row.wp.found ? { page: row.wp.page, lang: row.wp.lang, qid: row.wp.qid ?? null, field: row.wp.field ?? null } : null,
    itunes: row.it.found ? { trackId: row.it.trackId ?? null, preview: !!row.it.preview, artistName: row.it.artistName, trackName: row.it.trackName, artistMatch: !!row.it.artistMatch } : null,
    pageViews: row.pv.found ? row.pv.views : null,
    deezerRank: row.dz.found && Number.isFinite(row.dz.rank) ? row.dz.rank : null,
    musicbrainzArtist: row.mb.artistName ?? null,
    errors,
  };
}

/**
 * English transliterations for a Hebrew song, when a source gives one:
 *   titleAliases  ← the English label of the song's Wikidata item (cached request: the year lookup fetched it)
 *   artistAliases ← the MusicBrainz artist name, when it is in Latin script
 * TODO: MusicBrainz artist aliases (/ws/2/artist/<mbid>?inc=aliases, one more request per song at
 * 1 per second) and the Wikidata performer (P175) label would give more artist transliterations.
 */
export async function transliterations(song, res, opts = {}) {
  if (song.language !== 'he') return {};
  const out = {};
  const qid = res.wikipedia?.qid;
  if (qid) {
    try {
      const label = (await fetchEntity(qid, opts))?.labels?.en?.value;
      if (isLatin(label) && norm(label) !== norm(song.title)) out.titleAliases = [label];
    } catch {
      // aliases are optional
    }
  }
  if (isLatin(res.musicbrainzArtist) && norm(res.musicbrainzArtist) !== norm(song.artist)) out.artistAliases = [res.musicbrainzArtist];
  return out;
}

/**
 * @param {{artist,title,language,chartYear?,artistAliases?,titleAliases?}} song
 * @param {{ getJson?, aliases?: boolean }} [opts]
 */
export async function lookupSong(song, opts = {}) {
  const res = compact(await checkSong(song, opts));
  if (opts.aliases) res.aliases = await transliterations(song, res, opts);
  return res;
}
