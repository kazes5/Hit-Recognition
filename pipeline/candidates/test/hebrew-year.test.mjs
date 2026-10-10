import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { gematria, hebrewToChartYear, hebrewYearsIn } from '../hebrew-year.mjs';

describe('Hebrew years', () => {
  test('gematria of well-formed numerals', () => {
    assert.equal(gematria('תשמג'), 743);
    assert.equal(gematria('תש"ם'), 740);
    assert.equal(gematria('תשט"ו'), 715);
    assert.equal(gematria('תשט"ז'), 716);
    assert.equal(gematria('גמ'), null); // ascending order is not a numeral
    assert.equal(gematria('abc'), null);
  });
  test('a Hebrew year maps to the civil year it ended in', () => {
    const cases = { 'תשכ"ט': 1969, 'תש"ל': 1970, 'תש"ם': 1980, 'תשמ"ג': 1983, 'תשנ"ב': 1992, 'תשנ"ו': 1996, 'תשס"א': 2001, 'תש"ע': 2010, 'תשפ"א': 2021, 'תשפ"ה': 2025, 'תשפ"ו': 2026 };
    for (const [h, y] of Object.entries(cases)) assert.equal(hebrewYearsIn(h)[0]?.civil, y, h);
    assert.equal(hebrewToChartYear(5743), 1983);
  });
  test('spellings: gershayim ״, two apostrophes, ה\' prefix, inside headings', () => {
    assert.equal(hebrewYearsIn('תשמ״ג')[0].civil, 1983);
    assert.equal(hebrewYearsIn("תשמ''ג")[0].civil, 1983);
    assert.equal(hebrewYearsIn('ה\'תשמ"ג')[0].civil, 1983);
    assert.deepEqual(hebrewYearsIn('מצעד הפזמונים העברי השנתי (תשמ"ג - תשנ"ב)').map((x) => x.civil), [1983, 1992]);
  });
  test('abbreviations that are not years are ignored', () => {
    assert.deepEqual(hebrewYearsIn('ת"א, תנ"ך, צה"ל, רמ"א'), []);
  });
});
