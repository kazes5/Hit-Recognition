import { expect, test, type Page } from '@playwright/test';
import {
  addPlayer,
  freshStart,
  mockSongQueue,
  placeAndReveal,
  readScores,
  setTokensAndBets,
  slot,
  song,
  tapPlay,
  tid,
  timelineIds,
  timelineYears,
  waitForTurn,
  type Song,
} from './helpers';

/**
 * Deterministic gameplay: /api/songs/next and /preview are served from a fixed queue.
 * These games turn the "Tokens & bets" switch OFF, so they test the classic rules
 * (place, Reveal, Next). The token, naming and betting flow is in betting.spec.ts.
 * Contract: docs/CONTRACTS.md §6.
 */

const S = {
  aliceStart: song(101, 1990, 'Whitney Houston', 'Greatest Love Of All'),
  bobStart: song(102, 2000, 'Coldplay', 'Yellow'),
  t1: song(103, 1965, 'James Brown', 'I Got You (I Feel Good)'),
  t2: song(104, 2010, 'Katy Perry', 'Firework'),
  t3: song(105, 1990, 'Sinead O Connor', 'Nothing Compares 2 U'),
  t4: song(106, 1977, 'Fleetwood Mac', 'Dreams'),
  t5: song(107, 1984, 'Prince', 'When Doves Cry'),
};

async function startTwoPlayers(page: Page, target = 3): Promise<void> {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Bob');
  await tid(page, 'input-target-score').fill(String(target));
  await tid(page, 'input-target-score').blur();
  await setTokensAndBets(page, false);
  await tid(page, 'btn-start-game').click();
}

async function expectHidden(page: Page, s: Song, opts: { yearOnTimeline?: boolean } = {}): Promise<void> {
  // Neither the hidden card nor anything else visible on screen may leak the song.
  const hidden = tid(page, 'hidden-card');
  await expect(hidden).toBeVisible();
  for (const text of [s.artist, s.title, String(s.year)]) {
    await expect(hidden, `hidden card leaks "${text}"`).not.toContainText(text);
    // The year may legitimately be visible on an existing timeline card with the same year.
    if (text === String(s.year) && opts.yearOnTimeline) continue;
    await expect(
      page.getByText(text, { exact: false }).filter({ visible: true }),
      `page shows "${text}" before reveal`,
    ).toHaveCount(0);
  }
  await expect(tid(page, 'revealed-card')).toHaveCount(0);
  await expect(tid(page, 'result-correct')).toHaveCount(0);
  await expect(tid(page, 'result-wrong')).toHaveCount(0);
}

async function expectRevealed(page: Page, s: Song): Promise<void> {
  const card = tid(page, 'revealed-card');
  await expect(card.getByTestId('card-artist')).toHaveText(s.artist);
  await expect(card.getByTestId('card-year')).toHaveText(String(s.year));
  await expect(card.getByTestId('card-title')).toHaveText(s.title);
  await expect(card.getByTestId('card-number')).toContainText(new RegExp(`\\b${s.id}\\b`));
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('full game: start cards, hidden card, reveal gating, correct/wrong, rotation, scoreboard, winner', async ({
  page,
}) => {
  const mock = await mockSongQueue(page, [S.aliceStart, S.bobStart, S.t1, S.t2, S.t3, S.t4, S.t5]);
  await startTwoPlayers(page, 3);

  // --- Turn 1: Alice, song 1965 -------------------------------------------
  await waitForTurn(page, 'Alice');
  // Starting card is revealed on Alice's timeline.
  let cards = tid(page, 'timeline').getByTestId('timeline-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-song-id', String(S.aliceStart.id));
  await expect(cards.first()).toHaveAttribute('data-year', '1990');
  await expect(cards.first()).toContainText('1990');
  await expectHidden(page, S.t1);
  await expect(tid(page, 'speaker')).toBeVisible();
  // Switch off: no tokens, no naming, no Lock in, no skipping.
  for (const id of ['current-player-tokens', 'btn-name-it', 'btn-lock-in', 'btn-skip-song']) {
    await expect(tid(page, id), `${id} with the switch off`).toHaveCount(0);
  }
  await tapPlay(page);

  // One card → two slots (0 = before, 1 = after).
  await expect(tid(page, 'timeline').getByTestId('timeline-slot')).toHaveCount(2);
  await expect(tid(page, 'btn-reveal')).toBeDisabled();
  await slot(page, 0).click();
  await expect(tid(page, 'btn-reveal')).toBeEnabled();
  await tid(page, 'btn-reveal').click();
  await expect(tid(page, 'result-correct')).toBeVisible();
  await expect(tid(page, 'result-wrong')).toHaveCount(0);
  await expectRevealed(page, S.t1);
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 1 });
  await tid(page, 'btn-next').click();

  // --- Turn 2: Bob, song 2010 placed BEFORE 2000 → wrong --------------------
  await waitForTurn(page, 'Bob');
  cards = tid(page, 'timeline').getByTestId('timeline-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-song-id', String(S.bobStart.id));
  await expect(cards.first()).toContainText('2000');
  await expectHidden(page, S.t2);
  await tapPlay(page);
  expect(await placeAndReveal(page, 0)).toBe(false);
  await expect(tid(page, 'result-wrong')).toBeVisible();
  await expect(tid(page, 'result-wrong')).toContainText('2010');
  await expectRevealed(page, S.t2);
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 1 });
  await tid(page, 'btn-next').click();

  // --- Turn 3: Alice, timeline [1965, 1990]; song 1990 placed after → correct, wins
  await waitForTurn(page, 'Alice');
  expect(await timelineYears(page)).toEqual([1965, 1990]);
  expect(await timelineIds(page)).toEqual([S.t1.id, S.aliceStart.id]);
  await expectHidden(page, S.t3, { yearOnTimeline: true });
  await expect(tid(page, 'timeline').getByTestId('timeline-slot')).toHaveCount(3);
  expect(await placeAndReveal(page, 2)).toBe(true);
  expect(await readScores(page)).toEqual({ Alice: 3, Bob: 1 });
  await tid(page, 'btn-next').click();

  await expect(tid(page, 'screen-winner')).toBeVisible();
  await expect(tid(page, 'winner-name')).toContainText('Alice');
  await expect(tid(page, 'screen-turn')).toHaveCount(0);

  // Bob's discarded card never re-enters the game; every request excluded used ids.
  const servedIds = mock.served.map((s) => s.id);
  expect(new Set(servedIds).size).toBe(servedIds.length);

  // Play again goes back to a fresh start (home or setup).
  await tid(page, 'btn-play-again').click();
  await expect(tid(page, 'screen-home').or(tid(page, 'screen-setup'))).toBeVisible();
});

