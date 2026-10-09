import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { checkSong, spreadSample, summarize } from '../check-songs.mjs';
import { fixture, mockClient } from './helpers.mjs';

describe('check-songs', () => {
  test('default sample: 30 Hebrew + 30 English spread over the years, like the source test', () => {
    const songs = JSON.parse(readFileSync(new URL('../../../server/data/songs.json', import.meta.url), 'utf8'));
    const s = spreadSample(songs);
    assert.equal(s.length, 60);
    assert.equal(s.filter((x) => x.language === 'he').length, 30);
    assert.equal(s[0].title, 'ערב של שושנים');
    assert.ok(s.some((x) => x.title === 'Proud Mary') && s.some((x) => x.title === 'Sultans of Swing'));
  });

  test('checkSong runs every source and applies the rule (all from fixtures)', async () => {
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
    const r = await checkSong({ id: 28, artist: 'Creedence Clearwater Revival', title: 'Proud Mary', year: 1969, language: 'en' }, { getJson });
    assert.deepEqual(r.rule.sources, { wikipedia: 1969, wikidata: 1969, musicbrainz: 1969, store: 1969 });
    assert.equal(r.rule.accepted, true);
    assert.deepEqual(r.rule.notes, ['unanimous']);
    assert.equal(r.it.trackId, 1440842312);
    assert.equal(r.dz.rank, 800000);
    assert.equal(r.pv.views, 1266000);

    const md = summarize([r]);
    assert.match(md, /\| Wikipedia infobox \| en \| 1\/1 \| 100% \| 100% \| 0 \|/);
    assert.match(md, /\| en \| 1\/1 \| 1\/1 \| 0 \| - \| 1 \|/);
    assert.match(md, /\| en \| 1\/1 \| 1266000 \| 1\/1 \| 1 \| plain 1 \|/);
  });

  test('Hebrew song without a he page: English page by alias, then the hewiki sitelink', async () => {
    const { getJson } = mockClient([
      ['he.wikipedia.org/w/api.php?action=query', { query: { search: [] } }],
      ['en.wikipedia.org/w/api.php?action=query', { query: { search: [{ title: 'Erev Shel Shoshanim', snippet: 'HaDudaim' }] } }],
      ['en.wikipedia.org/w/api.php?action=parse', { parse: { title: 'Erev Shel Shoshanim', wikitext: '{{Infobox song|released=1957}}', properties: { wikibase_item: 'Q2914383' } } }],
      ['Special:EntityData/Q2914383', { entities: { Q2914383: { id: 'Q2914383', claims: {}, sitelinks: { hewiki: { title: 'ערב של שושנים' } } } } }],
      ['he.wikipedia.org/w/api.php?action=parse', fixture('wp-parse-he-erev.json')],
    ]);
    const r = await checkSong({ id: 613, artist: 'הדודאים', artistAliases: ['HaDudaim'], title: 'ערב של שושנים', titleAliases: ['Erev Shel Shoshanim'], year: 1958, language: 'he' }, { getJson });
    assert.equal(r.wp.via, 'en-sitelink');
    assert.equal(r.wp.page, 'ערב של שושנים');
    assert.equal(r.wp.year, 1957);
    assert.ok(r.rule.flags.includes('pre-1970-hebrew'));
  });
});
