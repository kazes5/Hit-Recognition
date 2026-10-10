import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { annualLists, headingYear, labelSource, parseAnnualPage, parseItem, removeTemplates } from '../annual.mjs';
import { wikitext } from './helpers.mjs';

const parse = (name) => parseAnnualPage({ wikitext: wikitext(name), page: `https://x/${name}` });
/** { 'year source': [entries] } */
function groups(entries) {
  const g = {};
  for (const e of entries) (g[`${e.chartYear} ${e.source}`] ??= []).push(e);
  return g;
}
const counts = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]));
const pair = (g, key, rank) => g[key].filter((e) => e.rank === rank).map((e) => `${e.title} | ${e.artist}`);

describe('annual pages: helpers', () => {
  test('station labels', () => {
    assert.equal(labelSource('הדירוג של "קול ישראל" לשנה זו:'), 'reshet-gimel');
    assert.equal(labelSource('דירוג השירים של קול ישראל:'), 'reshet-gimel');
    assert.equal(labelSource("דירוג רשת ג' לשנה זו"), 'reshet-gimel');
    assert.equal(labelSource('המצעד השנתי של כאן גימל:'), 'reshet-gimel');
    assert.equal(labelSource('כאן גימל'), 'reshet-gimel');
    assert.equal(labelSource('הדירוג של גלי צה"ל לשנה זו:'), 'galgalatz');
    assert.equal(labelSource('המצעד של גלי צה"ל'), 'galgalatz');
    assert.equal(labelSource('המצעד השנתי של גלגלצ ואתר ynet:'), 'galgalatz');
    assert.equal(labelSource('גלגלצ - ynet'), 'galgalatz');
    assert.equal(labelSource('המצעד השנתי של מדיה פורסט:'), 'airplay');
    assert.equal(labelSource('נתוני השמעות של אקו"ם:'), 'airplay');
    assert.equal(labelSource('משהו אחר:'), null);
  });
  test('section years: the number after the dash', () => {
    assert.equal(headingYear('ה\'תש"ל-1970'), 1970);
    assert.equal(headingYear('ה\'תשע"ח-2018'), 2018);
    assert.equal(headingYear('ה\'תשפ"ה - 2025'), 2025);
    assert.equal(headingYear('רשימת המצעדים השנתיים בשנים ה\'תש"ל–ה\'תשל"ט'), null);
    assert.equal(headingYear('ה\'תשמ"ג'), 1983);
  });
  test('footnote templates are removed, nesting-aware', () => {
    assert.equal(removeTemplates('a{{הערה|{{כאן||x|1}} y}}b{{ש}}c', ['הערה', 'ש']), 'abc');
  });
});

describe('annual pages: items', () => {
  test('quoted linked title, performer, credits group stripped', () => {
    assert.deepEqual(parseItem('"[[עפרה (שיר)|עפרה]]" – [[מוטי פליישר]] ([[אורי אסף]]/[[יאיר קלינגר]])'), { title: 'עפרה', artist: 'מוטי פליישר', creditRaw: 'מוטי פליישר' });
  });
  test('soloists: "סולן:", "סולנית:", "[[סולן]]:" without a space', () => {
    assert.deepEqual(parseItem('"[[לצפון באהבה]]" – [[להקת פיקוד צפון]], [[סולן]]:[[יגאל בשן]] ([[דודו ברק]]/[[נורית הירש]])'), {
      title: 'לצפון באהבה', artist: 'להקת פיקוד צפון', creditRaw: 'להקת פיקוד צפון, סולן:יגאל בשן', soloist: 'יגאל בשן',
    });
    const r = parseItem('"[[שיר לשלום]]" – [[להקת הנח"ל]], סולנית: [[מירי אלוני]] ([[יעקב רוטבליט]]/[[יאיר רוזנבלום]])');
    assert.equal(r.artist, 'להקת הנח"ל');
    assert.equal(r.soloist, 'מירי אלוני');
  });
  test('gershayim inside the title and links, collaborations kept whole', () => {
    assert.equal(parseItem('"גיל נסע לחו"ל" – [[אריק לביא]] (אריק לביא/[[רוני וייס]])').title, 'גיל נסע לחו"ל');
    assert.equal(parseItem('"[[קרנבל בנח"ל]]" – [[להקת הנח"ל]] ([[לאה נאור]]/[[יאיר רוזנבלום]])').title, 'קרנבל בנח"ל');
    assert.equal(parseItem('"[[כל הכוכבים]]" - [[דוד ד\'אור]] בליווי [[מקהלת מורן]]').artist, "דוד ד'אור בליווי מקהלת מורן");
    assert.equal(parseItem('"[[יומן מסע (שיר)|יומן מסע]]" - [[אביב גפן]] ו[[התעויוט]] בהשתתפות [[אריק איינשטיין]]').artist, 'אביב גפן והתעויוט בהשתתפות אריק איינשטיין');
  });
  test('cover notes, notes inside the quotes, broken links, nested credits', () => {
    assert.equal(parseItem('"[[אצלי הכל בסדר (שיר של ג\'וזי כץ)|אצלי הכל בסדר]] (קאבר)" - [[מיקה קרני]]').title, 'אצלי הכל בסדר');
    assert.equal(parseItem('"[[היום היום]]"(קאבר) – [[שרית חדד]] ([[דודו ברק]]/[[מוני אמריליו]])').title, 'היום היום');
    assert.equal(parseItem('"[[תמיד אוהב אותי]]" (גרסת כיסוי) – [[ששון איפרם שאולוב]]').title, 'תמיד אוהב אותי');
    assert.deepEqual(parseItem('"[[טאטע תטהר]] - גרסה אקוסטית" – [[יאיר אליצור|אלייצור]] ו[[בן צור]]'), { title: 'טאטע תטהר', artist: 'אלייצור ובן צור', creditRaw: 'אלייצור ובן צור' });
    assert.equal(parseItem('"[[ג\'ינג\'י (שיר של יהודה פוליקר|ג\'ינג\'י]]" - [[יהודה פוליקר]]').title, "ג'ינג'י");
    assert.equal(parseItem('"[[כפרה שלי]]" – [[נצ\'י נצ\']] (רביד פלוטניק) ([[נצ\'י נצ\'|רביד פלוטניק]])').artist, "נצ'י נצ'");
    assert.equal(parseItem('"[[אם זה זה – זה זה]]" – [[אגם בוחבוט]]').title, 'אם זה זה – זה זה');
    assert.equal(parseItem('"[[למה לא]]" – [[שרי (זמרת)|שרי]] ([[אליעוז רבין]]/[[רוני וייס]])').artist, 'שרי');
  });
  test('broken quoting is an error, not a crash', () => {
    assert.match(parseItem('"התקווה- [[סאבלימינל]] ו[[הצל (ראפר)|הצל]] (סאבלימינל והצל)').error, /closing quote/);
    assert.match(parseItem('רק שם בלי מבצע').error, /no " – "/);
  });
});

