import { expect, test, type Page } from '@playwright/test';
import {
  bet,
  bettorButton,
  checkBettorName,
  freshStart,
  lockIn,
  mockGuess,
  mockSongQueue,
  placeAndReveal,
  placeBet,
  readScores,
  readTokens,
  reveal,
  slot,
  song,
  startBettor,
  startGame,
  tapPlay,
  tid,
  timelineIds,
  typeNames,
  waitForTurn,
  type Song,
} from './helpers';

/**
 * Tokens, naming and bets (docs/TOKENS_AND_BETS.md, docs/CONTRACTS.md §6 and §8).
 * Songs come from a fixed queue (`page.route`). The e2e songs are fake, so
 * /api/songs/:id/guess is mocked too (`mockGuess`): by default a field is right
 * when it equals the song's artist/title, ignoring case and punctuation. One
 * test uses real catalog songs and the real server's matching.
 */

/** Start cards for Alice (1990), Bob (2000) and Carol (1970). */
const START = [
  song(901, 1990, 'Start Alice', 'Start A'),
  song(902, 2000, 'Start Bob', 'Start B'),
  song(903, 1970, 'Start Carol', 'Start C'),
];

function outcomeRow(page: Page, outcome: string) {
  return page.locator(`[data-testid="outcome-row"][data-outcome="${outcome}"]`);
}

async function expectTokens(page: Page, tokens: number): Promise<void> {
  await expect(tid(page, 'current-player-tokens')).toHaveAttribute('data-tokens', String(tokens));
}

async function expectNoSideScroll(page: Page, where: string): Promise<void> {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(m.sw, `${where}: page scrolls sideways (${m.sw} > ${m.iw})`).toBeLessThanOrEqual(m.iw);
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('the Setup switch is on by default and remembered on the phone', async ({ page }) => {
  await tid(page, 'btn-new-game').click();
  const toggle = tid(page, 'toggle-tokens-bets');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('hitster.tokensAndBets'))).toBe('off');
  await page.reload();
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'toggle-tokens-bets')).toHaveAttribute('aria-checked', 'false');
});

test('tokens start at 1, +1 only for a right spot with the artist or the title named, never above 5', async ({ page }) => {
  const turns = [1991, 1992, 1993, 1994, 1995, 1996, 1997].map((y, i) => song(911 + i, y, `Solo ${i}`, `Tune ${i}`));
  await mockSongQueue(page, [START[0], ...turns]);
  await mockGuess(page, turns);
  await startGame(page, ['Solo'], 10);

  // The starting card gives no token.
  await expectTokens(page, 1);
  expect(await readTokens(page)).toEqual({ Solo: 1 });

  // A wrong placement gives nothing, even with the artist named right.
  await waitForTurn(page, 'Solo');
  expect(await placeAndReveal(page, 0, { name: { artist: turns[0]!.artist } })).toBe(false); // 1991 before 1990
  await expect(tid(page, 'guess-artist-result')).toHaveAttribute('data-correct', 'true');
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Solo');
  await expectTokens(page, 1);

  // A card won without naming: still no token. Cards never earn tokens.
  expect(await placeAndReveal(page, (await timelineIds(page)).length)).toBe(true);
  await expect(outcomeRow(page, 'won')).toHaveText(/\+1 card$/);
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Solo');
  await expectTokens(page, 1);

  // A right spot with the artist named right: +1 each turn, up to 5 (nobody can bet in a 1-player game, so Reveal checks the name).
  for (const [i, expected] of [2, 3, 4, 5, 5].entries()) {
    const cards = await timelineIds(page);
    const full = expected === 5 && i === 4;
    expect(await placeAndReveal(page, cards.length, { name: { artist: turns[i + 2]!.artist } })).toBe(true);
    if (full) await expect(outcomeRow(page, 'won')).toContainText(/tokens full/i);
    await tid(page, 'btn-next').click();
    await waitForTurn(page, 'Solo');
    await expectTokens(page, expected);
  }
  expect(await readTokens(page)).toEqual({ Solo: 5 });
  expect(await readScores(page)).toEqual({ Solo: 7 });
  await tid(page, 'btn-scoreboard').click();
  await expect(tid(page, 'scoreboard').getByTestId('token-meter')).toHaveAttribute('data-tokens', '5');
  await expect(tid(page, 'scoreboard').getByTestId('token-meter')).toContainText(/max/i);
});

