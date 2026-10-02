import { expect, test, type Page } from '@playwright/test';
import { freshStart, mockSongQueue, recordNextTraffic, song, startGame, tid, waitForTurn } from './helpers';

/** Contract: CONTRACTS §6 — default English, Hebrew = <html dir="rtl" lang="he">, persisted in hitster.lang. */

const HEBREW = /[֐-׿]/;

async function htmlAttrs(page: Page): Promise<{ dir: string; lang: string }> {
  return page.evaluate(() => ({
    dir: document.documentElement.getAttribute('dir') ?? 'ltr',
    lang: document.documentElement.getAttribute('lang') ?? '',
  }));
}

async function openSettings(page: Page): Promise<void> {
  await tid(page, 'btn-settings').click();
  await expect(tid(page, 'screen-settings')).toBeVisible();
}

async function backHome(page: Page): Promise<void> {
  await tid(page, 'btn-back').click();
  await expect(tid(page, 'screen-home')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('defaults to English LTR', async ({ page }) => {
  const { dir, lang } = await htmlAttrs(page);
  expect(dir).toBe('ltr');
  expect(lang).toMatch(/^en/);
  await expect(tid(page, 'btn-new-game')).not.toContainText(HEBREW);
});

test('switch to Hebrew → RTL + Hebrew labels, persists after reload, switch back to English', async ({ page }) => {
  await mockSongQueue(page, [
    song(901, 1985, 'Artist One', 'Title One'),
    song(902, 1999, 'Artist Two', 'Title Two'),
    song(903, 2008, 'Artist Three', 'Title Three'),
  ]);
  const englishNewGame = (await tid(page, 'btn-new-game').innerText()).trim();

  await openSettings(page);
  await tid(page, 'btn-lang-he').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(tid(page, 'screen-settings')).toContainText(HEBREW);
  expect(await page.evaluate(() => localStorage.getItem('hitster.lang'))).toBe('he');

  await backHome(page);
  await expect(tid(page, 'btn-new-game')).toContainText(HEBREW);
  await expect(tid(page, 'btn-new-game')).not.toHaveText(englishNewGame);
  await expect(tid(page, 'btn-settings')).toContainText(HEBREW);

  // Persists across reload.
  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(tid(page, 'btn-new-game')).toContainText(HEBREW);

  // Timeline stays chronological left→right in RTL.
  await startGame(page, ['דנה']);
  await waitForTurn(page);
  await expect(tid(page, 'timeline')).toHaveAttribute('dir', 'ltr');
  await expect(tid(page, 'btn-reveal')).toContainText(HEBREW);

  // Switch back to English (reload clears the in-progress screen; go home via fresh load).
  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
  await openSettings(page);
  await tid(page, 'btn-lang-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
  expect((await htmlAttrs(page)).dir).toBe('ltr');
  expect(await page.evaluate(() => localStorage.getItem('hitster.lang'))).toBe('en');
  await backHome(page);
  await expect(tid(page, 'btn-new-game')).toHaveText(englishNewGame);
});

test('timeline is dir="ltr" in English too', async ({ page }) => {
  await mockSongQueue(page, [song(911, 1985, 'A', 'T1'), song(912, 2008, 'B', 'T2')]);
  await startGame(page, ['Alice']);
  await expect(tid(page, 'timeline')).toHaveAttribute('dir', 'ltr');
});

test('song-language setting is persisted and sent to /api/songs/next', async ({ page }) => {
  await openSettings(page);
  await tid(page, 'btn-songs-he').click();
  expect(await page.evaluate(() => localStorage.getItem('hitster.songLanguages'))).toBe('he');
  await tid(page, 'btn-songs-en').click();
  expect(await page.evaluate(() => localStorage.getItem('hitster.songLanguages'))).toBe('en');
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('hitster.songLanguages'))).toBe('en');
  await expect(tid(page, 'screen-home').or(tid(page, 'screen-settings'))).toBeVisible();
  if (await tid(page, 'screen-settings').isHidden()) await openSettings(page);
  await tid(page, 'btn-songs-both').click();
  expect(await page.evaluate(() => localStorage.getItem('hitster.songLanguages'))).toBe('both');

  // English-only songs → requests ask for ['en'] and only English songs come back.
  await tid(page, 'btn-songs-en').click();
  await backHome(page);
  const traffic = recordNextTraffic(page);
  await startGame(page, ['Alice', 'Bob']);
  expect(traffic.requests.length).toBeGreaterThan(0);
  for (const r of traffic.requests) expect(r.languages).toEqual(['en']);
  for (const s of traffic.songs) expect(s.language).toBe('en');
});
