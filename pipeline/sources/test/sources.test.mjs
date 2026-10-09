// Wikidata, MusicBrainz, iTunes, Deezer and page views adapters on recorded-shape fixtures.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { advancedQuery, deezerTrack, pickHit, queriesFor } from '../deezer.mjs';
import { countryFor, itunesTrack, pickTrack } from '../itunes.mjs';
import { earliestRecordingYear, goodArtists, lucenePhrase, musicbrainzYear } from '../musicbrainz.mjs';
import { last12Months, pageviews12m, pageviewsUrl, sumViews } from '../pageviews.mjs';
import { earliestP577, entityOf, sitelinkTitles, sitelinks, wikidataYear } from '../wikidata.mjs';
import { fixture, jsonResponse, mockClient } from './helpers.mjs';

const CCR = { artist: 'Creedence Clearwater Revival', title: 'Proud Mary', language: 'en', year: 1969 };
const OASIS = { artist: 'Oasis', title: 'Wonderwall', language: 'en', year: 1995 };

describe('wikidata', () => {
  const json = fixture('wd-entity.json');
  test('earliest non-deprecated P577 value', () => {
    assert.equal(earliestP577(entityOf(json, 'Q1543879')), 1969);
    assert.equal(earliestP577({ claims: {} }), null);
  });
  test('redirected QID: the first entity is used', () => {
    assert.equal(entityOf(json, 'Q1').id, 'Q1543879');
  });
  test('sitelink titles', () => {
    assert.deepEqual(sitelinkTitles(entityOf(json, 'Q1543879')), { enwiki: 'Proud Mary', hewiki: 'פראוד מרי' });
  });
  test('network: Special:EntityData', async () => {
    const { getJson, fetch } = mockClient([['Special:EntityData/Q1543879.json', json]]);
    assert.deepEqual(await wikidataYear('Q1543879', { getJson }), { found: true, qid: 'Q1543879', year: 1969 });
    assert.equal((await sitelinks('Q1543879', { getJson })).hewiki, 'פראוד מרי');
    assert.equal(fetch.calls[0], 'https://www.wikidata.org/wiki/Special:EntityData/Q1543879.json');
    assert.deepEqual(await wikidataYear(null, { getJson }), { found: false });
    assert.deepEqual(await wikidataYear('Q404', { getJson }), { found: false, error: 'HTTP 404' });
  });
});