test('naming both right (real server matching, case and punctuation changed) reveals at once: no bets', async ({
  page,
}) => {
  // Real catalog songs, so the real /guess endpoint judges the names.
  const journey = song(84, 1981, 'Journey', "Don't Stop Believin'");
  const gnr = song(229, 1987, "Guns N' Roses", "Sweet Child o' Mine");
  await mockSongQueue(page, [START[0], START[1], journey, gnr]);
  const guessCalls: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/songs\/\d+\/guess$/.test(new URL(r.url()).pathname)) guessCalls.push(r.url());
  });
  await startGame(page, ['Alice', 'Bob'], 10);

  // Alice: right spot (1981 before 1990), both names right.
  await waitForTurn(page, 'Alice');
  await tapPlay(page);
  await slot(page, 0).click();
  expect(await lockIn(page, { artist: 'JOURNEY', title: 'dont stop believing!' })).toBe('result');
  await expect(tid(page, 'bet-panel')).toHaveCount(0);
  await expect(tid(page, 'result-correct')).toBeVisible();
  await expect(tid(page, 'result-named')).toBeVisible();
  await expect(tid(page, 'guess-artist-result')).toHaveAttribute('data-correct', 'true');
  await expect(tid(page, 'guess-title-result')).toHaveAttribute('data-correct', 'true');
  await expect(tid(page, 'btn-accept-guess')).toHaveCount(0);
  expect(guessCalls).toHaveLength(1);
  expect(await readTokens(page)).toEqual({ Alice: 2, Bob: 1 });
  await tid(page, 'btn-next').click();

  // Bob: both names right but the wrong spot (1987 after 2000): the card is out, no bets.
  await waitForTurn(page, 'Bob');
  await slot(page, 1).click();
  expect(await lockIn(page, { artist: 'guns and roses', title: 'SWEET CHILD O MINE' })).toBe('result');
  await expect(tid(page, 'result-wrong')).toBeVisible();
  await expect(tid(page, 'result-named')).toBeVisible();
  await expect(tid(page, 'result-stolen')).toHaveCount(0);
  expect(await timelineIds(page)).toEqual([START[1].id]);
  // The card is out, and a wrong spot earns no token, even with both names right.
  expect(await readTokens(page)).toEqual({ Alice: 2, Bob: 1 });
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 1 });
});

test('the guess endpoint is only called when something was typed', async ({ page }) => {
  const s1 = song(921, 1980, 'Quiet Artist', 'Quiet Title');
  await mockSongQueue(page, [...START.slice(0, 2), s1]);
  const calls = await mockGuess(page, [s1]);
  await startGame(page, ['Alice', 'Bob'], 10);
  await waitForTurn(page, 'Alice');

  // Lock in is disabled until a spot is picked.
  await expect(tid(page, 'btn-lock-in')).toBeDisabled();
  await tid(page, 'btn-name-it').click();
  await expect(tid(page, 'input-guess-artist')).toBeVisible();
  await expect(tid(page, 'btn-lock-in')).toBeDisabled();
  await slot(page, 1).click();
  // Opened, but only spaces typed: no request.
  await tid(page, 'input-guess-title').fill('   ');
  expect(await lockIn(page)).toBe('betting');
  expect(calls).toHaveLength(0);

  // A bettor: Check is disabled while nothing is typed; Cancel before Check costs no try.
  await startBettor(page, 1);
  await expect(tid(page, 'btn-check-guess')).toBeDisabled();
  await tid(page, 'input-guess-artist').fill('  ');
  await expect(tid(page, 'btn-check-guess')).toBeDisabled();
  await tid(page, 'btn-cancel-bet').click();
  await expect(bettorButton(page, 1)).not.toHaveAttribute('aria-disabled', 'true');
  expect(calls).toHaveLength(0);

  // Now Bob types a title: exactly one request, for this song, with what was typed.
  await startBettor(page, 1);
  expect(await checkBettorName(page, { title: 'Quiet Title' })).toBe(true);
  expect(calls).toEqual([{ id: s1.id, artist: '', title: 'Quiet Title' }]);
});

