import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  IGNORED_FIELDS,
  RELEASE_FIELDS,
  findSongPage,
  lookupWikipedia,
  pageFromParse,
  parseTemplates,
  rankSearchHits,
  songYear,
  wikibaseItem,
  yearFromCategory,
  yearFromReleaseValue,
} from '../wikipedia.mjs';
import { fixture, mockClient } from './helpers.mjs';

describe('wikitext templates', () => {
  test('nested templates and links do not split parameters', () => {
    const [t] = parseTemplates('{{Infobox song | a = {{x|1|2}} | b = [[Link|text]] | c = 3 }}');
    assert.equal(t.name, 'Infobox song');
    assert.deepEqual(t.params, [['a', '{{x|1|2}}'], ['b', '[[Link|text]]'], ['c', '3']]);
  });
  test('comments and <ref> are removed before parsing', () => {
    const [t] = parseTemplates('{{X|released=1978<ref name="a">{{cite|access-date=2015}}</ref><!-- 1999 -->|z=1}}');
    assert.deepEqual(t.params, [['released', '1978'], ['z', '1']]);
  });
  test('"תבנית:" prefix is dropped from the name', () => {
    assert.equal(parseTemplates('{{תבנית:סינגל|יצא לאור=1990}}')[0].name, 'סינגל');
  });
});

describe('release value', () => {
  test('earliest year, re-release segments ignored', () => {
    assert.equal(yearFromReleaseValue('{{Start date|1978|05|19}} (original)<br />January 1979 (re-release)'), 1978);
    assert.equal(yearFromReleaseValue('1988 (re-issue)<br>1979'), 1979);
    assert.equal(yearFromReleaseValue('2014 (גרסה מחודשת)<br />אוקטובר 2012'), 2012);
    assert.equal(yearFromReleaseValue('November 1965 (UK)<br>December 1965 (US)'), 1965);
    assert.equal(yearFromReleaseValue('—'), null);
  });
});

describe('songYear', () => {
  test('Proud Mary: reads "released" (1969), not "recorded" (1968) — source-test bug 1', () => {
    const page = pageFromParse(fixture('wp-parse-proud-mary.json'));
    assert.deepEqual(songYear(page), { year: 1969, field: 'released', template: 'Infobox song', infoboxKeys: [] });
  });
  test('Sultans of Swing: original 1978, not the 1979 re-release or the 1988 re-issue infobox — source-test bug 2', () => {
    const y = songYear(pageFromParse(fixture('wp-parse-sultans.json')));
    assert.equal(y.year, 1978);
    assert.equal(y.field, 'released');
  });
  test('Hebrew {{סינגל}}: "יצא לאור", ignoring "הוקלט" and the access date in a ref', () => {
    const y = songYear(pageFromParse(fixture('wp-parse-he-erev.json')));
    assert.equal(y.year, 1957);
    assert.equal(y.field, 'יצא לאור');
    assert.equal(y.template, 'סינגל');
  });
  test('Hebrew {{שיר}}: "תאריך יציאה" with a ref and a re-release segment', () => {
    const y = songYear(pageFromParse(fixture('wp-parse-he-nigmar.json')));
    assert.equal(y.year, 2012);
    assert.equal(y.field, 'תאריך יציאה');
  });
  test('no infobox: falls back to the "<year> songs" category, not a small chart template', () => {
    const y = songYear(pageFromParse(fixture('wp-parse-he-category.json')));
    assert.equal(y.year, 1974);
    assert.equal(y.field, 'category:שירים משנת 1974');
  });
  test('recorded/הוקלט only → no year, and the infobox keys are reported', () => {
    const y = songYear('{{Infobox song|name=X|artist=Y|recorded=1970|genre=Rock}}\n{{סינגל|שם=X|אמן=Y|הוקלט=1960|סוגה=פופ}}');
    assert.equal(y.year, null);
    assert.ok(y.infoboxKeys.includes('Infobox song.recorded'));
    assert.ok(y.infoboxKeys.includes('סינגל.הוקלט'));
  });
  test('field names: underscores and case do not matter; the release lists exclude ignored fields', () => {
    assert.equal(songYear('{{Infobox single|Name=X|Release_Date=1983}}').year, 1983);
    for (const f of IGNORED_FIELDS) {
      assert.ok(!RELEASE_FIELDS.en.includes(f) && !RELEASE_FIELDS.he.includes(f), f);
    }
    for (const f of ['יצא לאור', 'תאריך יציאה', 'הוצאה']) assert.ok(RELEASE_FIELDS.he.includes(f));
    for (const f of ['released', 'release date']) assert.ok(RELEASE_FIELDS.en.includes(f));
  });
  test('"שנה" counts only in an infobox-sized template', () => {
    assert.equal(songYear('{{מצעד|מקום=1|שנה=1974}}').year, null);
    assert.equal(songYear('{{שיר|שם=א|מבצע=ב|לחן=ג|שנה=1974}}').year, 1974);
  });
});

