import { expect, test } from '@playwright/test';
import {
  freshStart,
  placeAndReveal,
  recordNextTraffic,
  startGame,
  tapPlay,
  tid,
  timelineIds,
  timelineYears,
  waitForTurn,
} from './helpers';

/**
 * Against the REAL server (mock preview provider, real catalog): no song repeats in a game,
 * and the client sends a growing excludeIds/excludeArtists list (CONTRACTS §4, §6).
 */
test('no song repeats across a multi-turn game; excludeIds grows and covers all previous songs', async ({
  page,
}) => {
  test.slow();
  const traffic = recordNextTraffic(page);
  await freshStart(page);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 20);

  const seenOnScreen: number[] = []; // every revealed card number
  const TURNS = 9;
  for (let turn = 0; turn < TURNS; turn++) {
    await waitForTurn(page);
    await tapPlay(page);
    const ids = await timelineIds(page);
    expect(new Set(ids).size, 'duplicate song on a timeline').toBe(ids.length);
    // Alternate deliberate correct and (likely) wrong placements so cards are both kept and discarded.
    const years = await timelineYears(page);
    const idx = turn % 2 === 0 ? years.length : 0;
    await placeAndReveal(page, idx);
    const numText = (await tid(page, 'revealed-card').getByTestId('card-number').innerText()).trim();
    const num = Number(/(\d+)\s*$/.exec(numText)?.[1]);
    expect(Number.isFinite(num), `card-number "${numText}" has no number`).toBe(true);
    expect(seenOnScreen, `revealed song ${num} was already played`).not.toContain(num);
    seenOnScreen.push(num);
    await tid(page, 'btn-next').click();
  }
  await waitForTurn(page);

  // All starting + revealed cards are distinct.
  const servedIds = traffic.songs.map((s) => s.id);
  expect(servedIds.length).toBeGreaterThanOrEqual(3 + TURNS);
  expect(new Set(servedIds).size, `server sent a repeated song: ${servedIds.join(',')}`).toBe(servedIds.length);
  for (const n of seenOnScreen) expect(servedIds).toContain(n);

  // Request k must exclude every song returned by requests 0..k-1, and their artists.
  expect(traffic.requests.length).toBe(traffic.songs.length);
  for (let k = 1; k < traffic.requests.length; k++) {
    const body = traffic.requests[k];
    const prev = traffic.songs.slice(0, Math.min(k, traffic.songs.length));
    const ex = body.excludeIds ?? [];
    for (const s of prev) expect(ex, `request #${k} excludeIds misses id ${s.id}`).toContain(s.id);
    expect(ex.length).toBeGreaterThanOrEqual(traffic.requests[k - 1].excludeIds?.length ?? 0);
    // Multiset check: one excludeArtists entry per previously dealt song (duplicates counted).
    const count = (list: string[]) => {
      const m = new Map<string, number>();
      for (const a of list) m.set(a.trim().toLowerCase(), (m.get(a.trim().toLowerCase()) ?? 0) + 1);
      return m;
    };
    const exCounts = count(body.excludeArtists ?? []);
    const prevCounts = count(prev.map((s) => s.artist));
    for (const [artist, c] of prevCounts)
      expect(exCounts.get(artist) ?? 0, `request #${k} excludeArtists count for "${artist}"`).toBe(c);
  }
  // At most 2 songs by the same performer per game.
  const artistTotals = new Map<string, number>();
  for (const s of traffic.songs) {
    const a = s.artist.trim().toLowerCase();
    artistTotals.set(a, (artistTotals.get(a) ?? 0) + 1);
  }
  for (const [a, c] of artistTotals) expect(c, `artist "${a}" dealt ${c} times`).toBeLessThanOrEqual(2);

  // Sanity: every timeline seen during the game (current one) is sorted ascending by year.
  const finalYears = await timelineYears(page);
  expect(finalYears).toEqual([...finalYears].sort((a, b) => a - b));
});
