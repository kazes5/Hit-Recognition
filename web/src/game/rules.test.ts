import { describe, expect, it } from 'vitest';
import { song } from '../test/fixtures';
import {
  addUsedArtist,
  addUsedId,
  canStartGame,
  decadeOf,
  findWinners,
  hasReachedTarget,
  insertCard,
  isPlacementCorrect,
  isValidTarget,
  leaders,
  nextPlayerIndex,
  normalizeName,
  score,
  sortTimeline,
  validateNewPlayerName,
} from './rules';
import type { Player } from './types';

const years = (cards: { year: number }[]) => cards.map((c) => c.year);

describe('sortTimeline', () => {
  it('sorts ascending by year and keeps equal years stable', () => {
    const a = song(2000, { id: 1 });
    const b = song(1990, { id: 2 });
    const c = song(2000, { id: 3 });
    const sorted = sortTimeline([a, b, c]);
    expect(sorted.map((s) => s.id)).toEqual([2, 1, 3]);
  });

  it('does not mutate the input', () => {
    const input = [song(2000), song(1990)];
    const copy = [...input];
    sortTimeline(input);
    expect(input).toEqual(copy);
  });
});

describe('isPlacementCorrect', () => {
  const timeline = [song(1965), song(2003), song(2010)];

  it('accepts any slot on an empty timeline (both neighbours missing)', () => {
    expect(isPlacementCorrect([], 0, 1999)).toBe(true);
  });

  it('rejects out-of-range slots on an empty timeline', () => {
    expect(isPlacementCorrect([], 1, 1999)).toBe(false);
    expect(isPlacementCorrect([], -1, 1999)).toBe(false);
  });

  it('slot 0 has no lower bound', () => {
    expect(isPlacementCorrect(timeline, 0, 1900)).toBe(true);
    expect(isPlacementCorrect(timeline, 0, 1965)).toBe(true);
    expect(isPlacementCorrect(timeline, 0, 1966)).toBe(false);
  });

  it('last slot (n) has no upper bound', () => {
    expect(isPlacementCorrect(timeline, 3, 2030)).toBe(true);
    expect(isPlacementCorrect(timeline, 3, 2010)).toBe(true);
    expect(isPlacementCorrect(timeline, 3, 2009)).toBe(false);
  });

  it('middle slots need prev <= year <= next', () => {
    expect(isPlacementCorrect(timeline, 1, 1980)).toBe(true);
    expect(isPlacementCorrect(timeline, 1, 1964)).toBe(false);
    expect(isPlacementCorrect(timeline, 1, 2004)).toBe(false);
    expect(isPlacementCorrect(timeline, 2, 2005)).toBe(true);
  });

  it('equal year counts as correct on either side of the card', () => {
    expect(isPlacementCorrect(timeline, 1, 2003)).toBe(true); // before 2003
    expect(isPlacementCorrect(timeline, 2, 2003)).toBe(true); // after 2003
    expect(isPlacementCorrect(timeline, 0, 2003)).toBe(false);
    expect(isPlacementCorrect(timeline, 3, 2003)).toBe(false);
  });

  it('handles several cards of the same year', () => {
    const same = [song(1990), song(1990), song(1990)];
    for (let i = 0; i <= 3; i++) expect(isPlacementCorrect(same, i, 1990)).toBe(true);
    expect(isPlacementCorrect(same, 1, 1991)).toBe(false);
    expect(isPlacementCorrect(same, 3, 1991)).toBe(true);
    expect(isPlacementCorrect(same, 0, 1989)).toBe(true);
  });

  it('works with an unsorted input timeline', () => {
    const unsorted = [song(2010), song(1965), song(2003)];
    expect(isPlacementCorrect(unsorted, 1, 1980)).toBe(true);
    expect(isPlacementCorrect(unsorted, 0, 1980)).toBe(false);
  });

  it('rejects slots beyond n and non-integers', () => {
    expect(isPlacementCorrect(timeline, 4, 2030)).toBe(false);
    expect(isPlacementCorrect(timeline, 1.5, 1980)).toBe(false);
  });

  it('single card: before and after', () => {
    const one = [song(2000)];
    expect(isPlacementCorrect(one, 0, 1999)).toBe(true);
    expect(isPlacementCorrect(one, 1, 1999)).toBe(false);
    expect(isPlacementCorrect(one, 1, 2001)).toBe(true);
    expect(isPlacementCorrect(one, 0, 2001)).toBe(false);
  });
});

describe('insertCard', () => {
  it('inserts in chronological order', () => {
    const t = insertCard([song(1965), song(2010)], song(2003));
    expect(years(t)).toEqual([1965, 2003, 2010]);
  });

  it('inserts at the start and the end', () => {
    expect(years(insertCard([song(2000)], song(1950)))).toEqual([1950, 2000]);
    expect(years(insertCard([song(2000)], song(2020)))).toEqual([2000, 2020]);
  });

  it('inserts into an empty timeline', () => {
    expect(years(insertCard([], song(1977)))).toEqual([1977]);
  });

  it('places equal years after existing ones', () => {
    const first = song(2000, { id: 1 });
    const t = insertCard([first], song(2000, { id: 2 }));
    expect(t.map((s) => s.id)).toEqual([1, 2]);
  });

  it('does not mutate the original timeline', () => {
    const original = [song(2000)];
    insertCard(original, song(1990));
    expect(original).toHaveLength(1);
  });
});

