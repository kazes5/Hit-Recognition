import path from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  addPlayer,
  bettorButton,
  checkBettorName,
  freshStart,
  lockIn,
  mockGuess,
  mockSongQueue,
  placeAndReveal,
  placeBet,
  reveal,
  slot,
  song,
  tapPlay,
  tid,
  typeNames,
  waitForTurn,
} from './helpers';

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

async function switchToHebrew(page: Page): Promise<void> {
  await tid(page, 'btn-settings').click();
  await tid(page, 'btn-lang-he').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await tid(page, 'btn-back').click();
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
  if (lang === 'he') await switchToHebrew(page);
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
  // Tokens & bets is on by default: Lock in opens the betting round; nobody bets.
  expect(await lockIn(page)).toBe('betting');
  expect(await reveal(page)).toBe(true);
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

/**
 * The tokens, naming and betting screens: naming, "Who's betting?", a bettor's naming,
 * a won bet, and the skip confirmation (docs/TOKENS_AND_BETS.md §6).
 */
async function shootBetting(page: Page, info: TestInfo, lang: 'en' | 'he'): Promise<void> {
  const p = (n: string) => (lang === 'he' ? `he-${n}` : n);
  const he = lang === 'he';
  const t1 = he
    ? song(814, 1980, 'שלמה ארצי', 'גבר הולך לאיבוד', 'he')
    : song(814, 1980, 'Queen', 'Another One Bites the Dust');
  const queue = [
    song(811, 1990, 'Whitney Houston', 'Greatest Love Of All'), // Alice's start card
    song(812, 2000, 'Coldplay', 'Yellow'), // Bart's
    song(813, 1970, 'Simon & Garfunkel', 'The Boxer'), // Carol's
    t1, // Alice places it after 1990 (wrong) and names the artist; Bart names the title, bets before 1990 and wins it
    song(815, 2010, 'Katy Perry', 'Firework'), // Bart: after 2000, names the artist → 2 tokens
    song(816, 1960, 'Elvis Presley', "It's Now or Never"), // Carol: before 1970
    song(817, 1995, 'Oasis', 'Wonderwall'), // Alice: after 1990
    song(818, 1985, 'a-ha', 'Take On Me'), // Bart: between 1980 and 2000, names the artist → 3 tokens
    song(819, 1950, 'Nat King Cole', 'Mona Lisa'), // Carol: before 1960
    song(820, 2006, 'Amy Winehouse', 'Rehab'), // Alice: after 1995
    song(821, 1974, 'ABBA', 'Waterloo'), // Bart's next turn: he skips it
    song(822, 1965, 'The Beatles', 'Help!'),
  ];
  await mockSongQueue(page, queue);
  await mockGuess(page, queue);
  await freshStart(page);
  if (he) await switchToHebrew(page);

  await tid(page, 'btn-new-game').click();
  for (const n of he ? ['דנה', 'יוסי', 'מיכל'] : ['Alice', 'Bart', 'Carol']) await addPlayer(page, n);
  await tid(page, 'input-target-score').fill('10');
  await tid(page, 'input-target-score').blur();
  await expect(tid(page, 'toggle-tokens-bets')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'btn-start-game').click();

  // Turn 1 (Alice): picks a wrong spot and names the artist only, so bets open.
  await waitForTurn(page);
  await tapPlay(page);
  await slot(page, 1).click();
  await typeNames(page, { artist: t1.artist, title: he ? 'שיר אחר' : 'Bohemian Rhapsody' });
  await checkScreen(page, info, p('09-naming'));
  expect(await lockIn(page)).toBe('betting');
  await checkScreen(page, info, p('10-who-is-betting'));

  // Bart grabs the phone. Alice got the artist right, so only the title is open: he names it and bets before 1990.
  await bettorButton(page, 1).click();
  await expect(tid(page, 'input-guess-artist')).toHaveCount(0);
  await tid(page, 'input-guess-title').fill(t1.title);
  await checkScreen(page, info, p('11-bettor-naming'));
  expect(await checkBettorName(page, {})).toBe(true);
  await placeBet(page, 0);
  await expect(tid(page, 'btn-bettor').first()).toBeVisible();

  expect(await reveal(page)).toBe(false);
  await expect(tid(page, 'result-stolen')).toBeVisible();
  await checkScreen(page, info, p('12-won-bet'));
  await tid(page, 'btn-next').click();

  // Two rounds: Bart names the artist on each of his turns (+1 token each); Carol and Alice play plain turns.
  const turns: { index: number; artist?: string }[] = [
    { index: 2, artist: 'Katy Perry' },
    { index: 0 },
    { index: 1 },
    { index: 1, artist: 'a-ha' },
    { index: 0 },
    { index: 2 },
  ];
  for (const { index, artist } of turns) {
    await waitForTurn(page);
    expect(await placeAndReveal(page, index, artist ? { name: { artist } } : {})).toBe(true);
    await tid(page, 'btn-next').click();
  }

  // Bart's turn again, with 3 tokens: "Skip song · 3" and its confirmation.
  await waitForTurn(page);
  await expect(tid(page, 'current-player-tokens')).toHaveAttribute('data-tokens', '3');
  await tid(page, 'btn-skip-song').click();
  await expect(tid(page, 'skip-confirm')).toBeVisible();
  await checkScreen(page, info, p('13-skip-confirm'));
}

test('betting screens + screenshots (English)', async ({ page }, info) => {
  await shootBetting(page, info, 'en');
});

test('betting screens + screenshots (Hebrew RTL)', async ({ page }, info) => {
  await shootBetting(page, info, 'he');
});