test('a bettor naming only the artist may bet; one naming neither may not and keeps the token; taken spots cannot be picked', async ({
  page,
}) => {
  const s1 = song(931, 2005, 'Bet Artist', 'Bet Title');
  await mockSongQueue(page, [...START, s1]);
  const calls = await mockGuess(page, [s1]);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  await waitForTurn(page, 'Alice');

  // Alice picks after 1990 (right: 2005) and does not name.
  await slot(page, 1).click();
  expect(await lockIn(page)).toBe('betting');
  await expect(tid(page, 'bet-panel')).toBeVisible();
  // Her pick is marked with her initial; it is the only marker so far.
  await expect(slot(page, 1)).toHaveAttribute('data-marker', 'pick');
  await expect(slot(page, 1)).toHaveAttribute('data-initials', 'A');
  await expect(tid(page, 'bet-legend').locator('li[data-marker="pick"]')).toContainText('Alice');

  // Carol grabs the phone first and names neither: "Not this time", her token is kept.
  await startBettor(page, 2);
  expect(await checkBettorName(page, { artist: 'Wrong Artist', title: 'Wrong Title' })).toBe(false);
  await expect(tid(page, 'bet-denied')).toBeVisible();
  await tid(page, 'btn-bet-ok').click();
  // One try per turn.
  await expect(bettorButton(page, 2)).toHaveAttribute('aria-disabled', 'true');
  await expect(bettorButton(page, 2)).toContainText(/tried/i);

  // Bob names only the artist: allowed.
  await startBettor(page, 1);
  expect(await checkBettorName(page, { artist: 'bet artist' })).toBe(true);
  // Alice's spot is taken: tapping it does not select it.
  await expect(slot(page, 1)).toHaveAttribute('aria-disabled', 'true');
  await slot(page, 1).click({ force: true });
  await expect(tid(page, 'btn-place-bet')).toBeDisabled();
  await placeBet(page, 0);
  await expect(slot(page, 0)).toHaveAttribute('data-marker', 'bet');
  await expect(slot(page, 0)).toHaveAttribute('data-initials', 'B');
  await expect(tid(page, 'bet-legend').locator('li[data-marker="bet"]')).toContainText('Bob');
  expect(calls.map((c) => c.id)).toEqual([s1.id, s1.id]);

  // Alice was right: she gets the card (no token: she did not name); Bob's wrong bet loses his token; Carol keeps hers.
  expect(await reveal(page)).toBe(true);
  await expect(outcomeRow(page, 'won')).toHaveAttribute('data-player', '0');
  await expect(outcomeRow(page, 'lost')).toHaveAttribute('data-player', '1');
  await expect(tid(page, 'result-stolen')).toHaveCount(0);
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 0, Carol: 1 });
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 1, Carol: 1 });
});

test('the answer is not in the page during betting, and the next bettor gets empty fields', async ({ page }) => {
  const secret = song(941, 1983, 'Zanzibar Quokka', 'Marmalade Typhoon');
  await mockSongQueue(page, [...START, secret]);
  await mockGuess(page, [secret]);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  await waitForTurn(page, 'Alice');

  const leaks = async (where: string) => {
    const html = await page.evaluate(() => document.body.innerHTML);
    for (const text of [secret.artist, secret.title, String(secret.year)]) {
      expect(html, `${where}: the page holds "${text}"`).not.toContain(text);
    }
  };
  await slot(page, 1).click();
  await leaks('turn');
  expect(await lockIn(page)).toBe('betting');
  await leaks('who is betting');

  await startBettor(page, 1);
  await leaks('bettor naming');
  await tid(page, 'input-guess-artist').fill(secret.artist);
  expect(await checkBettorName(page, {})).toBe(true);
  await leaks('bet allowed');
  await tid(page, 'btn-cancel-bet').click(); // after Check, the try is used

  // The next bettor sees empty fields, and Bob's typing is gone from the page.
  await startBettor(page, 2);
  await expect(tid(page, 'input-guess-artist')).toHaveValue('');
  await expect(tid(page, 'input-guess-title')).toHaveValue('');
  await leaks('second bettor');
  await tid(page, 'btn-cancel-bet').click();
  await expect(bettorButton(page, 1)).toHaveAttribute('aria-disabled', 'true');

  await reveal(page);
  await expect(tid(page, 'revealed-card').getByTestId('card-title')).toHaveText(secret.title);
});

