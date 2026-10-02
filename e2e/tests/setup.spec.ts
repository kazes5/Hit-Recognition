import { expect, test } from '@playwright/test';
import { addPlayer, freshStart, mockSongQueue, setTargetScore, song, tid } from './helpers';

/** Contract: docs/CONTRACTS.md §6 (Home + Setup). */

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('home shows New Game and Settings; New Game opens setup', async ({ page }) => {
  await expect(tid(page, 'btn-new-game')).toBeVisible();
  await expect(tid(page, 'btn-settings')).toBeVisible();
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'screen-setup')).toBeVisible();
  await expect(tid(page, 'screen-home')).toBeHidden();
});

test('start is disabled with 0 players and enabled with ≥1', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'player-item')).toHaveCount(0);
  await expect(tid(page, 'btn-start-game')).toBeDisabled();
  await addPlayer(page, 'Alice');
  await expect(tid(page, 'player-item')).toHaveCount(1);
  await expect(tid(page, 'player-item')).toContainText('Alice');
  await expect(tid(page, 'btn-start-game')).toBeEnabled();
});

test('add and remove players', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  for (const n of ['Alice', 'Bob', 'Carol']) await addPlayer(page, n);
  await expect(tid(page, 'player-item')).toHaveCount(3);
  await expect(tid(page, 'player-item').nth(0)).toContainText('Alice');
  await expect(tid(page, 'player-item').nth(1)).toContainText('Bob');
  await expect(tid(page, 'player-item').nth(2)).toContainText('Carol');
  // input is cleared after a successful add
  await expect(tid(page, 'input-player-name')).toHaveValue('');

  await tid(page, 'player-item').filter({ hasText: 'Bob' }).getByTestId('btn-remove-player').click();
  await expect(tid(page, 'player-item')).toHaveCount(2);
  await expect(tid(page, 'player-item').filter({ hasText: 'Bob' })).toHaveCount(0);

  await tid(page, 'player-item').filter({ hasText: 'Alice' }).getByTestId('btn-remove-player').click();
  await tid(page, 'player-item').filter({ hasText: 'Carol' }).getByTestId('btn-remove-player').click();
  await expect(tid(page, 'player-item')).toHaveCount(0);
  await expect(tid(page, 'btn-start-game')).toBeDisabled();
});

test('empty and whitespace-only names are rejected', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, '');
  await addPlayer(page, '    ');
  await expect(tid(page, 'player-item')).toHaveCount(0);
  await expect(tid(page, 'btn-start-game')).toBeDisabled();
});

test('duplicate names are rejected', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Alice');
  await expect(tid(page, 'player-item')).toHaveCount(1);
  // surrounding whitespace does not make a name unique
  await addPlayer(page, '  Alice  ');
  await expect(tid(page, 'player-item')).toHaveCount(1);
});

test('at most 10 players', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  for (let i = 1; i <= 10; i++) await addPlayer(page, `Player ${i}`);
  await expect(tid(page, 'player-item')).toHaveCount(10);
  // An 11th player cannot be added: either the form is disabled, or the add is rejected.
  const input = tid(page, 'input-player-name');
  const btn = tid(page, 'btn-add-player');
  if ((await input.isEnabled()) && (await btn.isEnabled())) {
    await addPlayer(page, 'Player 11');
  } else if (await input.isEnabled()) {
    await input.fill('Player 11');
    await expect(btn).toBeDisabled();
    await input.press('Enter');
  }
  await expect(tid(page, 'player-item')).toHaveCount(10);
  await expect(tid(page, 'player-item').filter({ hasText: 'Player 11' })).toHaveCount(0);
});

test('Hebrew player names are accepted', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'דנה');
  await expect(tid(page, 'player-item')).toContainText('דנה');
});

test('target score defaults to 10 and can be changed', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'input-target-score')).toHaveValue('10');
  await setTargetScore(page, 3);
  await expect(tid(page, 'input-target-score')).toHaveValue('3');
  await setTargetScore(page, 20);
  await expect(tid(page, 'input-target-score')).toHaveValue('20');
});

test('starting a game deals one revealed card to each player', async ({ page }) => {
  await mockSongQueue(page, [
    song(11, 1980, 'Start Artist A', 'Start Title A'),
    song(12, 1995, 'Start Artist B', 'Start Title B'),
    song(13, 2005, 'Turn Artist', 'Turn Title'),
  ]);
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Bob');
  await tid(page, 'btn-start-game').click();
  await expect(tid(page, 'screen-turn')).toBeVisible();
  await expect(tid(page, 'current-player-name')).toContainText('Alice');
  const cards = tid(page, 'timeline').getByTestId('timeline-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-song-id', '11');
  await expect(cards.first()).toHaveAttribute('data-year', '1980');
});

test('target score outside 3–20 cannot start a game', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  for (const bad of [2, 21]) {
    await setTargetScore(page, bad);
    const value = Number(await tid(page, 'input-target-score').inputValue());
    // Either the value is clamped into range, or starting is blocked.
    if (value === bad) await expect(tid(page, 'btn-start-game'), `target ${bad}`).toBeDisabled();
    else expect(value).toBeGreaterThanOrEqual(3), expect(value).toBeLessThanOrEqual(20);
  }
  await setTargetScore(page, 5);
  await expect(tid(page, 'btn-start-game')).toBeEnabled();
});
