import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { addPlayer, freshStart, mockSongQueue, placeAndReveal, song, tapPlay, tid, waitForTurn } from './helpers';

/**
 * Mobile-first layout checks + full-page screenshots of every screen (committed in e2e/screenshots/
 * for design review). Size checks apply to the mobile project only.
 */

const SHOTS = path.join(__dirname, '..', 'screenshots');

async function checkScreen(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.waitForTimeout(300); // let entrance animations settle before measuring / shooting
  const isMobile = info.project.name.startsWith('mobile');
  if (isMobile) {
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect.soft(scrollWidth, `${name}: horizontal page scroll (${scrollWidth} > ${innerWidth})`).toBeLessThanOrEqual(
      innerWidth,
    );

    const buttons = await page
      .locator('[data-testid^="btn-"]')
      .filter({ visible: true })
      .evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { id: e.getAttribute('data-testid'), h: r.height, w: r.width };
        }),
      );
    for (const b of buttons) {
      expect.soft(b.h, `${name}: ${b.id} is ${b.h.toFixed(1)}px tall (< 44)`).toBeGreaterThanOrEqual(44);
      expect.soft(b.w, `${name}: ${b.id} is ${b.w.toFixed(1)}px wide (< 44)`).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({
    path: path.join(SHOTS, `${info.project.name}-${name}.jpg`),
    fullPage: true,
    scale: 'css',
    type: 'jpeg',
    quality: 80,
  });
}

async function shootAll(page: Page, info: TestInfo, lang: 'en' | 'he'): Promise<void> {
  const p = (n: string) => (lang === 'he' ? `he-${n}` : n);
  await mockSongQueue(page, [
    song(801, 1965, 'James Brown', 'I Got You (I Feel Good)'),
    song(802, 2003, 'אייל גולן', 'מי שמאמין', 'he'),
    song(803, 1984, 'Bruce Springsteen', 'Dancing in the Dark'),
    song(804, 1999, 'Britney Spears', '...Baby One More Time'),
    song(805, 1975, 'ABBA', 'Mamma Mia'),
    song(806, 2012, 'עומר אדם', 'מישהו שומר עליי', 'he'),
  ]);
  await freshStart(page);
  if (lang === 'he') {
    await tid(page, 'btn-settings').click();
    await tid(page, 'btn-lang-he').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await tid(page, 'btn-back').click();
  }
  await checkScreen(page, info, p('01-home'));

  await tid(page, 'btn-settings').click();
  await expect(tid(page, 'screen-settings')).toBeVisible();
  await checkScreen(page, info, p('02-settings'));
  await tid(page, 'btn-back').click();

  await tid(page, 'btn-new-game').click();
  await addPlayer(page, lang === 'he' ? 'דנה' : 'Alice');
  await addPlayer(page, lang === 'he' ? 'יוסי' : 'Bartholomew-Maximilian');
  await tid(page, 'input-target-score').fill('3');
  await tid(page, 'input-target-score').blur();
  await checkScreen(page, info, p('03-setup'));

  await tid(page, 'btn-start-game').click();
  await waitForTurn(page);
  await tapPlay(page);
  await checkScreen(page, info, p('04-turn'));

  await tid(page, 'timeline').locator('[data-testid="timeline-slot"][data-index="1"]').click();
  await checkScreen(page, info, p('05-turn-slot-selected'));
  await tid(page, 'btn-reveal').click();
  await expect(tid(page, 'revealed-card')).toBeVisible();
  await checkScreen(page, info, p('06-result'));

  await tid(page, 'btn-scoreboard').click();
  await expect(tid(page, 'scoreboard')).toBeVisible();
  await checkScreen(page, info, p('07-scoreboard'));
  await tid(page, 'btn-close-scoreboard').click();

  // Queue is ordered so every placement below is correct: P2 1999 before 2003, then P1 1975
  // between 1965 and 1984 → P1 reaches 3 cards → winner.
  await tid(page, 'btn-next').click();
  await waitForTurn(page);
  expect(await placeAndReveal(page, 0)).toBe(true);
  await tid(page, 'btn-next').click();
  await waitForTurn(page);
  expect(await placeAndReveal(page, 1)).toBe(true);
  await tid(page, 'btn-next').click();
  await expect(tid(page, 'screen-winner')).toBeVisible();
  await checkScreen(page, info, p('08-winner'));
}

test('mobile layout + screenshots (English)', async ({ page }, info) => {
  await shootAll(page, info, 'en');
});

test('mobile layout + screenshots (Hebrew RTL)', async ({ page }, info) => {
  await shootAll(page, info, 'he');
});
