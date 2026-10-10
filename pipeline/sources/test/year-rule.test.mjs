import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyYearRule, otherPerformersPage } from '../year-rule.mjs';

const he = { language: 'he' };
const en = { language: 'en' };

describe('year rule: accept', () => {
  test('two trusted sources agree exactly', () => {
    const r = applyYearRule({ wikipedia: 1995, wikidata: 1995, musicbrainz: 1994, store: 2009 }, en);
    assert.equal(r.year, 1995);
    assert.equal(r.accepted, true);
    assert.deepEqual(r.flags, []);
    assert.deepEqual(r.agreeing, ['wikipedia', 'wikidata']);
    assert.deepEqual(r.sources, { wikipedia: 1995, wikidata: 1995, musicbrainz: 1994, store: 2009 });
  });
  test('all three agree → note "unanimous" (D8 automatic catalog fix)', () => {
    const r = applyYearRule({ wikipedia: 1983, wikidata: 1983, musicbrainz: 1983 }, en);
    assert.equal(r.accepted, true);
    assert.deepEqual(r.notes, ['unanimous']);
  });
  test('two agree while the third is missing', () => {
    const r = applyYearRule({ wikipedia: null, wikidata: 2013, musicbrainz: 2013 }, he);
    assert.equal(r.accepted, true);
    assert.equal(r.year, 2013);
  });
  test('Hebrew 1970 is not pre-1970', () => {
    assert.equal(applyYearRule({ wikipedia: 1970, wikidata: 1970 }, he).accepted, true);
  });
  test('store earlier than the agreed year → note, still accepted', () => {
    const r = applyYearRule({ wikipedia: 1990, wikidata: 1990, store: 1988 }, en);
    assert.equal(r.accepted, true);
    assert.deepEqual(r.notes, ['store-earlier']);
  });
});

describe('year rule: flags', () => {
  test('"disagree": years differ (even by one: the rule is exact, not ±1 like the POC)', () => {
    const r = applyYearRule({ wikipedia: 1978, wikidata: 1979, musicbrainz: 1977 }, en);
    assert.equal(r.accepted, false);
    assert.deepEqual(r.flags, ['disagree']);
    assert.equal(r.year, 1977, 'earliest trusted year is proposed to the reviewer');
  });
  test('"disagree": a single trusted source is not enough', () => {
    const r = applyYearRule({ musicbrainz: 2004, store: 2004 }, en);
    assert.deepEqual(r.flags, ['disagree']);
    assert.equal(r.accepted, false);
  });
  test('"store-only"', () => {
    const r = applyYearRule({ store: 2010 }, en);
    assert.deepEqual(r.flags, ['store-only']);
    assert.equal(r.year, 2010);
    assert.equal(r.accepted, false);
  });
  test('"none"', () => {
    const r = applyYearRule({}, en);
    assert.deepEqual(r.flags, ['none']);
    assert.equal(r.year, null);
  });
  test('"pre-1970-hebrew": always flagged, even when all three agree', () => {
    const r = applyYearRule({ wikipedia: 1967, wikidata: 1967, musicbrainz: 1967 }, he);
    assert.deepEqual(r.flags, ['pre-1970-hebrew']);
    assert.equal(r.accepted, false);
    assert.equal(r.year, 1967);
    assert.equal(applyYearRule({ wikipedia: 1967, wikidata: 1967 }, en).accepted, true, 'English is not affected');
  });
  test('"pre-1970-hebrew" together with "disagree"', () => {
    assert.deepEqual(applyYearRule({ wikipedia: 1957, musicbrainz: 1958 }, he).flags, ['disagree', 'pre-1970-hebrew']);
  });
  test('"chart-range": the year must be in [chartYear − 2, chartYear]', () => {
    assert.equal(applyYearRule({ wikipedia: 1990, wikidata: 1990 }, { ...en, chartYear: 1990 }).accepted, true);
    assert.equal(applyYearRule({ wikipedia: 1988, wikidata: 1988 }, { ...en, chartYear: 1990 }).accepted, true);
    assert.deepEqual(applyYearRule({ wikipedia: 1987, wikidata: 1987 }, { ...en, chartYear: 1990 }).flags, ['chart-range']);
    assert.deepEqual(applyYearRule({ wikipedia: 1991, wikidata: 1991 }, { ...en, chartYear: 1990 }).flags, ['chart-range']);
  });
  test('non-integer inputs are treated as missing', () => {
    assert.deepEqual(applyYearRule({ wikipedia: '1990', wikidata: undefined, musicbrainz: NaN }, en).flags, ['none']);
  });
});

