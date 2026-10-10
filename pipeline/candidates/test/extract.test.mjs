import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mockClient } from '../../sources/test/helpers.mjs';
import { compactYears, extract, pageUrl, titleYear } from '../index.mjs';
import { parseArgs, summarize } from '../list.mjs';
import { MISSING, allpages, parseResponse, search } from './helpers.mjs';

const RG_PAGE = 'מצעד הפזמונים העברי השנתי (תשמ"ג - תשנ"ב)';
const GG_PAGE = 'המצעד השנתי של גלגלצ';
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

describe('extract: Hebrew parades', () => {
  test('Reshet Gimel pages are discovered by prefix and search, Hebrew years mapped', async () => {
    const { getJson, fetch } = mockClient([
      [/list=allpages.*apprefix=מצעד הפזמונים העברי השנתי/, allpages(RG_PAGE, 'מצעד הפזמונים העברי השנתי של גלגלצ')],
      [/list=allpages/, allpages()],
      [/list=search/, search(RG_PAGE, 'יהודית רביץ')],
      [`page=${RG_PAGE}`, parseResponse(RG_PAGE, 'reshet-gimel-5743-5752')],
    ]);
    const { candidates, problems } = await extract({ sources: ['reshet-gimel'], fromYear: 1983, toYear: 1985, top: 5, getJson });
    assert.deepEqual([...new Set(candidates.map((c) => c.chartYear))], [1983, 1984, 1985]);
    assert.ok(candidates.every((c) => c.language === 'he' && c.page === pageUrl('he', RG_PAGE)));
    assert.equal(candidates.filter((c) => c.chartYear === 1983).length, 5); // rank 6 cut by top 5
    const parseCalls = fetch.calls.filter((u) => u.includes('action=parse'));
    assert.equal(parseCalls.length, 1, 'the page found twice (prefix + search) is read once; the Galgalatz title is rejected');
    const reasons = problems.map((p) => p.reason);
    assert.ok(reasons.some((r) => /cannot split/.test(r)));
    assert.ok(reasons.some((r) => /no rank in/.test(r)));
    assert.ok(reasons.some((r) => /year 1984: .*ranks missing \(5\)/.test(r)));
    assert.ok(reasons.some((r) => /year 1985: .*ranks missing \(2, 4, 5\)/.test(r)));
    assert.ok(problems.every((p) => p.source === 'reshet-gimel'));
  });
  test('the same year on two pages: the fuller one is used and the overlap reported', async () => {
    const other = 'מצעד הפזמונים העברי השנתי';
    const { getJson } = mockClient([
      [/list=allpages.*apprefix=מצעד הפזמונים העברי השנתי/, allpages(other, RG_PAGE)],
      [/list=(?:allpages|search)/, allpages()],
      [`page=${RG_PAGE}`, parseResponse(RG_PAGE, 'reshet-gimel-5743-5752')],
      [`page=${other}`, { parse: { title: other, wikitext: '== תשמ"ג ==\n{|\n! מקום !! שיר !! מבצע\n|-\n| 1 || אחר || מישהו\n|}' } }],
    ]);
    const { candidates, problems } = await extract({ sources: ['reshet-gimel'], fromYear: 1983, toYear: 1983, top: 5, getJson });
    assert.equal(candidates[0].title, 'באה מאהבה');
    assert.ok(problems.some((p) => p.page === pageUrl('he', other) && /year 1983 is also on/.test(p.reason)));
  });
  test('Galgalatz: international chart skipped, years outside the range dropped, nothing found → reported', async () => {
    const { getJson } = mockClient([
      [/list=allpages.*apprefix=המצעד השנתי של גלגלצ/, allpages(GG_PAGE)],
      [/list=(?:allpages|search)/, allpages()],
      [`page=${GG_PAGE}`, parseResponse(GG_PAGE, 'galgalatz')],
      [/action=parse/, MISSING],
    ]);
    const { candidates, problems } = await extract({ sources: ['galgalatz'], fromYear: 2020, toYear: 2021, getJson });
    assert.deepEqual(candidates.map((c) => `${c.chartYear} ${c.rank} ${c.title}`), ['2021 1 בית משוגעים', '2021 2 טרמינל 3', '2021 3 מתוקה']);
    assert.ok(!candidates.some((c) => c.title === 'Blinding Lights'));
    assert.ok(problems.some((p) => /no chart found for 1 year\(s\): 2020/.test(p.reason)));
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
    assert.equal(titleYear(RG_PAGE), null);
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
