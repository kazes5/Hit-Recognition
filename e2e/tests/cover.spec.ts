import { expect, test, type Page } from '@playwright/test';
import { addPlayer, freshStart, mockSongQueue, placeAndReveal, song, tapPlay, tid, waitForTurn } from './helpers';

/** Contract: docs/CONTRACTS.md §7 (cover picture only after Reveal). */

const Q = [
  song(101, 1990, 'Whitney Houston', 'Greatest Love Of All'),
  song(102, 2000, 'Coldplay', 'Yellow'),
  song(103, 1965, 'James Brown', 'I Got You (I Feel Good)'),
  song(104, 2010, 'Katy Perry', 'Firework'),
  song(105, 1985, 'Prince', 'When Doves Cry'),
];

type CoverMode = { coverUrl: string | null } | { status: number };

/** Routes cover requests; records requested song ids and every request URL. */
async function mockCover(page: Page, mode: CoverMode | ((id: number) => CoverMode)) {
  const coverIds: number[] = [];
  await page.route('**/api/songs/*/cover', async (route) => {
    const id = Number(/\/api\/songs\/(\d+)\/cover/.exec(route.request().url())?.[1]);
    coverIds.push(id);
    const m = typeof mode === 'function' ? mode(id) : mode;
    if ('status' in m) await route.fulfill({ status: m.status, json: { error: 'BOOM', message: 'x' } });
    else await route.fulfill({ status: 200, json: { coverUrl: m.coverUrl } });
  });
  return coverIds;
}

async function begin(page: Page): Promise<void> {
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Alice');
  await addPlayer(page, 'Bob');
  await tid(page, 'input-target-score').fill('10');
  await tid(page, 'input-target-score').blur();
  await tid(page, 'btn-start-game').click();
  await waitForTurn(page, 'Alice');
}

test.beforeEach(async ({ page }) => {
  await freshStart(page);
});

test('no cover request and no cover image before Reveal', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => {
    if (/\/(cover|mock-cover)/.test(new URL(r.url()).pathname)) urls.push(r.url());
  });
  await mockSongQueue(page, Q);
  await mockCover(page, { coverUrl: '/api/mock-cover' });
  await begin(page);
  await tapPlay(page);
  await tid(page, 'timeline').getByTestId('timeline-slot').first().click();
  await expect(tid(page, 'cover-image')).toHaveCount(0);
  await expect(tid(page, 'cover-wrap')).toHaveCount(0);
  expect(urls).toEqual([]);
});

test('cover shown and loaded after Reveal; requested for that song only; not carried to next turn', async ({
  page,
}) => {
  await mockSongQueue(page, Q);
  const ids = await mockCover(page, { coverUrl: '/api/mock-cover' });
  await begin(page);
  await placeAndReveal(page, 0);
  await expect(tid(page, 'cover-wrap')).toBeVisible();
  const img = tid(page, 'cover-image');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  expect(ids).toEqual([Q[2].id]);

  await tid(page, 'btn-next').click();
  await waitForTurn(page, 'Bob');
  await expect(tid(page, 'cover-image')).toHaveCount(0);
  await expect(tid(page, 'cover-wrap')).toHaveCount(0);
  expect(ids).toEqual([Q[2].id]);
});

const failing: [string, CoverMode][] = [
  ['null coverUrl', { coverUrl: null }],
  ['500 response', { status: 500 }],
  ['unloadable image url', { coverUrl: '/api/no-such-image.png' }],
];
for (const [name, mode] of failing) {
  test(`no cover element and Next still works: ${name}`, async ({ page }) => {
    await mockSongQueue(page, Q);
    await mockCover(page, mode);
    await begin(page);
    await placeAndReveal(page, 0);
    await expect(tid(page, 'btn-next')).toBeVisible();
    // Allow the cover request/image load to settle, then assert nothing is rendered.
    await page.waitForTimeout(1000);
    await expect(tid(page, 'cover-wrap')).toHaveCount(0);
    await expect(tid(page, 'cover-image')).toHaveCount(0);
    await tid(page, 'btn-next').click();
    await waitForTurn(page, 'Bob');
  });
}

test('result screen with cover has no page scroll or horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockSongQueue(page, Q);
  await mockCover(page, { coverUrl: '/api/mock-cover' });
  await begin(page);
  await placeAndReveal(page, 0);
  const img = tid(page, 'cover-image');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(m.sh).toBeLessThanOrEqual(m.ih);
  expect(m.sw).toBeLessThanOrEqual(m.iw);
});
