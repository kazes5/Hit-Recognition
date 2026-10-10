import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { columnRoles, parseChartPage, parseRank, splitItem, yearFromText } from '../chart-page.mjs';
import { wikitext } from './helpers.mjs';

const parse = (name, o = {}) => parseChartPage({ wikitext: wikitext(name), page: `https://x/${name}`, ...o });
const brief = (es) => es.map((e) => `${e.chartYear} ${e.rank}. ${e.title} – ${e.artist}`);

describe('helpers', () => {
  test('column roles from English and Hebrew headers', () => {
    assert.deepEqual(columnRoles(['No.', 'Title', 'Artist(s)']), { rank: 0, title: 1, artist: 2 });
    assert.deepEqual(columnRoles(['מקום', 'שם השיר', 'מבצע', 'מילים', 'לחן']), { rank: 0, title: 1, artist: 2 });
    assert.deepEqual(columnRoles(['שנה', 'מבצע', 'שיר', 'שפה', 'מקום', 'נקודות']), { year: 0, artist: 1, title: 2, language: 3, rank: 4 });
    assert.equal(columnRoles(['זמר השנה', 'זמרת השנה']).title, undefined);
  });
  test('year from a heading: Hebrew year first, else the last civil year', () => {
    assert.equal(yearFromText('תשמ"ג'), 1983);
    assert.equal(yearFromText('תשמ"ד (1984)'), 1984);
    assert.equal(yearFromText('1982–1983'), 1983);
    assert.equal(yearFromText('2015'), 2015);
    assert.equal(yearFromText('ראו גם'), null);
  });
  test('ranks', () => {
    assert.equal(parseRank('1'), 1);
    assert.equal(parseRank('12.'), 12);
    assert.equal(parseRank('T-3'), 3);
    assert.equal(parseRank('—'), null);
  });
  test('list items', () => {
    assert.deepEqual(splitItem('"[[חופים (שיר)|חופים]]" – [[יהודית רביץ]]'), { title: 'חופים', artist: 'יהודית רביץ' });
    assert.deepEqual(splitItem('[[יש בי אהבה]] - [[אריק איינשטיין]]'), { title: 'יש בי אהבה', artist: 'אריק איינשטיין' });
    assert.deepEqual(splitItem('"Song" by Artist'), { title: 'Song', artist: 'Artist' });
    assert.deepEqual(splitItem('מבצע – שיר', 'artist-title'), { title: 'שיר', artist: 'מבצע' });
    assert.equal(splitItem('שיר בלי מבצע'), null);
  });
});

describe('Billboard pages', () => {
  test('1985: inline "||" rows, quotes and links cleaned, featuring split', () => {
    const r = parse('billboard-1985', { pageYear: 1985 });
    assert.equal(r.entries.length, 22);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.entries[0], { chartYear: 1985, rank: 1, title: 'Careless Whisper', artist: 'Wham!', creditRaw: 'Wham! featuring George Michael' });
    assert.deepEqual(brief(r.entries.slice(5, 6)), ['1985 6. Out of Touch – Daryl Hall & John Oates']);
    assert.equal(r.entries[19].title, 'Shout'); // ref removed
  });
  test('2015: row-header ranks, caption, rowspan artist, footnote template', () => {
    const r = parse('billboard-2015', { pageYear: 2015 });
    assert.deepEqual(r.problems, []);
    assert.deepEqual(brief(r.entries.slice(6, 9)), ['2015 7. Blank Space – Taylor Swift', '2015 8. Bad Blood – Taylor Swift', '2015 9. Lean On – Major Lazer and DJ Snake']);
    assert.equal(r.entries[8].creditRaw, 'Major Lazer and DJ Snake featuring MØ');
  });
  test('1956: pre-Hot 100 top-50 page, double A-side', () => {
    const r = parse('billboard-1956', { pageYear: 1956 });
    assert.equal(r.entries[1].title, "Don't Be Cruel / Hound Dog");
    assert.equal(r.entries.length, 5);
  });
});

describe('robustness', () => {
  test('a song table without any year is a problem', () => {
    const r = parseChartPage({ wikitext: '{|\n! מקום !! שיר !! מבצע\n|-\n| 1 || א || ב\n|}', page: 'p' });
    assert.equal(r.entries.length, 0);
    assert.match(r.problems[0].reason, /no chart year/);
  });
  test('a table with a title column but no performer column is a problem', () => {
    const r = parseChartPage({ wikitext: '== 1990 ==\n{|\n! מקום !! שיר !! משהו\n|-\n| 1 || א || ב\n|}', page: 'p' });
    assert.match(r.problems[0].reason, /no performer column/);
  });
  test('a headerless numbered table is read as rank | title | performer and reported', () => {
    const rows = [1, 2, 3].map((n) => `|-\n| ${n} || שיר ${n} || מבצע ${n}`).join('\n');
    const r = parseChartPage({ wikitext: `== 1990 ==\n{|\n${rows}\n|}`, page: 'p' });
    assert.equal(r.entries.length, 3);
    assert.match(r.problems[0].reason, /no header row/);
  });
  test('a second song table for the same year is reported and ignored', () => {
    const t = '{|\n! מקום !! שיר !! מבצע\n|-\n| 1 || א || ב\n|}';
    const r = parseChartPage({ wikitext: `== 1990 ==\n${t}\n${t}`, page: 'p' });
    assert.equal(r.entries.length, 1);
    assert.match(r.problems[0].reason, /year 1990: a second song table/);
  });
  test('year sub-heading rows inside one table, and ranks from row order', () => {
    const wt = '{|\n! שיר !! מבצע\n|-\n! colspan="2" | תשמ"ג\n|-\n| א || ב\n|-\n| ג || ד\n|-\n! colspan="2" | תשמ"ד\n|-\n| ה || ו\n|}';
    const r = parseChartPage({ wikitext: wt, page: 'p' });
    assert.deepEqual(brief(r.entries), ['1983 1. א – ב', '1983 2. ג – ד', '1984 1. ה – ו']);
    assert.match(r.notes.join(), /ranks taken from row order/);
  });
  test('a "song of the year" table (year column, no rank) is not read as a chart', () => {
    const r = parseChartPage({ wikitext: '{|\n! שנה !! שיר השנה !! מבצע\n|-\n| 1983 || א || ב\n|}', page: 'p' });
    assert.equal(r.entries.length, 0);
    assert.match(r.notes.join(), /one song per year/);
  });
  test('Eurovision table: one entry per year, placing kept, non-participation noted', () => {
    const r = parse('eurovision', { rankMode: 'entry' });
    assert.deepEqual(r.entries.map((e) => [e.chartYear, e.rank, e.placing, e.title, e.artist, e.languageText]), [
      [1973, 1, 4, 'אי שם', 'אילנית', 'עברית'],
      [1978, 1, 1, 'א-ב-ני-בי', 'יזהר כהן ולהקת אלפא-ביתא', 'עברית'],
      [2018, 1, 1, 'Toy', 'נטע ברזילי', 'אנגלית'],
    ]);
    assert.deepEqual(r.problems, []);
    assert.match(r.notes.join(), /no entry in .*1980/);
  });
});