describe('musicbrainz', () => {
  test('artists with score ≥ 90 only', () => {
    assert.deepEqual(goodArtists(fixture('mb-artist.json')).map((a) => a.name), ['Creedence Clearwater Revival']);
  });
  test('earliest first-release-date, skipping live / remix / demo and prefix-only titles', () => {
    assert.equal(earliestRecordingYear(fixture('mb-recordings.json'), ['Proud Mary']), 1969);
  });
  test('prefix matches are used only when there is no exact match; karaoke/instrumental/version skipped', () => {
    const json = { recordings: [
      { title: 'Proud Mary Medley', 'first-release-date': '1965' },
      { title: 'Proud', 'first-release-date': '1960', disambiguation: 'karaoke' },
      { title: 'Proud', 'first-release-date': '1961', disambiguation: 'instrumental' },
      { title: 'Proud', 'first-release-date': '1962', disambiguation: 'single version' },
    ] };
    assert.equal(earliestRecordingYear(json, ['Proud Mary']), 1965);
    assert.equal(earliestRecordingYear(json, ['Proud']), 1965, 'all exact "Proud" recordings are skipped versions');
    assert.equal(earliestRecordingYear({ recordings: json.recordings.slice(1) }, ['Proud']), null);
  });
  test('Lucene phrases are escaped', () => {
    assert.equal(lucenePhrase('He said "hi"'), '"He said \\"hi\\""');
  });
  test('network: Hebrew name first, then aliases; arid query', async () => {
    const song = { artist: 'הדודאים', artistAliases: ['HaDudaim', 'The Dudaim'], title: 'ערב של שושנים', titleAliases: ['Erev Shel Shoshanim'], language: 'he' };
    const { getJson, fetch } = mockClient([
      ['alias:"הדודאים"', { artists: [] }],
      ['alias:"HaDudaim"', { artists: [{ id: 'dud-1', name: 'HaDudaim', score: 100 }] }],
      ['arid:dud-1 AND recording:"ערב של שושנים"', { recordings: [] }],
      ['arid:dud-1 AND recording:"Erev Shel Shoshanim"', { recordings: [{ title: 'Erev Shel Shoshanim', 'first-release-date': '1958-01' }, { title: 'ערב של שושנים (הופעה חיה)', 'first-release-date': '1957' }] }],
    ]);
    assert.deepEqual(await musicbrainzYear(song, { getJson }), { found: true, year: 1958, arid: 'dud-1', artistName: 'HaDudaim' });
    assert.ok(fetch.calls.every((u) => u.startsWith('https://musicbrainz.org/ws/2/') && u.includes('fmt=json')));
  });
  test('network: notes when the artist or the song is missing', async () => {
    const none = mockClient([['/artist?', { artists: [{ id: 'x', name: 'X', score: 50 }] }]]);
    assert.deepEqual(await musicbrainzYear(CCR, { getJson: none.getJson }), { found: false, note: 'artist not found' });
    const noSong = mockClient([['/artist?', fixture('mb-artist.json')], ['/recording?', { recordings: [] }]]);
    assert.deepEqual(await musicbrainzYear(CCR, { getJson: noSong.getJson }), { found: false, note: 'artist found, song not' });
    const down = mockClient([['/artist?', () => new Response('', { status: 503 })]]);
    assert.deepEqual(await musicbrainzYear(CCR, { getJson: down.getJson }), { found: false, error: 'HTTP 503' });
  });
});

describe('itunes', () => {
  test('country IL for Hebrew, US for English', () => {
    assert.equal(countryFor('he'), 'IL');
    assert.equal(countryFor('en'), 'US');
  });
  test('picks the performer\'s track with a preview; store year = earliest matching edition; videos ignored', () => {
    const t = pickTrack(fixture('itunes-search.json'), CCR);
    assert.equal(t.trackId, 1440842312);
    assert.equal(t.preview, true);
    assert.equal(t.year, 1969, 'earliest store date among the performer\'s matching tracks');
    assert.equal(t.artistMatch, true);
  });
  test('network: country and term in the URL', async () => {
    const { getJson, fetch } = mockClient([['itunes.apple.com/search', fixture('itunes-search.json')]]);
    const r = await itunesTrack(CCR, { getJson });
    assert.equal(r.found, true);
    assert.equal(r.country, 'US');
    assert.ok(fetch.calls[0].includes('country=US') && fetch.calls[0].includes('term=Creedence Clearwater Revival Proud Mary'));
    const he = mockClient([['itunes.apple.com/search', { resultCount: 0, results: [] }]]);
    const r2 = await itunesTrack({ artist: 'עידן עמדי', artistAliases: ['Idan Amedi'], title: 'נגמר', language: 'he' }, { getJson: he.getJson });
    assert.deepEqual(r2, { found: false, country: 'IL' });
    assert.equal(he.fetch.calls.length, 2, 'Hebrew name, then the first alias');
    assert.ok(he.fetch.calls[1].includes('term=Idan Amedi נגמר'));
  });
  test('network: 429 is retried', async () => {
    let n = 0;
    const { getJson } = mockClient([['itunes.apple.com', () => (n++ === 0 ? jsonResponse({}, 429) : fixture('itunes-search.json'))]]);
    assert.equal((await itunesTrack(CCR, { getJson })).trackId, 1440842312);
  });
});