test('bettors go in any order; the earlier right bet wins the card into their own timeline', async ({ page }) => {
  // Alice ends with [1990, 2000]; a 1990 song is then right before AND after her 1990 card.
  const q: Song[] = [
    ...START,
    song(951, 2000, 'Order A', 'Alice turn 1'), // Alice: after 1990, right (no bets placed)
    song(952, 2010, 'Order B', 'Bob turn'), // Bob: after 2000, right
    song(953, 1960, 'Order C', 'Carol turn'), // Carol: before 1970, right
    song(954, 1990, 'Twin Year', 'Shared Year'), // Alice: after 2000 → wrong
    song(955, 1950, 'Filler', 'Filler'),
  ];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  for (const [name, index] of [
    ['Alice', 1],
    ['Bob', 1],
    ['Carol', 0],
  ] as const) {
    await waitForTurn(page, name);
    expect(await placeAndReveal(page, index)).toBe(true);
    await tid(page, 'btn-next').click();
  }
  await waitForTurn(page, 'Alice');
  // Three right cards without naming: no tokens earned.
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });

  // Carol grabs the phone before Bob: seat order does not matter.
  expect(
    await placeAndReveal(page, 2, {
      bets: [
        { player: 2, title: 'shared year', slot: 1 }, // between 1990 and 2000: right
        { player: 1, artist: 'TWIN YEAR', slot: 0 }, // before 1990: also right, but later
      ],
    }),
  ).toBe(false);

  await expect(tid(page, 'result-stolen')).toContainText('Carol');
  await expect(outcomeRow(page, 'won')).toHaveAttribute('data-player', '2');
  await expect(outcomeRow(page, 'right')).toHaveAttribute('data-player', '1');
  await expect(outcomeRow(page, 'right')).toContainText('Carol');
  // The result shows Carol's timeline, with the card sorted by year (not at the spot she bet on).
  await expect(tid(page, 'timeline')).toHaveAttribute('data-owner', '2');
  expect(await timelineIds(page)).toEqual([953, 903, 954]);
  // Carol: the bet token comes back (a card earns no token). Bob: right, but later; keeps his token.
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 2, Carol: 3 });
});

test('a won bet puts the card in the bettor’s timeline, and a bettor can win the game on another player’s turn', async ({
  page,
}) => {
  const q: Song[] = [
    START[0],
    START[1],
    song(961, 1980, 'Steal One', 'First'), // Alice: after 1990 → wrong; Bob bets before 1990
    song(962, 1999, 'Bob Own', 'Wrong'), // Bob: after 2000 → wrong
    song(963, 1985, 'Steal Two', 'Second'), // Alice: after 1990 → wrong; Bob bets before
    song(964, 1950, 'Filler', 'Filler'),
  ];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob'], 3);

  await waitForTurn(page, 'Alice');
  expect(await placeAndReveal(page, 1, { bets: [{ player: 1, artist: 'Steal One', slot: 0 }] })).toBe(false);
  await expect(tid(page, 'result-stolen')).toContainText('Bob');
  await expect(tid(page, 'timeline')).toHaveAttribute('data-owner', '1');
  expect(await timelineIds(page)).toEqual([961, 902]);
  await expect(outcomeRow(page, 'won')).toHaveAttribute('data-player', '1');
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1 });
  await tid(page, 'btn-next').click();

  await waitForTurn(page, 'Bob');
  expect(await timelineIds(page)).toEqual([961, 902]);
  expect(await placeAndReveal(page, 2)).toBe(false);
  await tid(page, 'btn-next').click();

  // Bob reaches 3 cards on Alice's turn: the winner check covers every player.
  await waitForTurn(page, 'Alice');
  expect(await placeAndReveal(page, 1, { bets: [{ player: 1, title: 'second', slot: 0 }] })).toBe(false);
  await expect(tid(page, 'btn-next')).toContainText(/winner/i);
  await tid(page, 'btn-next').click();
  await expect(tid(page, 'screen-winner')).toBeVisible();
  await expect(tid(page, 'winner-name')).toContainText('Bob');
});