// The source test's three accepted-but-wrong years (SONG_PIPELINE.md section 2) and the
// suspected catalog errors, replayed through the rule with what the fixed adapters read.
describe('year rule: source-test cases', () => {
  test('Proud Mary (1969): the POC read "recorded" 1968; with "released" the rule gives 1969', () => {
    // POC: wikipedia 1968 (recorded) + musicbrainz 1968 → wrong 1968 accepted.
    assert.equal(applyYearRule({ wikipedia: 1968, wikidata: 1969, musicbrainz: 1968 }, en).year, 1968, 'the old input reproduces the bug');
    const r = applyYearRule({ wikipedia: 1969, wikidata: 1969, musicbrainz: 1968 }, en);
    assert.equal(r.year, 1969);
    assert.equal(r.accepted, true);
  });
  test('Sultans of Swing (1978): the POC read a 1979 re-release; with the original release the rule gives 1978', () => {
    assert.equal(applyYearRule({ wikipedia: 1979, wikidata: 1979, musicbrainz: 1978 }, en).year, 1979, 'the old input reproduces the bug');
    const r = applyYearRule({ wikipedia: 1978, wikidata: 1979, musicbrainz: 1978 }, en);
    assert.equal(r.year, 1978);
    assert.equal(r.accepted, true);
  });
  test('ערב של שושנים (1958): sources agree on the 1957 first recording; the pre-1970 Hebrew flag sends it to a person', () => {
    const r = applyYearRule({ wikipedia: 1957, wikidata: 1957, musicbrainz: 1958 }, he);
    assert.equal(r.year, 1957);
    assert.equal(r.accepted, false);
    assert.deepEqual(r.flags, ['pre-1970-hebrew']);
  });
  test('suspected catalog errors are accepted with the earlier year (to be listed for the owner)', () => {
    // The Look (catalog 1989), This Love (2004), נגמר (2013): sources point one year earlier.
    assert.equal(applyYearRule({ wikipedia: 1988, wikidata: 1988, musicbrainz: 1988 }, en).year, 1988);
    assert.equal(applyYearRule({ wikipedia: 2002, wikidata: 2002, musicbrainz: 2004 }, en).year, 2002);
    assert.equal(applyYearRule({ wikipedia: 2012, wikidata: 2012 }, he).year, 2012);
  });
});

describe('chart-year rules (batch 1 review)', () => {
  const he = (chartYear, extra = {}) => ({ language: 'he', chartYear, ...extra });

  test('chart window: one trusted source on the chart year (or the year before) is enough', () => {
    // אבי טולדנו – בדרך חזרה shape: only MusicBrainz, on the chart year
    const r = applyYearRule({ wikipedia: null, wikidata: null, musicbrainz: 1978, store: 1998 }, he(1978));
    assert.equal(r.accepted, true);
    assert.equal(r.year, 1978);
    assert.ok(r.notes.includes('chart-window'));
    assert.equal(applyYearRule({ wikipedia: 1977, wikidata: null, musicbrainz: 1990, store: null }, he(1978)).year, 1977);
  });

  test('chart window: refused when the store year is earlier, or the two window years tie', () => {
    assert.deepEqual(applyYearRule({ wikipedia: null, wikidata: null, musicbrainz: 1985, store: 1980 }, he(1985)).flags, ['disagree']);
    assert.ok(applyYearRule({ wikipedia: 1984, wikidata: null, musicbrainz: 1985, store: null }, he(1985)).flags.includes('disagree'));
  });

  test('a window year given by two sources wins over one given by one', () => {
    const r = applyYearRule({ wikipedia: 1984, wikidata: null, musicbrainz: 1985, store: 2000 }, he(1985));
    assert.ok(r.flags.includes('disagree'), 'tie 1-1');
    const r2 = applyYearRule({ wikipedia: 1984, wikidata: 1984, musicbrainz: 1985 }, he(1985));
    assert.equal(r2.year, 1984); // ordinary 2-of-3 agreement
  });

  test("another performer's song page: Wikipedia and Wikidata are ignored", () => {
    // פינג פונג – שמח: the page is "שמח (שיר של עברי לידר)" (2021); MusicBrainz 2000, chart 2000
    const r = applyYearRule({ wikipedia: 2021, wikidata: 2021, musicbrainz: 2000, store: 2005 }, he(2000, { wikipediaPage: 'שמח (שיר של עברי לידר)', artist: 'פינג פונג' }));
    assert.equal(r.year, 2000);
    assert.equal(r.accepted, true);
    assert.ok(r.notes.includes('other-song-page'));
    // The same page title for its own performer is used as usual.
    const own = applyYearRule({ wikipedia: 2021, wikidata: 2021, musicbrainz: 2000 }, he(2021, { wikipediaPage: 'שמח (שיר של עברי לידר)', artist: 'עברי לידר' }));
    assert.equal(own.year, 2021);
    assert.ok(!own.notes.includes('other-song-page'));
    assert.equal(otherPerformersPage('Alone (i-Ten song)', 'Heart'), true);
    assert.equal(otherPerformersPage('Hello (Lionel Richie song)', 'Lionel Richie'), false);
    assert.equal(otherPerformersPage('כאן (שיר)', 'דואו דאץ'), false);
  });

  test('years after the chart year + 1 are ignored', () => {
    const r = applyYearRule({ wikipedia: 1983, wikidata: 2015, musicbrainz: 2015, store: 2015 }, he(1983));
    assert.equal(r.year, 1983);
    assert.equal(r.accepted, true);
    assert.ok(r.notes.includes('after-chart'));
  });

  test('Hebrew before 1970: accepted only when two sources agree on the chart year', () => {
    assert.equal(applyYearRule({ wikipedia: 1969, wikidata: 1969, musicbrainz: 1995, store: 1969 }, he(1969)).accepted, true);
    assert.ok(applyYearRule({ wikipedia: 1968, wikidata: 1968, musicbrainz: null }, he(1969)).flags.includes('pre-1970-hebrew'));
    assert.ok(applyYearRule({ wikipedia: null, wikidata: null, musicbrainz: 1969 }, he(1969)).flags.includes('pre-1970-hebrew'));
    // Without a chart year (the catalog recheck) nothing changes.
    assert.ok(applyYearRule({ wikipedia: 1969, wikidata: 1969, musicbrainz: 1969 }, { language: 'he' }).flags.includes('pre-1970-hebrew'));
  });

  test('without a chart year the rule is unchanged', () => {
    const r = applyYearRule({ wikipedia: 2021, wikidata: 2021, musicbrainz: 2000 }, { language: 'he', wikipediaPage: 'שמח (שיר של עברי לידר)', artist: 'פינג פונג' });
    assert.equal(r.year, 2021);
  });
});
