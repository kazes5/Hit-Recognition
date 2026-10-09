// lookupSong: checkSong on recorded responses, compacted for the resume log, plus the
// English transliterations of Hebrew songs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, mockClient } from '../../sources/test/helpers.mjs';
import { isLatin, lookupSong, transliterations } from '../lookup.mjs';

test('lookupSong: compact result of every source (fixtures)', async () => {
  const { getJson } = mockClient([
    ['en.wikipedia.org/w/api.php?action=query', fixture('wp-search-proud-mary.json')],
    ['en.wikipedia.org/w/api.php?action=parse', fixture('wp-parse-proud-mary.json')],
    ['Special:EntityData/Q1543879', fixture('wd-entity.json')],
    ['musicbrainz.org/ws/2/artist', fixture('mb-artist.json')],
    ['musicbrainz.org/ws/2/recording', fixture('mb-recordings.json')],
    ['itunes.apple.com', fixture('itunes-search.json')],
    ['api.deezer.com', { data: [{ id: 9, title: 'Proud Mary', rank: 800000, preview: 'p', artist: { name: 'Creedence Clearwater Revival' } }] }],
    ['per-article/en.wikipedia', fixture('pageviews.json')],
  ]);
  const r = await lookupSong({ artist: 'Creedence Clearwater Revival', title: 'Proud Mary', language: 'en', chartYear: 1969 }, { getJson, aliases: true });
  assert.deepEqual(r.years, { wikipedia: 1969, wikidata: 1969, musicbrainz: 1969, store: 1969 });
  assert.equal(r.rule.accepted, true);
  assert.equal(r.rule.year, 1969);
  assert.deepEqual(r.itunes.trackId, 1440842312);
  assert.equal(r.itunes.preview, true);
  assert.equal(r.pageViews, 1266000);
  assert.equal(r.deezerRank, 800000);
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.aliases, {}, 'English songs get no transliteration');
  assert.ok(JSON.stringify(r).length < 1500, 'small enough for one progress line');
});

test('lookupSong: failures are kept as errors (not cached as done by the batch)', async () => {
  const { getJson } = mockClient([[/./, () => new Response('', { status: 500 })]]);
  const r = await lookupSong({ artist: 'X', title: 'Y', language: 'en' }, { getJson });
  assert.equal(r.rule.accepted, false);
  assert.equal(r.itunes, null);
  assert.ok(Object.keys(r.errors).length > 0);
});

test('transliterations: English Wikidata label → titleAliases; Latin MusicBrainz name → artistAliases', async () => {
  const { getJson } = mockClient([['Special:EntityData/Q5', { entities: { Q5: { id: 'Q5', labels: { en: { value: 'Nigmar' } } } } }]]);
  const song = { artist: 'עידן עמדי', title: 'נגמר', language: 'he' };
  const a = await transliterations(song, { wikipedia: { qid: 'Q5' }, musicbrainzArtist: 'Idan Amedi' }, { getJson });
  assert.deepEqual(a, { titleAliases: ['Nigmar'], artistAliases: ['Idan Amedi'] });
  // Hebrew labels/names are not transliterations; English songs get none.
  const b = await transliterations(song, { wikipedia: null, musicbrainzArtist: 'עידן עמדי' }, { getJson });
  assert.deepEqual(b, {});
  assert.deepEqual(await transliterations({ ...song, language: 'en' }, { musicbrainzArtist: 'X' }, { getJson }), {});
});

test('isLatin', () => {
  assert.ok(isLatin("Don't Stop Me Now!"));
  assert.ok(isLatin('Beyoncé & Jay-Z'));
  assert.ok(!isLatin('נגמר'));
  assert.ok(!isLatin('Shir נגמר'));
  assert.ok(!isLatin(''));
  assert.ok(!isLatin(null));
});
