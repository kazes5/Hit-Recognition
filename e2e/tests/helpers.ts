import { expect, type Locator, type Page, type Route } from '@playwright/test';

export type Language = 'he' | 'en';

/** The public song (CONTRACTS §4): genre and difficulty stay on the server. */
export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number;
  language: Language;
}

export interface NextRequestBody {
  excludeIds?: number[];
  excludeArtists?: string[];
  languages?: Language[];
  /** Settings → Difficulty: 1 easy, 2 medium, 3 hard. */
  maxDifficulty?: 1 | 2 | 3;
}

export const tid = (page: Page | Locator, id: string): Locator => page.getByTestId(id);

export function song(id: number, year: number, artist: string, title: string, language: Language = 'en'): Song {
  return { id, year, artist, title, language };
}

export interface SongQueueMock {
  /** Every body POSTed to /api/songs/next, in order. */
  requests: NextRequestBody[];
  /** Every song served, in order. */
  served: Song[];
  /** Ids for which /preview was requested. */
  previewRequests: number[];
}

/**
 * Serves a fixed queue of songs from /api/songs/next (skipping songs the client
 * already excludes) and answers /api/songs/:id/preview with the mock audio
 * (or null for ids in `nullPreviewIds`). Responds 404 NO_SONGS_LEFT once the
 * queue is exhausted.
 */
export async function mockSongQueue(
  page: Page,
  queue: Song[],
  opts: { nullPreviewIds?: number[] } = {},
): Promise<SongQueueMock> {
  const state: SongQueueMock = { requests: [], served: [], previewRequests: [] };
  let cursor = 0;
  const nullIds = new Set(opts.nullPreviewIds ?? []);

  await page.route('**/api/songs/next', async (route: Route) => {
    let body: NextRequestBody = {};
    try {
      body = (route.request().postDataJSON() as NextRequestBody) ?? {};
    } catch {
      body = {};
    }
    state.requests.push(body);
    const excluded = new Set(body.excludeIds ?? []);
    while (cursor < queue.length && excluded.has(queue[cursor].id)) cursor++;
    if (cursor >= queue.length) {
      await route.fulfill({ status: 404, json: { error: 'NO_SONGS_LEFT', message: 'queue exhausted' } });
      return;
    }
    const next = queue[cursor++];
    state.served.push(next);
    await route.fulfill({ status: 200, json: { song: next } });
  });

  await page.route('**/api/songs/*/preview', async (route: Route) => {
    const m = /\/api\/songs\/(\d+)\/preview/.exec(route.request().url());
    const id = m ? Number(m[1]) : NaN;
    state.previewRequests.push(id);
    await route.fulfill({ status: 200, json: { previewUrl: nullIds.has(id) ? null : '/api/mock-audio' } });
  });

  return state;
}

export interface GuessCall {
  id: number;
  artist?: string;
  title?: string;
}

export type GuessJudge = (call: GuessCall) => { artistCorrect: boolean; titleCorrect: boolean };

/** Lower case, punctuation as spaces: a small stand-in for the server's tolerant matching. */
export function loose(text: string | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Answers POST /api/songs/:id/guess (the e2e songs are fake, so the real server
 * would answer 404). By default a field is right when it equals the song's
 * artist/title after `loose()`; pass `judge` to choose the booleans.
 * Returns every call, in order.
 */
export async function mockGuess(page: Page, songs: Song[], judge?: GuessJudge): Promise<GuessCall[]> {
  const calls: GuessCall[] = [];
  const byId = new Map(songs.map((s) => [s.id, s]));
  await page.route('**/api/songs/*/guess', async (route: Route) => {
    const id = Number(/\/api\/songs\/(\d+)\/guess/.exec(route.request().url())?.[1]);
    let body: { artist?: string; title?: string } = {};
    try {
      body = (route.request().postDataJSON() as typeof body) ?? {};
    } catch {
      body = {};
    }
    const call: GuessCall = { id, artist: body.artist, title: body.title };
    calls.push(call);
    const s = byId.get(id);
    if (!s) {
      await route.fulfill({ status: 404, json: { error: 'SONG_NOT_FOUND', message: 'no such song' } });
      return;
    }
    const answer = judge
      ? judge(call)
      : {
          artistCorrect: loose(call.artist) !== '' && loose(call.artist) === loose(s.artist),
          titleCorrect: loose(call.title) !== '' && loose(call.title) === loose(s.title),
        };
    await route.fulfill({ status: 200, json: answer });
  });
  return calls;
}

/** Collects bodies sent to /api/songs/next and songs returned (works with or without mocks). */
export function recordNextTraffic(page: Page): { requests: NextRequestBody[]; songs: Song[] } {
  const rec = { requests: [] as NextRequestBody[], songs: [] as Song[] };
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/songs\/next$/.test(new URL(req.url()).pathname)) {
      let body: NextRequestBody = {};
      try {
        body = (req.postDataJSON() as NextRequestBody) ?? {};
      } catch {
        body = {};
      }
      rec.requests.push(body);
    }
  });
  page.on('response', async (res) => {
    if (/\/api\/songs\/next$/.test(new URL(res.url()).pathname) && res.status() === 200) {
      try {
        const json = (await res.json()) as { song: Song };
        rec.songs.push(json.song);
      } catch {
        /* ignore */
      }
    }
  });
  return rec;
}