describe('deezer (fix for 0 of 30 English)', () => {
  test('plain query first, advanced syntax second, aliases after', () => {
    assert.deepEqual(queriesFor(OASIS).map((q) => q.q), ['Oasis Wonderwall', 'artist:"Oasis" track:"Wonderwall"']);
    const he = queriesFor({ artist: 'עידן עמדי', artistAliases: ['Idan Amedi'], title: 'נגמר', titleAliases: ['Nigmar'] });
    assert.deepEqual(he.map((q) => q.via), ['plain', 'advanced', 'plain-alias', 'plain-alias-title']);
    assert.equal(advancedQuery('A "B"', 'C'), 'artist:"A B" track:"C"');
  });
  test('the performer\'s best-ranked matching track wins over a more popular cover', () => {
    const h = pickHit(fixture('deezer-search.json'), OASIS);
    assert.equal(h.id, 1);
    assert.equal(h.rank, 902345);
    assert.equal(h.preview, true);
  });
  test('network: the advanced query returning nothing no longer loses the song', async () => {
    const { getJson, fetch } = mockClient([
      [/q=artist:/, fixture('deezer-empty.json')],
      ['q=Oasis Wonderwall', fixture('deezer-search.json')],
    ]);
    const r = await deezerTrack(OASIS, { getJson });
    assert.equal(r.found, true);
    assert.equal(r.via, 'plain');
    assert.equal(fetch.calls.length, 1);
  });
  test('network: an error body ("no data") counts as empty and the next query is tried', async () => {
    const { getJson } = mockClient([
      ['q=Oasis Wonderwall', fixture('deezer-error-nodata.json')],
      [/q=artist:/, fixture('deezer-search.json')],
    ]);
    const r = await deezerTrack(OASIS, { getJson });
    assert.equal(r.found, true);
    assert.equal(r.via, 'advanced');
  });
  test('network: a quota error is retried', async () => {
    let n = 0;
    const { getJson } = mockClient([['api.deezer.com', () => (n++ === 0 ? fixture('deezer-error-quota.json') : fixture('deezer-search.json'))]]);
    assert.equal((await deezerTrack(OASIS, { getJson })).found, true);
    assert.equal(n, 2);
  });
  test('network: nothing anywhere → not found', async () => {
    const { getJson } = mockClient([['api.deezer.com', fixture('deezer-empty.json')]]);
    assert.deepEqual(await deezerTrack(OASIS, { getJson }), { found: false });
  });
});

describe('pageviews', () => {
  test('last 12 complete months', () => {
    assert.deepEqual(last12Months(new Date(Date.UTC(2026, 9, 9))), { start: '2025100100', end: '2026093000' });
    assert.deepEqual(last12Months(new Date(Date.UTC(2026, 0, 15))), { start: '2025010100', end: '2025123100' });
  });
  test('URL: per-article, monthly, user agent, title with underscores and encoded', () => {
    const u = pageviewsUrl('he', 'נגמר (שיר)', { start: '2025100100', end: '2026093000' });
    assert.equal(decodeURIComponent(u), 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/he.wikipedia/all-access/user/נגמר_(שיר)/monthly/2025100100/2026093000');
    assert.ok(pageviewsUrl('en', 'AC/DC').includes('AC%2FDC'));
  });
  test('sums monthly views', () => {
    assert.equal(sumViews(fixture('pageviews.json')), 12 * 100000 + 66 * 1000);
  });
  test('network: total, and 404 → 0 views', async () => {
    const today = new Date(Date.UTC(2026, 9, 9));
    const { getJson } = mockClient([['Wonderwall_(song)', fixture('pageviews.json')]]);
    const r = await pageviews12m('en', 'Wonderwall (song)', { getJson, today });
    assert.equal(r.views, 1266000);
    assert.equal(r.months, 12);
    const r2 = await pageviews12m('en', 'Nothing here', { getJson, today });
    assert.equal(r2.views, 0);
    assert.equal(r2.found, true);
  });
});
