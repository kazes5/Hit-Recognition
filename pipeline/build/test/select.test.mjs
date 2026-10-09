import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { allocate, selectBatch } from '../select.mjs';

let n = 0;
const c = (language, year, rank, o = {}) => ({ source: 'x', language, chartYear: year, firstChartYear: year, rank, bestRank: rank, artist: `A${n}`, title: `T${n++}`, ...o });

describe('allocate', () => {
  test('even split, then the short group\'s places go to the others', () => {
    const q = allocate(9, [
      { key: 'a', weight: 1, capacity: 100 },
      { key: 'b', weight: 1, capacity: 2 },
      { key: 'c', weight: 1, capacity: 100 },
    ]);
    assert.deepEqual([...q], [['a', 4], ['b', 2], ['c', 3]]);
  });
  test('weights and zero weight', () => {
    assert.deepEqual([...allocate(6, [{ key: 'a', weight: 2, capacity: 9 }, { key: 'b', weight: 1, capacity: 9 }, { key: 'z', weight: 0, capacity: 9 }])], [['a', 4], ['b', 2], ['z', 0]]);
  });
  test('stops when all groups are full', () => {
    assert.deepEqual([...allocate(10, [{ key: 'a', weight: 1, capacity: 3 }])], [['a', 3]]);
  });
});

describe('selectBatch', () => {
  test('higher-ranked first, even decades, reasons for those left out', () => {
    const cands = [
      c('he', 1981, 5), c('he', 1982, 1), c('he', 1985, 9), c('he', 1983, 2),
      c('he', 1991, 3), c('he', 1992, 4),
      c('he', 1975, 1, { excluded: true }),
      c('he', 1979, 25),
    ];
    const r = selectBatch(cands, { size: 4 });
    assert.deepEqual(r.chosen.map((x) => [x.firstChartYear, x.bestRank]), [[1982, 1], [1983, 2], [1991, 3], [1992, 4]]);
    assert.deepEqual(r.counts.byDecade, { 'he 1980s': 2, 'he 1990s': 2 });
    assert.deepEqual(r.counts.leftOut, { excluded: 1, 'outside-top-20': 1, 'batch-full': 2 });
    assert.equal(r.chosen.length + r.leftOut.length, cands.length);
  });

  test('language share and filters', () => {
    const cands = [...Array(10)].map((_, i) => c('en', 1990 + i, i + 1)).concat([...Array(10)].map((_, i) => c('he', 1990 + i, i + 1)));
    const r = selectBatch(cands, { size: 6, languageShare: { he: 2, en: 1 } });
    assert.deepEqual(r.counts.byLanguage, { en: 2, he: 4 });
    const he = selectBatch(cands, { size: 50, languages: ['he'], fromYear: 1992, toYear: 1995 });
    assert.equal(he.chosen.length, 4);
    assert.equal(he.counts.leftOut['language-not-requested'], 10);
    assert.equal(he.counts.leftOut['outside-year-range'], 6);
  });

  test('requested decades only, with weights; default language share follows availability', () => {
    const cands = [c('en', 1961, 1), c('en', 1962, 2), c('en', 1971, 1), c('en', 1972, 2), c('en', 1981, 1)];
    const r = selectBatch(cands, { size: 3, decadeShare: { 1960: 2, 1970: 1 } });
    assert.deepEqual(r.chosen.map((x) => x.firstChartYear), [1961, 1962, 1971]);
    assert.equal(r.counts.leftOut['decade-not-requested'], 1);
  });

  test('a merged candidate with more chart entries wins a rank tie; result is deterministic', () => {
    const one = c('en', 1990, 3);
    const two = c('en', 1990, 3, { charts: [{}, {}] });
    assert.deepEqual(selectBatch([one, two], { size: 1 }).chosen, [two]);
    assert.deepEqual(selectBatch([two, one], { size: 1 }).chosen, [two]);
  });
});
