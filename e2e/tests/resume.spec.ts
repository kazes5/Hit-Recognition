import { expect, test } from '@playwright/test';
import {
  addPlayer,
  freshStart,
  mockSongQueue,
  placeAndReveal,
  readScores,
  readTokens,
  song,
  tid,
  timelineIds,
  waitForTurn,
} from './helpers';

/**
 * PLAN §5: "an unfinished game is saved in the browser so it can be resumed".
 * NOTE: `btn-resume` is not (yet) listed in CONTRACTS §6 — it is the testid the lead asked e2e to use.
 */
test('reload mid-game → btn-resume restores players, timelines, scores and current player', async ({ page }) => {
  const q = [
    song(601, 1990, 'Resume A', 'Start A'),
    song(602, 2000, 'Resume B', 'Start B'),
    song(603, 1970, 'Resume C', 'Turn C'), // Alice, correct before 1990
    song(604, 2015, 'Resume D', 'Turn D'), // Bob
    song(605, 1980, 'Resume E', 'Turn E'),
    song(606, 1960, 'Resume F', 'Turn F'),
    song(607, 2020, 'Resume G', 'Turn G'),
  ];
  await mockSongQueue(page, q);
  await freshStart(page);
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Bob');
  await tid(page, 'input-target-score').fill('7');
  await tid(page, 'input-target-score').blur();
  await tid(page, 'btn-start-game').click();

  await waitForTurn(page, 'Alice');
  expect(await placeAndReveal(page, 0)).toBe(true);
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Bob');
  const bobTimeline = await timelineIds(page);
  const scores = await readScores(page);
  expect(scores).toEqual({ Alice: 2, Bob: 1 });
  // Tokens & bets is on by default: +1 token for Alice's card.
  const tokens = await readTokens(page);
  expect(tokens).toEqual({ Alice: 2, Bob: 1 });

  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  await expect(tid(page, 'btn-resume')).toBeVisible();
  await tid(page, 'btn-resume').click();

  await waitForTurn(page, 'Bob');
  expect(await timelineIds(page)).toEqual(bobTimeline);
  expect(await readScores(page)).toEqual(scores);
  expect(await readTokens(page)).toEqual(tokens);

  // Game continues normally; Alice still has her two cards.
  await placeAndReveal(page, 1);
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Alice');
  expect(await timelineIds(page)).toEqual([603, 601]);
});

test('no resume button without a saved game; finished game is not resumable', async ({ page }) => {
  await mockSongQueue(page, [
    song(701, 1990, 'Fin A', 'A'),
    song(702, 1970, 'Fin B', 'B'),
    song(703, 1980, 'Fin C', 'C'),
    song(704, 2000, 'Fin D', 'D'),
  ]);
  await freshStart(page);
  await expect(tid(page, 'btn-resume')).toHaveCount(0);

  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Solo');
  await tid(page, 'input-target-score').fill('3');
  await tid(page, 'input-target-score').blur();
  await tid(page, 'btn-start-game').click();
  for (const idx of [0, 1]) {
    await waitForTurn(page, 'Solo');
    expect(await placeAndReveal(page, idx)).toBe(true); // 1970 before 1990, then 1980 between
    await tid(page, 'btn-next').click();
  }
  await expect(tid(page, 'screen-winner')).toBeVisible();
  await expect(tid(page, 'winner-name')).toContainText('Solo');
  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  await expect(tid(page, 'btn-resume')).toHaveCount(0);
});