describe('turn rotation', () => {
  it('advances and wraps around', () => {
    expect(nextPlayerIndex(0, 3)).toBe(1);
    expect(nextPlayerIndex(1, 3)).toBe(2);
    expect(nextPlayerIndex(2, 3)).toBe(0);
  });

  it('a single player always plays', () => {
    expect(nextPlayerIndex(0, 1)).toBe(0);
  });

  it('is safe with no players', () => {
    expect(nextPlayerIndex(0, 0)).toBe(0);
  });
});

describe('scoring and winners', () => {
  const p = (name: string, n: number): Player => ({
    name,
    timeline: Array.from({ length: n }, (_, i) => song(1960 + i)),
  });

  it('score is the timeline length', () => {
    expect(score(p('A', 0))).toBe(0);
    expect(score(p('A', 4))).toBe(4);
  });

  it('reaching exactly the target wins', () => {
    expect(hasReachedTarget(p('A', 10), 10)).toBe(true);
    expect(hasReachedTarget(p('A', 9), 10)).toBe(false);
    expect(hasReachedTarget(p('A', 11), 10)).toBe(true);
  });

  it('findWinners prefers players who reached the target', () => {
    const players = [p('A', 3), p('B', 5), p('C', 4)];
    expect(findWinners(players, 5).map((x) => x.name)).toEqual(['B']);
  });

  it('findWinners falls back to leaders (ties included) when ended early', () => {
    const players = [p('A', 3), p('B', 4), p('C', 4)];
    expect(findWinners(players, 10).map((x) => x.name)).toEqual(['B', 'C']);
  });

  it('leaders of no players is empty', () => {
    expect(leaders([])).toEqual([]);
    expect(findWinners([], 10)).toEqual([]);
  });
});

describe('player names and target', () => {
  it('normalizes whitespace', () => {
    expect(normalizeName('  Dana   Levi ')).toBe('Dana Levi');
  });

  it('rejects empty and whitespace names', () => {
    expect(validateNewPlayerName('', [])).toBe('empty');
    expect(validateNewPlayerName('   ', [])).toBe('empty');
  });

  it('rejects duplicates case-insensitively', () => {
    expect(validateNewPlayerName(' dana ', ['Dana'])).toBe('duplicate');
    expect(validateNewPlayerName('נועה', ['נועה'])).toBe('duplicate');
  });

  it('rejects more than 10 players', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `P${i}`);
    expect(validateNewPlayerName('New', ten)).toBe('tooMany');
    expect(validateNewPlayerName('New', ten.slice(0, 9))).toBeNull();
  });

  it('validates the target range 3–30', () => {
    expect(isValidTarget(3)).toBe(true);
    expect(isValidTarget(30)).toBe(true);
    expect(isValidTarget(2)).toBe(false);
    expect(isValidTarget(31)).toBe(false);
    expect(isValidTarget(5.5)).toBe(false);
    expect(isValidTarget(Number.NaN)).toBe(false);
  });

  it('canStartGame needs 1–10 unique non-empty names and a valid target', () => {
    expect(canStartGame([], 10)).toBe(false);
    expect(canStartGame(['A'], 10)).toBe(true);
    expect(canStartGame(['A', 'a'], 10)).toBe(false);
    expect(canStartGame(['A', ' '], 10)).toBe(false);
    expect(canStartGame(['A'], 2)).toBe(false);
    expect(canStartGame(Array.from({ length: 11 }, (_, i) => `P${i}`), 10)).toBe(false);
  });
});

describe('used ids / artists', () => {
  it('adds ids once', () => {
    expect(addUsedId([1, 2], 2)).toEqual([1, 2]);
    expect(addUsedId([1], 2)).toEqual([1, 2]);
  });

  it('always appends artists (one entry per dealt song, no de-duplication)', () => {
    expect(addUsedArtist(['ABBA'], 'abba')).toEqual(['ABBA', 'abba']);
    expect(addUsedArtist(['ABBA'], 'ABBA')).toEqual(['ABBA', 'ABBA']);
    expect(addUsedArtist(['ABBA'], 'Queen')).toEqual(['ABBA', 'Queen']);
  });
});

describe('decadeOf', () => {
  it('buckets by decade and clamps to 1950–2020', () => {
    expect(decadeOf(1965)).toBe(1960);
    expect(decadeOf(1960)).toBe(1960);
    expect(decadeOf(2003)).toBe(2000);
    expect(decadeOf(1942)).toBe(1950);
    expect(decadeOf(2031)).toBe(2020);
  });
});
