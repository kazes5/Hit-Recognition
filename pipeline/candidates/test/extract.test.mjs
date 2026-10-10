import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mockClient } from '../../sources/test/helpers.mjs';
import { compactYears, extract, pageUrl, titleYear } from '../index.mjs';
import { parseArgs, summarize } from '../list.mjs';
import { MISSING, allpages, parseResponse, search } from './helpers.mjs';

const CONTRACT_KEYS = ['source', 'chartYear', 'rank', 'artist', 'title', 'language', 'page', 'creditRaw'];

describe('extract: Billboard', () => {
  test('one page per year, top 20 only, contract shape', async () => {
    const { getJson, fetch } = mockClient([
      ['page=Billboard Year-End Hot 100 singles of 1985', parseResponse('Billboard Year-End Hot 100 singles of 1985', 'billboard-1985')],
      ['page=Billboard Year-End Hot 100 singles of 1984', MISSING],
    ]);
    const { candidates, problems } = await extract({ sources: ['billboard'], fromYear: 1984, toYear: 1986, getJson });
    assert.equal(candidates.length, 20);
    assert.deepEqual(Object.keys(candidates[0]), CONTRACT_KEYS);
    assert.deepEqual(candidates[0], {
      source: 'billboard', chartYear: 1985, rank: 1, artist: 'Wham!', title: 'Careless Whisper', language: 'en',
      page: 'https://en.wikipedia.org/wiki/Billboard_Year-End_Hot_100_singles_of_1985', creditRaw: 'Wham! featuring George Michael',
    });
    assert.ok(candidates.every((c) => c.rank >= 1 && c.rank <= 20));
    const reasons = problems.map((p) => p.reason);
    assert.ok(reasons.some((r) => /year 1984: page not found/.test(r)), 'missing page reported');
    assert.ok(reasons.some((r) => /fetch failed: HTTP 404/.test(r)), '1986 HTTP error reported');
    assert.ok(reasons.some((r) => /no chart found for 2 year\(s\): 1984, 1986/.test(r)));
    assert.ok(fetch.calls.every((u) => u.includes('action=parse') && u.includes('prop=wikitext')));
  });
  test('1955–1958 use the pre-Hot 100 year-end pages; alternatives are tried in order', async () => {
    const { getJson, fetch } = mockClient([
      ['page=Billboard year-end top 50 singles of 1956', parseResponse('Billboard year-end top 50 singles of 1956', 'billboard-1956')],
      [/page=Billboard/, MISSING],
    ]);
    const { candidates, problems } = await extract({ sources: ['billboard'], fromYear: 1955, toYear: 1956, top: 5, getJson });
    assert.deepEqual(candidates.map((c) => c.chartYear), [1956, 1956, 1956, 1956, 1956]);
    assert.ok(fetch.calls.some((u) => u.includes('top 30 singles of 1955')));
    assert.match(problems.find((p) => /1955: page not found/.test(p.reason)).reason, /top 30 singles of 1955 \| Billboard year-end top 50 singles of 1955/);
  });
  test('missing ranks in the top 20 are reported', async () => {
    const { getJson } = mockClient([['page=Billboard Year-End Hot 100 singles of 2015', parseResponse('Billboard Year-End Hot 100 singles of 2015', 'billboard-2015')]]);
    const { candidates, problems } = await extract({ sources: ['billboard'], fromYear: 2015, toYear: 2015, getJson });
    assert.equal(candidates.length, 10);
    assert.match(problems[0].reason, /year 2015: 10 of the top 20 ranks missing \(11, 12/);
  });
});

const ANNUAL_PAGES = {
  'annual-5723-5729': 'מצעד הפזמונים העברי השנתי (ה\'תשכ"ג–ה\'תשכ"ט)',
  'annual-5730-5739': 'מצעד הפזמונים העברי השנתי (ה\'תש"ל–ה\'תשל"ט)',
  'annual-5760-5769': 'מצעד הפזמונים העברי השנתי (ה\'תש"ס–ה\'תשס"ט)',
  'annual-5770-5779': 'מצעד הפזמונים העברי השנתי (ה\'תש"ע–ה\'תשע"ט)',
  'annual-5780-': 'מצעד הפזמונים העברי השנתי (ה\'תש"ף ואילך)',
};
const annualRoutes = () => [
  [/list=allpages.*apprefix=מצעד הפזמונים העברי השנתי/, allpages('מצעד הפזמונים העברי השנתי', ...Object.values(ANNUAL_PAGES))],
  [/list=search/, search(ANNUAL_PAGES['annual-5780-'], 'יהודית רביץ')],
  ...Object.entries(ANNUAL_PAGES).map(([fx, title]) => [`page=${title}`, parseResponse(title, fx)]),
];
const perYear = (cs) => {
  const n = {};
  for (const c of cs) n[`${c.chartYear} ${c.source}`] = (n[`${c.chartYear} ${c.source}`] ?? 0) + 1;
  return n;
};

describe('extract: Hebrew annual parades (real page layout)', () => {
  test('both stations from the same decade pages, top 20, sources by label', async () => {
    const { getJson, fetch } = mockClient(annualRoutes());
    const { candidates, problems } = await extract({ sources: ['reshet-gimel', 'galgalatz'], fromYear: 1969, toYear: 2025, getJson });
    assert.deepEqual(perYear(candidates), {
      '1969 reshet-gimel': 18, '1970 reshet-gimel': 20, '1978 reshet-gimel': 20, '2001 reshet-gimel': 20, '2003 reshet-gimel': 20, '2018 reshet-gimel': 20, '2025 reshet-gimel': 20,
      '1970 galgalatz': 10, '1978 galgalatz': 7, '2001 galgalatz': 20, '2003 galgalatz': 20, '2018 galgalatz': 20,
    });
    assert.equal(candidates.length, 215);
    assert.ok(candidates.every((c) => c.rank >= 1 && c.rank <= 20 && c.language === 'he'));
    assert.deepEqual(Object.keys(candidates[0]).slice(0, 8), CONTRACT_KEYS);
    const solo = candidates.find((c) => c.chartYear === 1970 && c.source === 'reshet-gimel' && c.rank === 5);
    assert.deepEqual(solo, {
      source: 'reshet-gimel', chartYear: 1970, rank: 5, artist: 'להקת הנח"ל', title: 'שיר לשלום', language: 'he',
      page: pageUrl('he', ANNUAL_PAGES['annual-5730-5739']), creditRaw: 'להקת הנח"ל, סולנית: מירי אלוני', soloist: 'מירי אלוני',
    });
    assert.ok(!fetch.calls.some((u) => /page=מצעד הפזמונים העברי השנתי$/.test(u)), 'the main article is not read');
    const reasons = problems.map((p) => `${p.source}: ${p.reason}`);
    assert.equal(reasons.filter((r) => r === 'hebrew-annual: airplay-ranking-skipped').length, 2, 'reported once, not per source');
    assert.ok(!reasons.some((r) => /closing quote/.test(r)), 'a missing closing quote falls back to the dash');
    assert.ok(reasons.some((r) => /^reshet-gimel: year 1969: 2 of the top 20 ranks missing \(19, 20\)/.test(r)));
    assert.ok(reasons.some((r) => /^galgalatz: year 1970: 11 of the top 20 ranks missing \(10, 11/.test(r)));
    assert.ok(!reasons.some((r) => /appears more than once/.test(r)), '7א/7ב ties are not duplicates');
    assert.ok(reasons.some((r) => /^reshet-gimel: no chart found for 50 year\(s\): 1971–1977, 1979–2000, 2002, 2004–2017, 2019–2024/.test(r)));
    assert.ok(reasons.some((r) => /^galgalatz: no chart found for 51 year\(s\): 1971–1977, 1979–2000, 2002, 2004–2017, 2019–2025/.test(r)));
  });
  test('one source alone reads only its own rankings', async () => {
    const { getJson } = mockClient(annualRoutes());
    const { candidates } = await extract({ sources: ['galgalatz'], fromYear: 2018, toYear: 2018, getJson });
    assert.equal(candidates.length, 20);
    assert.ok(candidates.every((c) => c.source === 'galgalatz'));
    assert.equal(candidates[0].title, 'שני משוגעים');
  });
  test('discovery failure and no page at all are problems, never silence', async () => {
    const { getJson } = mockClient([[/list=allpages/, () => new Response('', { status: 500 })], [/list=search/, search()], [/action=parse/, MISSING]]);
    const { candidates, problems } = await extract({ sources: ['galgalatz'], fromYear: 2000, toYear: 2001, getJson });
    assert.equal(candidates.length, 0);
    assert.ok(problems.some((p) => /page discovery failed: HTTP 500/.test(p.reason)));
    assert.ok(problems.some((p) => /no chart found for 2 year\(s\): 2000–2001/.test(p.reason)));
  });
});

describe('extract: optional sources', () => {
  test('Eurovision: rank 1 per entry, placing and language from the table', async () => {
    const { getJson } = mockClient([['page=ישראל באירוויזיון', parseResponse('ישראל באירוויזיון', 'eurovision')]]);
    const { candidates, problems } = await extract({ sources: ['eurovision'], getJson });
    assert.deepEqual(candidates.map((c) => [c.chartYear, c.rank, c.placing, c.language, c.title]), [
      [1973, 1, 4, 'he', 'אי שם'],
      [1978, 1, 1, 'he', 'א-ב-ני-בי'],
      [2018, 1, 1, 'en', 'Toy'],
    ]);
    assert.deepEqual(problems, []);
  });
  test('Israel Song Festival: year from the page title, rank = placing (unplaced → top)', async () => {
    const t = 'פסטיבל הזמר והפזמון 1970';
    const { getJson } = mockClient([
      [/list=allpages/, allpages(t)],
      [/list=search/, search()],
      [`page=${t}`, parseResponse(t, 'festival-1970')],
      [/action=parse/, MISSING],
    ]);
    const { candidates } = await extract({ sources: ['israel-song-festival'], getJson });
    assert.deepEqual(candidates.map((c) => [c.chartYear, c.rank, c.placing, c.title]), [
      [1970, 1, 1, 'בלדה לחובש'],
      [1970, 2, 2, 'שיר שני בפסטיבל'],
      [1970, 20, null, 'שיר מחוץ לתחרות'],
    ]);
  });
  test('unknown source is a problem', async () => {
    const { problems } = await extract({ sources: ['nope'], getJson: async () => ({}) });
    assert.match(problems[0].reason, /unknown source/);
  });
});

describe('helpers and CLI', () => {
  test('titleYear only for titles with exactly one year', () => {
    assert.equal(titleYear('פסטיבל הזמר והפזמון 1970'), 1970);
    assert.equal(titleYear('המצעד השנתי של גלגלצ תשפ"א'), 2021);
    assert.equal(titleYear('מצעד הפזמונים העברי השנתי (ה\'תש"ל–ה\'תשל"ט)'), null);
  });
  test('compactYears', () => {
    assert.equal(compactYears([1970, 1971, 1972, 1980, 1990, 1991]), '1970–1972, 1980, 1990–1991');
  });
  test('parseArgs', () => {
    const a = parseArgs(['--sources', 'reshet-gimel,galgalatz', '--from', '1969', '--to', '2025', '--out', 'o']);
    assert.deepEqual(a, { sources: ['reshet-gimel', 'galgalatz'], from: 1969, to: 2025, top: 20, out: 'o' });
    assert.equal(parseArgs(['--sources', 'all']).sources.length, 5);
    assert.throws(() => parseArgs(['--from', 'x']), /whole number/);
    assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
  });
  test('summary lists counts per source and year, pages and problems', async () => {
    const { getJson } = mockClient([['page=Billboard Year-End Hot 100 singles of 2015', parseResponse('Billboard Year-End Hot 100 singles of 2015', 'billboard-2015')]]);
    const r = await extract({ sources: ['billboard'], fromYear: 2015, toYear: 2015, getJson });
    const md = summarize(r, { sources: ['billboard'], from: 2015, to: 2015, top: 20 });
    assert.match(md, /\*\*10 candidates, 1 problems\.\*\*/);
    assert.match(md, /\| billboard \| en \| 1 \(2015\) \| 10 \| 1 \|/);
    assert.match(md, /2015: 10/);
    assert.match(md, /\[Billboard Year-End Hot 100 singles of 2015\]\(https:\/\/en\.wikipedia\.org/);
    assert.match(md, /ranks missing/);
  });
});