/** Clear persisted app state before the first navigation of a test. */
export async function freshStart(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(tid(page, 'screen-home')).toBeVisible();
}

/** Adds a player via the setup form (button click, or Enter if the button is disabled). */
export async function addPlayer(page: Page, name: string): Promise<void> {
  const input = tid(page, 'input-player-name');
  await input.fill(name);
  const btn = tid(page, 'btn-add-player');
  if (await btn.isEnabled()) {
    await btn.click();
  } else {
    await input.press('Enter');
  }
}

export async function setTargetScore(page: Page, target: number): Promise<void> {
  const input = tid(page, 'input-target-score');
  await input.fill(String(target));
  await input.blur();
}

/** On the setup screen: turns the "Tokens & bets" switch on or off (it is on by default). */
export async function setTokensAndBets(page: Page, on: boolean): Promise<void> {
  const toggle = tid(page, 'toggle-tokens-bets');
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on));
}

export interface StartOptions {
  /** The Setup switch. Left alone (default: on) when undefined. */
  tokensAndBets?: boolean;
}

/** Home → setup → add players → (target) → (switch) → start; waits for the first turn. */
export async function startGame(page: Page, names: string[], target?: number, opts: StartOptions = {}): Promise<void> {
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'screen-setup')).toBeVisible();
  for (const n of names) await addPlayer(page, n);
  await expect(tid(page, 'player-item')).toHaveCount(names.length);
  if (target !== undefined) await setTargetScore(page, target);
  if (opts.tokensAndBets !== undefined) await setTokensAndBets(page, opts.tokensAndBets);
  await tid(page, 'btn-start-game').click();
  await waitForTurn(page);
}

export async function waitForTurn(page: Page, playerName?: string): Promise<void> {
  await expect(tid(page, 'screen-turn')).toBeVisible();
  await expect(tid(page, 'hidden-card')).toBeVisible();
  await expect(tid(page, 'timeline')).toBeVisible();
  if (playerName) await expect(tid(page, 'current-player-name')).toHaveText(new RegExp(escapeRe(playerName)));
}

/** Taps play (as a real user must, for mobile autoplay rules) if the button is there. */
export async function tapPlay(page: Page): Promise<void> {
  const play = tid(page, 'btn-play');
  if (await play.isVisible()) await play.click();
}

export function slot(page: Page, index: number): Locator {
  return tid(page, 'timeline').locator(`[data-testid="timeline-slot"][data-index="${index}"]`);
}

export interface NameGuess {
  artist?: string;
  title?: string;
}

export interface BetPlan extends NameGuess {
  /** Index of the bettor in the player list (`data-player` of `btn-bettor`). */
  player: number;
  /** Slot of the current player's timeline to bet on (only used when the bettor is allowed). */
  slot: number;
}

export interface PlaceOptions {
  /** The current player's names, typed before Lock in. */
  name?: NameGuess;
  /** Bettors, in the order they grab the phone. */
  bets?: BetPlan[];
}

/** Opens "Name artist + title" (if closed) and types the names. */
export async function typeNames(page: Page, name: NameGuess): Promise<void> {
  const toggle = tid(page, 'btn-name-it');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  if (name.artist !== undefined) await tid(page, 'input-guess-artist').fill(name.artist);
  if (name.title !== undefined) await tid(page, 'input-guess-title').fill(name.title);
}

/**
 * Taps Lock in (with optional names) and waits for what comes next:
 * the betting round (`betting`) or the result straight away (`result`).
 */
export async function lockIn(page: Page, name?: NameGuess): Promise<'betting' | 'result'> {
  if (name) await typeNames(page, name);
  await expect(tid(page, 'btn-lock-in')).toBeEnabled();
  await tid(page, 'btn-lock-in').click();
  await expect(tid(page, 'bet-panel').or(tid(page, 'revealed-card'))).toBeVisible();
  return (await tid(page, 'bet-panel').isVisible()) ? 'betting' : 'result';
}

export function bettorButton(page: Page, player: number): Locator {
  return page.locator(`[data-testid="btn-bettor"][data-player="${player}"]`);
}

/** "Who's betting?": the bettor taps their own name. */
export async function startBettor(page: Page, player: number): Promise<void> {
  await expect(bettorButton(page, player)).not.toHaveAttribute('aria-disabled', 'true');
  await bettorButton(page, player).click();
  await expect(tid(page, 'btn-check-guess')).toBeVisible();
}

/** The bettor types names and taps Check. Returns whether they may bet. */
export async function checkBettorName(page: Page, name: NameGuess): Promise<boolean> {
  if (name.artist !== undefined) await tid(page, 'input-guess-artist').fill(name.artist);
  if (name.title !== undefined) await tid(page, 'input-guess-title').fill(name.title);
  await tid(page, 'btn-check-guess').click();
  const allowed = tid(page, 'bet-allowed');
  await expect(allowed.or(tid(page, 'bet-denied'))).toBeVisible();
  return allowed.isVisible();
}

