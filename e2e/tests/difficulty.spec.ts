import { expect, test, type Page } from '@playwright/test';
import { freshStart, mockSongQueue, placeAndReveal, song, startGame, tid, waitForTurn } from './helpers';

/** Settings → Difficulty (SONG_PIPELINE task 1.6): saved in hitster.difficulty, sent as maxDifficulty. */

const QUEUE = [
  song(951, 1960, 'Artist A', 'Song A'),
  song(952, 1970, 'Artist B', 'Song B'),
  song(953, 1980, 'Artist C', 'Song C'),
  song(954, 1990, 'Artist D', 'Song D'),
  song(955, 2000, 'Artist E', 'Song E'),
  song(956, 2010, 'Artist F', 'Song F'),
];

async function openSettings(page: Page): Promise<void> {
  await tid(page, 'btn-settings').click();
  await expect(tid(page, 'screen-settings')).toBeVisible();
}

async function expectChosen(page: Page, chosen: 'easy' | 'medium' | 'hard'): Promise<void> {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    await expect(tid(page, `btn-difficulty-${level}`)).toHaveAttribute('aria-pressed', String(level === chosen));
  }
}

const stored = (page: Page) => page.evaluate(() => localStorage.getItem('hitster.difficulty'));

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('defaults to Easy and sends maxDifficulty 1', async ({ page }) => {
  const mock = await mockSongQueue(page, QUEUE);
  await openSettings(page);
  await expect(page.getByRole('group', { name: 'Difficulty' })).toBeVisible();
  await expectChosen(page, 'easy');
  await tid(page, 'btn-back').click();

  await startGame(page, ['Alice', 'Bob']);
  // two deals + the first turn's song
  await expect.poll(() => mock.requests.length).toBeGreaterThanOrEqual(3);
  for (const r of mock.requests) expect(r.maxDifficulty).toBe(1);
});

test('Hard is saved, survives a reload and is sent as maxDifficulty 3', async ({ page }) => {
  const mock = await mockSongQueue(page, QUEUE);
  await openSettings(page);
  await tid(page, 'btn-difficulty-medium').click();
  await expectChosen(page, 'medium');
  expect(await stored(page)).toBe('medium');
  await tid(page, 'btn-difficulty-hard').click();
  await expectChosen(page, 'hard');
  expect(await stored(page)).toBe('hard');

  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  expect(await stored(page)).toBe('hard');
  await openSettings(page);
  await expectChosen(page, 'hard');
  await tid(page, 'btn-back').click();

  await startGame(page, ['Alice', 'Bob']);
  await expect.poll(() => mock.requests.length).toBeGreaterThanOrEqual(3);
  for (const r of mock.requests) expect(r.maxDifficulty).toBe(3);
});

test('a change during a game applies to the next song', async ({ page }) => {
  const mock = await mockSongQueue(page, QUEUE);
  await startGame(page, ['Alice']);
  await expect.poll(() => mock.requests.length).toBeGreaterThanOrEqual(2);
  for (const r of mock.requests) expect(r.maxDifficulty).toBe(1);

  // Leave the game for Settings (it is saved), pick Medium, then resume.
  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  await openSettings(page);
  await tid(page, 'btn-difficulty-medium').click();
  await tid(page, 'btn-back').click();
  await tid(page, 'btn-resume').click();
  await waitForTurn(page);

  const before = mock.requests.length;
  await placeAndReveal(page, 1);
  await tid(page, 'btn-next').click();
  await waitForTurn(page);
  await expect.poll(() => mock.requests.length).toBeGreaterThan(before);
  for (const r of mock.requests.slice(before)) expect(r.maxDifficulty).toBe(2);
});

test('Hebrew labels', async ({ page }) => {
  await openSettings(page);
  await tid(page, 'btn-lang-he').click();
  await expect(page.getByRole('group', { name: 'רמת קושי' })).toBeVisible();
  await expect(tid(page, 'btn-difficulty-easy')).toHaveText('קל');
  await expect(tid(page, 'btn-difficulty-medium')).toHaveText('בינוני');
  await expect(tid(page, 'btn-difficulty-hard')).toHaveText('קשה');
});