test('when nobody has a token left to bet, the turn goes straight to Reveal', async ({ page }) => {
  const q: Song[] = [
    START[0],
    START[1],
    song(971, 2005, 'Drain', 'One'), // Alice: after 1990, right; Bob bets before → wrong
    song(972, 1995, 'Drain', 'Two'), // Bob: after 2000 → wrong
    song(973, 2010, 'Drain', 'Three'), // Alice
  ];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob'], 10);
  await waitForTurn(page, 'Alice');
  // Bob bets on the wrong spot and loses his only token.
  expect(await placeAndReveal(page, 1, { bets: [{ player: 1, artist: 'drain', slot: 0 }] })).toBe(true);
  await expect(outcomeRow(page, 'lost')).toHaveAttribute('data-player', '1');
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 0 });
  await tid(page, 'btn-next').click();

  // Bob's turn: Alice has tokens, so Bob locks in.
  await waitForTurn(page, 'Bob');
  await expect(tid(page, 'btn-lock-in')).toBeVisible();
  expect(await placeAndReveal(page, 1)).toBe(false);
  await tid(page, 'btn-next').click();

  // Alice's turn: Bob has no token, so there is no Lock in, just Reveal. Naming is still offered
  // (with a right spot it earns a token): Reveal checks her title, and she earns +1 with no betting round.
  await waitForTurn(page, 'Alice');
  await expect(tid(page, 'btn-lock-in')).toHaveCount(0);
  await expect(tid(page, 'btn-name-it')).toBeVisible();
  expect(await placeAndReveal(page, 2, { name: { title: 'three' } })).toBe(true);
  await expect(tid(page, 'bet-panel')).toHaveCount(0);
  expect(await readTokens(page)).toEqual({ Alice: 2, Bob: 0 });
});