describe('categories', () => {
  test('year categories in English and Hebrew', () => {
    assert.equal(yearFromCategory('1969_singles'), 1969);
    assert.equal(yearFromCategory('1958 songs'), 1958);
    assert.equal(yearFromCategory('שירים משנת 1974'), 1974);
    assert.equal(yearFromCategory('סינגלים מ-1978'), 1978);
    assert.equal(yearFromCategory('1978 debut singles'), null);
    assert.equal(yearFromCategory('Songs written by John Fogerty'), null);
  });
});

describe('wikibaseItem / pageFromParse', () => {
  test('formatversion 2 and 1 shapes', () => {
    assert.equal(wikibaseItem(fixture('wp-parse-proud-mary.json').parse), 'Q1543879');
    assert.equal(wikibaseItem(fixture('wp-parse-he-erev.json').parse), 'Q2914383');
    const p = pageFromParse(fixture('wp-parse-he-erev.json'));
    assert.equal(p.qid, 'Q2914383');
    assert.ok(p.wikitext.includes('{{סינגל'));
    assert.deepEqual(p.categories, ['שירי הדודאים']);
    assert.equal(wikibaseItem(pageFromParse(fixture('wp-parse-he-category.json'))), null);
  });
});

describe('search ranking', () => {
  const hits = fixture('wp-search-proud-mary.json').query.search;
  test('picks the song page, skips albums and unrelated titles', () => {
    assert.deepEqual(rankSearchHits(hits, ['Proud Mary'], ['Creedence Clearwater Revival']), ['Proud Mary']);
  });
  test('"(song)" and "(<artist> song)" beat a plain title; prefix matches come last', () => {
    const h = [{ title: 'Umbrella' }, { title: 'Umbrella (Rihanna song)' }, { title: 'Umbrella Academy' }, { title: 'Umbrella (disambiguation)' }];
    assert.deepEqual(rankSearchHits(h, ['Umbrella'], ['Rihanna']), ['Umbrella (Rihanna song)', 'Umbrella', 'Umbrella Academy']);
    const he = [{ title: 'נגמר (אלבום)' }, { title: 'נגמר (שיר)' }];
    assert.deepEqual(rankSearchHits(he, ['נגמר'], ['עידן עמדי']), ['נגמר (שיר)']);
  });
});

describe('network (mock fetch)', () => {
  test('findSongPage + lookupWikipedia read the year and QID', async () => {
    const { getJson, fetch } = mockClient([
      ['list=search', fixture('wp-search-proud-mary.json')],
      ['action=parse', fixture('wp-parse-proud-mary.json')],
    ]);
    assert.equal(await findSongPage('en', 'Proud Mary', 'Creedence Clearwater Revival', { getJson }), 'Proud Mary');
    const r = await lookupWikipedia('en', { title: 'Proud Mary', artist: 'Creedence Clearwater Revival' }, { getJson });
    assert.deepEqual({ found: r.found, page: r.page, year: r.year, field: r.field, qid: r.qid }, { found: true, page: 'Proud Mary', year: 1969, field: 'released', qid: 'Q1543879' });
    assert.ok(fetch.calls.every((u) => u.startsWith('https://en.wikipedia.org/w/api.php?')));
    assert.ok(fetch.calls.some((u) => u.includes('srsearch=Proud Mary Creedence Clearwater Revival')));
  });
  test('no matching hit → second query (title + "שיר"), then not found', async () => {
    const { getJson, fetch } = mockClient([['list=search', { query: { search: [{ title: 'משהו אחר' }] } }]]);
    const r = await lookupWikipedia('he', { title: 'נגמר', artist: 'עידן עמדי' }, { getJson });
    assert.deepEqual(r, { found: false });
    assert.equal(fetch.calls.length, 2);
    assert.ok(fetch.calls[1].includes('srsearch=נגמר שיר'));
  });
  test('errors become { error } and never throw', async () => {
    const { getJson } = mockClient([['list=search', () => new Response('', { status: 500 })]]);
    assert.deepEqual(await lookupWikipedia('en', { title: 'X', artist: 'Y' }, { getJson }), { found: false, error: 'HTTP 500' });
  });
});
