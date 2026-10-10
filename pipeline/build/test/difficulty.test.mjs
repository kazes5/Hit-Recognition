import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { chartScore, computeDifficulty, percentiles, unscoredIds } from '../difficulty.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

describe('helpers', () => {
  test('percentiles: 0..1, ties share the mid-rank, one value is 0.5', () => {
    assert.deepEqual([...percentiles([10, 30, 20])], [[10, 0], [20, 0.5], [30, 1]]);
    assert.deepEqual([...percentiles([5, 5, 9])], [[5, 0.25], [9, 1]]);
    assert.deepEqual([...percentiles([7])], [[7, 0.5]]);
  });
  test('chart = (21 − bestRank) / 20', () => {
    assert.equal(chartScore(1), 1);
    assert.equal(chartScore(20), 0.05);
    assert.equal(chartScore(undefined), null);
  });
});

describe('computeDifficulty', () => {
  test('ids up to 669 are always 1 and do not affect percentiles', () => {
    const songs = [
      { id: 5, language: 'he', bestRank: 20, pageViews: 1 },
      { id: 669, language: 'en' },
      { id: 700, language: 'he', bestRank: 1, pageViews: 10 },
      { id: 701, language: 'he', bestRank: 20, pageViews: 1000 },
    ];
    const d = computeDifficulty(songs);
    assert.equal(d.get(5).difficulty, 1);
    assert.equal(d.get(669).difficulty, 1);
    assert.equal(d.get(5).score, null);
    // 700: fame 0, chart 1 → 0.4; 701: fame 1, chart 0.05 → 0.62
    close(d.get(700).score, 0.4);
    close(d.get(701).score, 0.62);
    assert.equal(d.get(701).difficulty, 1);
    assert.equal(d.get(700).difficulty, 2);
  });

  test('fame = mean of available percentiles; score = 0.6 fame + 0.4 chart', () => {
    const d = computeDifficulty([
      { id: 1001, language: 'en', bestRank: 11, pageViews: 100, deezerRank: 900000 },
      { id: 1002, language: 'en', bestRank: 11, pageViews: 200, deezerRank: 100 },
      { id: 1003, language: 'en', bestRank: 11, pageViews: 300 },
    ]);
    close(d.get(1001).fame, (0 + 1) / 2);
    close(d.get(1002).fame, (0.5 + 0) / 2);
    close(d.get(1003).fame, 1);
    close(d.get(1003).chart, 0.5);
    close(d.get(1003).score, 0.6 + 0.2);
  });

  test('one input only uses that input; none → 2 and listed', () => {
    const d = computeDifficulty([
      { id: 800, language: 'en', bestRank: 1 },
      { id: 801, language: 'en', pageViews: 5 },
      { id: 802, language: 'en' },
    ]);
    close(d.get(800).score, 1);
    assert.equal(d.get(800).fame, null);
    close(d.get(801).score, 0.5);
    assert.equal(d.get(801).chart, null);
    assert.deepEqual(d.get(802), { difficulty: 2, score: null, fame: null, chart: null, unscored: true });
    assert.deepEqual(unscoredIds(d), [802]);
  });

  test('thirds per language, independent of the other language', () => {
    const songs = [];
    for (let i = 0; i < 9; i++) songs.push({ id: 1000 + i, language: 'en', bestRank: i + 1, pageViews: 1000 - i });
    for (let i = 0; i < 3; i++) songs.push({ id: 2000 + i, language: 'he', bestRank: 20, pageViews: i });
    const d = computeDifficulty(songs);
    assert.deepEqual(songs.filter((s) => s.language === 'en').map((s) => d.get(s.id).difficulty), [1, 1, 1, 2, 2, 2, 3, 3, 3]);
    assert.deepEqual([2000, 2001, 2002].map((id) => d.get(id).difficulty), [3, 2, 1]);
  });

  test('small languages: 1 song is easy, 2 songs are easy and medium', () => {
    const one = computeDifficulty([{ id: 900, language: 'he', bestRank: 15, pageViews: 3 }]);
    assert.equal(one.get(900).difficulty, 1);
    const two = computeDifficulty([
      { id: 901, language: 'he', bestRank: 15, pageViews: 3 },
      { id: 902, language: 'he', bestRank: 2, pageViews: 300 },
    ]);
    assert.equal(two.get(902).difficulty, 1);
    assert.equal(two.get(901).difficulty, 2);
  });

  test('ties are broken by id, independent of input order', () => {
    const songs = [903, 901, 902].map((id) => ({ id, language: 'en', bestRank: 5 }));
    const a = computeDifficulty(songs);
    const b = computeDifficulty([...songs].reverse());
    assert.deepEqual([901, 902, 903].map((id) => a.get(id).difficulty), [1, 2, 3]);
    assert.deepEqual([...a].sort(), [...b].sort());
  });
});
