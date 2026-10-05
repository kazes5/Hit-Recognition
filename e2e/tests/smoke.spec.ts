import { expect, test, type Page } from '@playwright/test';
import { addPlayer, freshStart, placeAndReveal, tapPlay, tid, waitForTurn } from './helpers';

/**
 * Smoke tests: safe to run against a live deployment (`E2E_BASE_URL=https://… npm run smoke`).
 * Read-only and light: a handful of requests, no catalog draining, no mocked routes.
 * Every screen is attached as a screenshot to the HTML report (nothing in e2e/screenshots is overwritten).
 */

async function snap(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('API: health and catalog stats', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });

  const stats = await request.get('/api/songs/stats');
  expect(stats.status()).toBe(200);
  const body = (await stats.json()) as { total: number; byLanguage: Record<string, number> };
  expect(body.total).toBeGreaterThan(0);
  expect(body.byLanguage.he).toBeGreaterThan(0);
  expect(body.byLanguage.en).toBeGreaterThan(0);
});

for (const lang of ['en', 'he'] as const) {
  test(`screens render (${lang}): home, settings, setup`, async ({ page }) => {
    await freshStart(page);
    await tid(page, 'btn-settings').click();
    await expect(tid(page, 'screen-settings')).toBeVisible();
    await tid(page, `btn-lang-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    await snap(page, `${lang}-settings`);

    await tid(page, 'btn-back').click();
    await expect(tid(page, 'screen-home')).toBeVisible();
    await snap(page, `${lang}-home`);

    await tid(page, 'btn-new-game').click();
    await expect(tid(page, 'screen-setup')).toBeVisible();
    await snap(page, `${lang}-setup`);

    // No horizontal page scroll at this viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('one real turn: deal, preview loads, reveal, cover', async ({ page }) => {
  const previews: { status: number; previewUrl: string | null }[] = [];
  page.on('response', async (res) => {
    if (/\/api\/songs\/\d+\/preview$/.test(new URL(res.url()).pathname)) {
      const body = (await res.json().catch(() => ({}))) as { previewUrl?: string | null };
      previews.push({ status: res.status(), previewUrl: body.previewUrl ?? null });
    }
  });

  await freshStart(page);
  await tid(page, 'btn-new-game').click();
  await addPlayer(page, 'Smoke');
  await tid(page, 'btn-start-game').click();
  await waitForTurn(page, 'Smoke');
  await snap(page, 'turn');

  // A preview must be found for the hidden song (songs without one are skipped by the app).
  await expect.poll(() => previews.some((p) => p.status === 200 && p.previewUrl)).toBe(true);
  const url = previews.find((p) => p.previewUrl)!.previewUrl!;
  const audio = await page.request.get(new URL(url, page.url()).toString(), { headers: { Range: 'bytes=0-1023' } });
  expect([200, 206]).toContain(audio.status());

  await tapPlay(page);
  await placeAndReveal(page, 0);
  await expect(tid(page, 'card-year')).toHaveText(/\d{4}/);
  await expect(tid(page, 'card-artist')).not.toBeEmpty();

  // The cover is optional (none found → nothing rendered), but when shown it must actually load.
  const img = tid(page, 'cover-image');
  await page.waitForLoadState('networkidle');
  if ((await img.count()) > 0) {
    await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  } else {
    test.info().annotations.push({ type: 'note', description: 'no cover shown for this song' });
  }
  await snap(page, 'result');
});