test('skipping a song costs 3 tokens and plays a new song', async ({ page }) => {
  const q: Song[] = [
    START[0],
    song(981, 1995, 'Skip A', 'One'),
    song(982, 1996, 'Skip B', 'Two'),
    song(983, 1997, 'Skip Me', 'Skipped'),
    song(984, 1998, 'After Skip', 'New'),
    song(985, 1999, 'Spare', 'Spare'),
  ];
  const mock = await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Solo'], 10);

  // With 1 or 2 tokens there is no skip button. Naming the artist earns the tokens.
  await waitForTurn(page, 'Solo');
  await expect(tid(page, 'btn-skip-song')).toHaveCount(0);
  expect(await placeAndReveal(page, 1, { name: { artist: 'Skip A' } })).toBe(true);
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Solo');
  await expect(tid(page, 'btn-skip-song')).toHaveCount(0);
  expect(await placeAndReveal(page, 2, { name: { artist: 'Skip B' } })).toBe(true);
  await tid(page, 'btn-next').click();

  // 3 tokens: the button shows. "Keep listening" closes the sheet at no cost.
  await waitForTurn(page, 'Solo');
  await expectTokens(page, 3);
  await expect.poll(() => mock.served.at(-1)?.id).toBe(983);
  await slot(page, 3).click();
  await tid(page, 'btn-skip-song').click();
  await expect(tid(page, 'skip-confirm')).toBeVisible();
  await tid(page, 'btn-keep-listening').click();
  await expect(tid(page, 'skip-confirm')).toHaveCount(0);
  await expectTokens(page, 3);
  await expect(slot(page, 3)).toHaveAttribute('aria-pressed', 'true');

  await tid(page, 'btn-skip-song').click();
  await tid(page, 'btn-confirm-skip').click();
  await expect(tid(page, 'skip-confirm')).toHaveCount(0);
  await expectTokens(page, 0);
  // A new song is fetched; the skipped one is marked as used; the chosen spot is cleared.
  await expect.poll(() => mock.served.at(-1)?.id).toBe(984);
  expect(mock.requests.at(-1)?.excludeIds ?? []).toContain(983);
  await expect(tid(page, 'timeline').locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(tid(page, 'btn-skip-song')).toHaveCount(0);
  expect(await placeAndReveal(page, 3)).toBe(true);
  await expect(tid(page, 'revealed-card').getByTestId('card-title')).toHaveText('New');
  // A card without naming earns nothing.
  expect(await readTokens(page)).toEqual({ Solo: 0 });
});

test('a reload in the middle of betting resumes the same round', async ({ page }) => {
  const s1 = song(991, 1980, 'Reload Artist', 'Reload Title');
  const q = [...START, s1, song(992, 2010, 'Spare', 'Spare')];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  await waitForTurn(page, 'Alice');
  await slot(page, 1).click(); // wrong: 1980 after 1990
  expect(await lockIn(page)).toBe('betting');

  const resume = async () => {
    await page.reload();
    await expect(tid(page, 'btn-resume')).toBeVisible();
    await tid(page, 'btn-resume').click();
    await expect(tid(page, 'bet-panel')).toBeVisible();
    await expect(tid(page, 'current-player-name')).toHaveText('Alice');
    await expect(slot(page, 1)).toHaveAttribute('data-marker', 'pick');
  };

  // Carol starts naming; the page reloads before she checks: back to "Who's betting?", try not used.
  await startBettor(page, 2);
  await tid(page, 'input-guess-artist').fill('Reload');
  await resume();
  await expect(tid(page, 'btn-check-guess')).toHaveCount(0);
  await expect(bettorButton(page, 2)).not.toHaveAttribute('aria-disabled', 'true');

  // Carol is denied; Bob is allowed; the page reloads while Bob picks his spot.
  await bet(page, { player: 2, artist: 'nope', slot: 0 });
  await startBettor(page, 1);
  expect(await checkBettorName(page, { artist: 'reload artist' })).toBe(true);
  await resume();
  // Same round: Bob is still allowed to bet, Carol's try is still used.
  await expect(tid(page, 'bet-allowed')).toBeVisible();
  await placeBet(page, 0);
  await expect(slot(page, 0)).toHaveAttribute('data-marker', 'bet');
  await expect(slot(page, 0)).toHaveAttribute('data-initials', 'B');
  await expect(bettorButton(page, 1)).toHaveAttribute('aria-disabled', 'true');
  await expect(bettorButton(page, 2)).toHaveAttribute('aria-disabled', 'true');

  // One more reload, then Reveal settles Bob's bet.
  await resume();
  await expect(slot(page, 0)).toHaveAttribute('data-marker', 'bet');
  expect(await reveal(page)).toBe(false);
  await expect(tid(page, 'result-stolen')).toContainText('Bob');
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });
});