/** An allowed bettor picks a free slot and taps "Bet 1 token"; back on "Who's betting?". */
export async function placeBet(page: Page, slotIndex: number): Promise<void> {
  await slot(page, slotIndex).click();
  await expect(tid(page, 'btn-place-bet')).toBeEnabled();
  await tid(page, 'btn-place-bet').click();
  await expect(tid(page, 'bet-allowed')).toHaveCount(0);
}

/** One bettor's whole try. Returns whether they were allowed (and so bet). */
export async function bet(page: Page, plan: BetPlan): Promise<boolean> {
  await startBettor(page, plan.player);
  const allowed = await checkBettorName(page, plan);
  if (allowed) await placeBet(page, plan.slot);
  else await tid(page, 'btn-bet-ok').click();
  await expect(tid(page, 'btn-bettor').first()).toBeVisible();
  return allowed;
}

/** "Skip song · 3", then confirms. */
export async function skipSong(page: Page): Promise<void> {
  await tid(page, 'btn-skip-song').click();
  await expect(tid(page, 'skip-confirm')).toBeVisible();
  await tid(page, 'btn-confirm-skip').click();
  await expect(tid(page, 'skip-confirm')).toHaveCount(0);
}

/** Waits for the result screen; returns whether the current player's placement was correct. */
export async function readResult(page: Page): Promise<boolean> {
  await expect(tid(page, 'revealed-card')).toBeVisible();
  const correct = tid(page, 'result-correct');
  const wrong = tid(page, 'result-wrong');
  await expect(correct.or(wrong)).toBeVisible();
  return correct.isVisible();
}

/** Taps Reveal (on the turn screen or at the end of the betting round). */
export async function reveal(page: Page): Promise<boolean> {
  await expect(tid(page, 'btn-reveal')).toBeEnabled();
  await tid(page, 'btn-reveal').click();
  return readResult(page);
}

/**
 * Selects the slot and reveals the card. Works with the "Tokens & bets" switch
 * off (Reveal) and on (Lock in, optional names and bets, then Reveal from the
 * betting round; or the card is revealed at once when nobody can bet).
 * Returns whether the current player's placement was correct.
 */
export async function placeAndReveal(page: Page, index: number, opts: PlaceOptions = {}): Promise<boolean> {
  // A spot picked while the song is still loading is cleared when it arrives (e.g. right after a skip).
  await expect(page.getByText(/Loading a song…|טוענים שיר…/)).toHaveCount(0);
  await slot(page, index).click();
  const lock = tid(page, 'btn-lock-in');
  const revealBtn = tid(page, 'btn-reveal');
  await expect(lock.or(revealBtn)).toBeEnabled();
  if (!(await lock.isVisible())) {
    if (opts.bets?.length) throw new Error('placeAndReveal: bets given, but nobody can bet');
    // Nobody could bet: names can still be typed (they earn a token); Reveal checks them first.
    if (opts.name) await typeNames(page, opts.name);
    return reveal(page);
  }
  const next = await lockIn(page, opts.name);
  if (next === 'result') {
    if (opts.bets?.length) throw new Error('placeAndReveal: bets given, but the card was revealed at Lock in');
    return readResult(page);
  }
  for (const plan of opts.bets ?? []) await bet(page, plan);
  return reveal(page);
}

export async function timelineIds(page: Page): Promise<number[]> {
  const cards = tid(page, 'timeline').getByTestId('timeline-card');
  return (await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-song-id')))));
}

export async function timelineYears(page: Page): Promise<number[]> {
  const cards = tid(page, 'timeline').getByTestId('timeline-card');
  return (await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-year')))));
}

async function readScoreboard(page: Page, attr: 'data-score' | 'data-tokens'): Promise<Record<string, number>> {
  await tid(page, 'btn-scoreboard').click();
  await expect(tid(page, 'scoreboard')).toBeVisible();
  const rows = tid(page, 'scoreboard').getByTestId('score-row');
  const entries = await rows.evaluateAll(
    (els, a) => els.map((e) => [e.getAttribute('data-player') ?? '', Number(e.getAttribute(a))] as const),
    attr,
  );
  await tid(page, 'btn-close-scoreboard').click();
  await expect(tid(page, 'scoreboard')).toBeHidden();
  return Object.fromEntries(entries);
}

/** Cards per player, from the scoreboard's `data-score`. */
export async function readScores(page: Page): Promise<Record<string, number>> {
  return readScoreboard(page, 'data-score');
}

/** Tokens per player, from the scoreboard's `data-tokens` (switch on only). */
export async function readTokens(page: Page): Promise<Record<string, number>> {
  return readScoreboard(page, 'data-tokens');
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Correct placement slot for `year` on a sorted timeline (first valid slot). */
export function correctSlot(years: number[], year: number): number {
  const sorted = [...years].sort((a, b) => a - b);
  let i = 0;
  while (i < sorted.length && sorted[i] < year) i++;
  return i;
}