test('reveal button stays disabled until a slot is selected', async ({ page }) => {
  await mockSongQueue(page, [S.aliceStart, S.bobStart, S.t1, S.t2]);
  await startTwoPlayers(page);
  await waitForTurn(page, 'Alice');
  await expect(tid(page, 'btn-reveal')).toBeDisabled();
  await tapPlay(page);
  await expect(tid(page, 'btn-reveal')).toBeDisabled();
  await slot(page, 1).click();
  await expect(tid(page, 'btn-reveal')).toBeEnabled();
  // Changing the selection keeps it enabled.
  await slot(page, 0).click();
  await expect(tid(page, 'btn-reveal')).toBeEnabled();
});

test('equal year counts as correct on either side', async ({ page }) => {
  const q = [
    song(301, 1990, 'Artist Start A', 'Title Start A'),
    song(302, 2000, 'Artist Start B', 'Title Start B'),
    song(303, 1990, 'Artist Same A', 'Title Same A'), // Alice: before 1990
    song(304, 2000, 'Artist Same B', 'Title Same B'), // Bob: after 2000
    song(305, 1950, 'Artist Filler', 'Title Filler'),
  ];
  await mockSongQueue(page, q);
  await startTwoPlayers(page, 10);

  await waitForTurn(page, 'Alice');
  expect(await placeAndReveal(page, 0)).toBe(true);
  await expect(tid(page, 'result-correct')).toBeVisible();
  await tid(page, 'btn-next').click();

  await waitForTurn(page, 'Bob');
  expect(await placeAndReveal(page, 1)).toBe(true);
  await expect(tid(page, 'result-correct')).toBeVisible();
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 2 });
});

test('wrong placement discards the card', async ({ page }) => {
  await mockSongQueue(page, [S.aliceStart, S.bobStart, S.t2, S.t4, S.t1]);
  await startTwoPlayers(page, 10);
  await waitForTurn(page, 'Alice');
  // 2010 before 1990 → wrong
  expect(await placeAndReveal(page, 0)).toBe(false);
  await expect(tid(page, 'result-wrong')).toContainText('2010');
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Bob');
  await tid(page, 'btn-scoreboard').click();
  await expect(tid(page, 'score-row').and(page.locator('[data-player="Alice"]'))).toHaveAttribute('data-score', '1');
  await expect(tid(page, 'score-row').and(page.locator('[data-player="Bob"]'))).toHaveAttribute('data-score', '1');
  await tid(page, 'btn-close-scoreboard').click();
  // Bob's turn → then back to Alice; her timeline still only has her start card.
  expect(await placeAndReveal(page, 1)).toBe(false); // 1977 after 2000 → wrong
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Alice');
  expect(await timelineIds(page)).toEqual([S.aliceStart.id]);
});

test('turn rotates through all players and wraps around', async ({ page }) => {
  await mockSongQueue(page, [
    song(401, 1980, 'A1', 'T1'),
    song(402, 1981, 'A2', 'T2'),
    song(403, 1982, 'A3', 'T3'),
    song(404, 2001, 'A4', 'T4'),
    song(405, 2002, 'A5', 'T5'),
    song(406, 2003, 'A6', 'T6'),
    song(407, 2004, 'A7', 'T7'),
  ]);
  await tid(page, 'btn-new-game').click();
  for (const n of ['Alice', 'Bob', 'Carol']) await addPlayer(page, n);
  await setTokensAndBets(page, false);
  await tid(page, 'btn-start-game').click();
  for (const name of ['Alice', 'Bob', 'Carol', 'Alice']) {
    await waitForTurn(page, name);
    await placeAndReveal(page, 1);
    await tid(page, 'btn-next').click();
  }
});

test('null preview → app silently fetches another song', async ({ page }) => {
  const noPreview = song(501, 1975, 'Silent Artist', 'Silent Title');
  const playable = song(502, 1970, 'Playable Artist', 'Playable Title');
  const mock = await mockSongQueue(page, [S.aliceStart, S.bobStart, noPreview, playable, S.t2], {
    nullPreviewIds: [noPreview.id],
  });
  await startTwoPlayers(page, 10);
  await waitForTurn(page, 'Alice');
  await tapPlay(page);

  // The app must have moved on to the next song, with the skipped id marked as used.
  await expect.poll(() => mock.served.map((s) => s.id)).toContain(playable.id);
  const after = mock.requests[mock.served.findIndex((s) => s.id === playable.id)];
  expect(after.excludeIds ?? []).toContain(noPreview.id);
  await expect(tid(page, 'error-banner')).toHaveCount(0);

  expect(await placeAndReveal(page, 0)).toBe(true); // 1970 before 1990
  await expectRevealed(page, playable);
});