test('"We accept it" settles the turn again: bet tokens back, a stolen card taken back', async ({ page }) => {
  const s1 = song(1001, 1980, 'Accept Artist', 'Accept Title');
  const q = [...START, s1, song(1002, 2010, 'Spare', 'Spare')];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  await waitForTurn(page, 'Alice');

  // Alice names the artist with a typo the app rejects, and picks the wrong spot.
  expect(
    await placeAndReveal(page, 1, {
      name: { artist: 'Acept Artist', title: 'Accept Title' },
      bets: [
        { player: 2, artist: 'accept artist', slot: 0 }, // right: Carol wins the card
      ],
    }),
  ).toBe(false);
  await expect(tid(page, 'guess-artist-result')).toHaveAttribute('data-correct', 'false');
  await expect(tid(page, 'guess-title-result')).toHaveAttribute('data-correct', 'true');
  await expect(tid(page, 'result-stolen')).toContainText('Carol');
  // Alice's title was right, but her spot was wrong: no token. Carol gets the card and her bet token back.
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });
  expect(await readScores(page)).toEqual({ Alice: 1, Bob: 1, Carol: 2 });

  await tid(page, 'btn-accept-guess').click();
  await expect(tid(page, 'btn-accept-guess')).toHaveCount(0);
  await expect(tid(page, 'result-stolen')).toHaveCount(0);
  await expect(outcomeRow(page, 'refunded')).toHaveAttribute('data-player', '2');
  // As if no bets were placed: Alice's spot was wrong, so the card is out and she earns no token.
  expect(await readTokens(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });
  expect(await readScores(page)).toEqual({ Alice: 1, Bob: 1, Carol: 1 });
  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Bob');
});

test('"We accept it" gives a lost bet token back', async ({ page }) => {
  const s1 = song(1011, 2005, 'Refund Artist', 'Refund Title');
  const q = [...START, s1, song(1012, 2010, 'Spare', 'Spare')];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await startGame(page, ['Alice', 'Bob', 'Carol'], 10);
  await waitForTurn(page, 'Alice');
  // Alice is right but her title is rejected; Bob bets on the wrong spot.
  expect(
    await placeAndReveal(page, 1, {
      name: { artist: 'Refund Artist', title: 'Refnd' },
      bets: [{ player: 1, title: 'refund title', slot: 0 }],
    }),
  ).toBe(true);
  await expect(outcomeRow(page, 'lost')).toHaveAttribute('data-player', '1');
  expect(await readTokens(page)).toEqual({ Alice: 2, Bob: 0, Carol: 1 });
  await tid(page, 'btn-accept-guess').click();
  await expect(outcomeRow(page, 'refunded')).toHaveAttribute('data-player', '1');
  expect(await readTokens(page)).toEqual({ Alice: 2, Bob: 1, Carol: 1 });
  expect(await readScores(page)).toEqual({ Alice: 2, Bob: 1, Carol: 1 });
});

test('Hebrew at 360×640: no sideways scroll on any betting screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const s1 = song(1021, 1980, 'שלמה ארצי', 'גבר הולך לאיבוד', 'he');
  const q = [...START, s1, song(1022, 2010, 'Spare', 'Spare')];
  await mockSongQueue(page, q);
  await mockGuess(page, q);
  await tid(page, 'btn-settings').click();
  await tid(page, 'btn-lang-he').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await tid(page, 'btn-back').click();
  await startGame(page, ['דנה בת-שבע אלמוג', 'יוסי', 'Bartholomew-Maximilian'], 10);
  await waitForTurn(page);
  await expectNoSideScroll(page, 'turn');

  await slot(page, 1).click();
  await typeNames(page, { artist: 'שלמה', title: 'שיר אחר' });
  await expectNoSideScroll(page, 'naming');
  expect(await lockIn(page)).toBe('betting');
  await expectNoSideScroll(page, 'who is betting');

  await startBettor(page, 2);
  await tid(page, 'input-guess-artist').fill('לא נכון');
  await expectNoSideScroll(page, 'bettor naming');
  expect(await checkBettorName(page, {})).toBe(false);
  await expectNoSideScroll(page, 'bet denied');
  await tid(page, 'btn-bet-ok').click();

  await startBettor(page, 1);
  expect(await checkBettorName(page, { artist: s1.artist })).toBe(true);
  await slot(page, 0).click();
  await expectNoSideScroll(page, 'bet allowed');
  await tid(page, 'btn-place-bet').click();
  await expectNoSideScroll(page, 'all bets in');

  expect(await reveal(page)).toBe(false);
  await expect(tid(page, 'result-stolen')).toBeVisible();
  await expectNoSideScroll(page, 'won bet');
  await tid(page, 'btn-accept-guess').click();
  await expectNoSideScroll(page, 'accepted');
});
