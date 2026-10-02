import { expect, type Locator, type Page, type Route } from '@playwright/test';

export type Language = 'he' | 'en';

export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number;
  language: Language;
  genre: 'pop' | 'rock' | 'light-rock' | 'classic-rock';
}

export interface NextRequestBody {
  excludeIds?: number[];
  excludeArtists?: string[];
  languages?: Language[];
}

export const tid = (page: Page | Locator, id: string): Locator => page.getByTestId(id);

export function song(id: number, year: number, artist: string, title: string, language: Language = 'en'): Song {
  return { id, year, artist, title, language, genre: 'pop' };
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

/** Home → setup → add players → (target) → start; waits for the first turn. */
export async function startGame(page: Page, names: string[], target?: number): Promise<void> {
  await tid(page, 'btn-new-game').click();
  await expect(tid(page, 'screen-setup')).toBeVisible();
  for (const n of names) await addPlayer(page, n);
  await expect(tid(page, 'player-item')).toHaveCount(names.length);
  if (target !== undefined) await setTargetScore(page, target);
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

/** Selects the slot and presses Reveal. Returns whether the result was correct. */
export async function placeAndReveal(page: Page, index: number): Promise<boolean> {
  await slot(page, index).click();
  await expect(tid(page, 'btn-reveal')).toBeEnabled();
  await tid(page, 'btn-reveal').click();
  await expect(tid(page, 'revealed-card')).toBeVisible();
  const correct = tid(page, 'result-correct');
  const wrong = tid(page, 'result-wrong');
  await expect(correct.or(wrong)).toBeVisible();
  return correct.isVisible();
}

export async function timelineIds(page: Page): Promise<number[]> {
  const cards = tid(page, 'timeline').getByTestId('timeline-card');
  return (await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-song-id')))));
}

export async function timelineYears(page: Page): Promise<number[]> {
  const cards = tid(page, 'timeline').getByTestId('timeline-card');
  return (await cards.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-year')))));
}

export async function readScores(page: Page): Promise<Record<string, number>> {
  await tid(page, 'btn-scoreboard').click();
  await expect(tid(page, 'scoreboard')).toBeVisible();
  const rows = tid(page, 'scoreboard').getByTestId('score-row');
  const entries = await rows.evaluateAll((els) =>
    els.map((e) => [e.getAttribute('data-player') ?? '', Number(e.getAttribute('data-score'))] as const),
  );
  await tid(page, 'btn-close-scoreboard').click();
  await expect(tid(page, 'scoreboard')).toBeHidden();
  return Object.fromEntries(entries);
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