describe('annual pages: real fixtures', () => {
  test('1963–1969: only 1969 has a list (Kol Yisrael, "דירוג השירים של קול ישראל:")', () => {
    const r = parse('annual-5723-5729');
    const g = groups(r.entries);
    assert.deepEqual(counts(g), { '1969 reshet-gimel': 18 });
    assert.deepEqual(g['1969 reshet-gimel'].map((e) => e.rank), Array.from({ length: 18 }, (_, i) => i + 1));
    assert.deepEqual(pair(g, '1969 reshet-gimel', 1), ['על כפיו יביא | רבקה זהר']);
    assert.deepEqual(g['1969 reshet-gimel'][4], { source: 'reshet-gimel', chartYear: 1969, rank: 5, title: 'שנינו מאותו הכפר', artist: 'להקת פיקוד מרכז', creditRaw: 'להקת פיקוד מרכז, סולן: דני וסלי', soloist: 'דני וסלי' });
    assert.deepEqual(pair(g, '1969 reshet-gimel', 14), ['בעקבותייך | אילן ואילנית']);
    assert.deepEqual(r.problems, []);
  });
  test('1970: two tables (Kol Yisrael, Galei Tzahal), soloists, "7א/7ב" ties; 1978: unlabelled-style first table', () => {
    const r = parse('annual-5730-5739');
    const g = groups(r.entries);
    assert.deepEqual(counts(g), { '1970 reshet-gimel': 20, '1970 galgalatz': 10, '1978 reshet-gimel': 30, '1978 galgalatz': 7 });
    assert.deepEqual(g['1970 reshet-gimel'].map((e) => e.rank), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.deepEqual(pair(g, '1970 reshet-gimel', 1), ['פתאום עכשיו, פתאום היום | שלמה ארצי']);
    assert.deepEqual(pair(g, '1970 reshet-gimel', 19), ['אני אצבוט לך | להקת פיקוד דרום']);
    assert.equal(g['1970 reshet-gimel'][18].soloist, 'גדי אורון');
    assert.equal(g['1970 reshet-gimel'].filter((e) => e.soloist).length, 4);
    assert.deepEqual(pair(g, '1970 galgalatz', 1), ['למה לי לקחת ללב | אריק איינשטיין ושלום חנוך']);
    assert.deepEqual(pair(g, '1970 galgalatz', 7), ['אהבתה של תרזה די-מון | אילנית', 'דזדמונה | דדי בן עמי']);
    assert.ok(g['1970 galgalatz'].filter((e) => e.rank === 7).every((e) => e.tie));
    assert.deepEqual(pair(g, '1978 reshet-gimel', 2), ['אבניבי | יזהר כהן ואלפא-ביתא']);
    assert.deepEqual(pair(g, '1978 reshet-gimel', 30), ['גיל נסע לחו"ל | אריק לביא']);
    assert.deepEqual(pair(g, '1978 galgalatz', 2), ['שומר החומות | צוות הווי פיקוד מרכז']);
    assert.deepEqual(r.problems, []);
  });
  test('a list with no label in its year section is Reshet Gimel', () => {
    const wt = wikitext('annual-5730-5739').replace('דירוג [[רשת ג\']] של [[קול ישראל]] לשנה זו:', '');
    const lists = annualLists(wt).filter((l) => l.year === 1978);
    assert.equal(lists[0].label, null);
    const g = groups(parseAnnualPage({ wikitext: wt, page: 'p' }).entries);
    assert.equal(g['1978 reshet-gimel'].length, 30);
  });
  test('2001: {{טורים}} lists with bold and plain labels; 2003: two tables, one broken item', () => {
    const r = parse('annual-5760-5769');
    const g = groups(r.entries);
    assert.deepEqual(counts(g), { '2001 galgalatz': 40, '2001 reshet-gimel': 32, '2003 reshet-gimel': 40, '2003 galgalatz': 20 });
    assert.deepEqual(pair(g, '2001 galgalatz', 1), ['יושבים בבית קפה | טיפקס']);
    assert.deepEqual(pair(g, '2001 galgalatz', 14), ['אצלי הכל בסדר | מיקה קרני']);
    assert.deepEqual(pair(g, '2001 reshet-gimel', 1), ['יאללה לך הביתה מוטי | שרית חדד']);
    assert.deepEqual(pair(g, '2001 reshet-gimel', 3), ["כל הכוכבים | דוד ד'אור בליווי מקהלת מורן"]);
    assert.deepEqual(pair(g, '2003 reshet-gimel', 1), ['אם תלך | הפרויקט של עידן רייכל']);
    assert.deepEqual(pair(g, '2003 reshet-gimel', 2), ['בואי | הפרויקט של עידן רייכל']); // unlinked performer
    assert.deepEqual(pair(g, '2003 galgalatz', 14), ['היה לי חבר היה לי אח | דודו טסה']);
    assert.deepEqual(g['2003 galgalatz'].map((e) => e.rank).filter((n) => n <= 20), [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.equal(r.problems.length, 1);
    assert.equal(r.problems[0].source, 'galgalatz');
    assert.match(r.problems[0].reason, /year 2003, rank 5: cannot find the closing quote.*התקווה/);
  });
  test('2018: label on the same line as {{טורים, and right after the previous "}}"', () => {
    const r = parse('annual-5770-5779');
    const g = groups(r.entries);
    assert.deepEqual(counts(g), { '2018 galgalatz': 40, '2018 reshet-gimel': 27 });
    assert.deepEqual(pair(g, '2018 galgalatz', 1), ['שני משוגעים | עומר אדם']);
    assert.deepEqual(pair(g, '2018 galgalatz', 16), ["כפרה שלי | נצ'י נצ'"]);
    assert.deepEqual(pair(g, '2018 reshet-gimel', 1), ['Toy | נטע ברזילי']);
    assert.deepEqual(pair(g, '2018 reshet-gimel', 4), ['קומסי קומסה | סטפן לגר']);
    assert.deepEqual(r.problems, []);
  });
  test('2025: Media Forest and ACUM airplay lists skipped and reported; ";כאן גימל" label; {{שני טורים}} ignored', () => {
    const r = parse('annual-5780-');
    const g = groups(r.entries);
    assert.deepEqual(counts(g), { '2025 reshet-gimel': 40 });
    assert.deepEqual(pair(g, '2025 reshet-gimel', 1), ['תמיד אוהב אותי | ששון איפרם שאולוב']);
    assert.deepEqual(pair(g, '2025 reshet-gimel', 38), ['טאטע תטהר | אלייצור ובן צור']);
    assert.deepEqual(r.problems.map((p) => [p.reason, p.source]), [['airplay-ranking-skipped', undefined], ['airplay-ranking-skipped', undefined]]);
    assert.match(r.problems[0].detail, /מדיה פורסט.*10 items/);
    assert.match(r.problems[1].detail, /אקו"ם.*20 items/);
    assert.ok(!r.entries.some((e) => e.artist === 'אייל גולן' && e.title === 'אייל גולן'), 'singer-of-the-year lists are not songs');
  });
  test('an unknown label is reported, not guessed', () => {
    const r = parseAnnualPage({ wikitext: '== ה\'תש"ל-1970 ==\nרשימה כלשהי:\n{{טורים\n| תוכן = # "א" – ב\n}}', page: 'p' });
    assert.equal(r.entries.length, 0);
    assert.match(r.problems[0].reason, /unknown-ranking-label: "רשימה כלשהי:"/);
  });
  test('a second ranking of the same station in a year is reported and ignored', () => {
    const list = '{{טורים\n| תוכן = # "א" – ב\n}}';
    const r = parseAnnualPage({ wikitext: `== ה'תש"ל-1970 ==\n'''המצעד של גלי צה"ל'''\n${list}\n'''המצעד של גלגלצ'''\n${list}`, page: 'p' });
    assert.equal(r.entries.length, 1);
    assert.match(r.problems[0].reason, /year 1970: a second galgalatz ranking/);
  });
});
