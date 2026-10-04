import { expect, test, type APIRequestContext } from '@playwright/test';
import type { Song } from './helpers';

/** Contract: docs/CONTRACTS.md §4. Run with PREVIEW_PROVIDER=mock. */

function assertSong(s: Song): void {
  expect(typeof s.id).toBe('number');
  expect(typeof s.artist).toBe('string');
  expect(s.artist.length).toBeGreaterThan(0);
  expect(typeof s.title).toBe('string');
  expect(s.title.length).toBeGreaterThan(0);
  expect(Number.isInteger(s.year)).toBe(true);
  expect(s.year).toBeGreaterThanOrEqual(1900);
  expect(s.year).toBeLessThanOrEqual(new Date().getFullYear());
  expect(['he', 'en']).toContain(s.language);
  expect(['pop', 'rock', 'light-rock', 'classic-rock']).toContain(s.genre);
}

async function next(request: APIRequestContext, data: unknown) {
  return request.post('/api/songs/next', { data: data as Record<string, unknown> });
}

/** Draws every song in the catalog (excluding ids and used artists as the client does). */
async function drainCatalog(request: APIRequestContext): Promise<Song[]> {
  const songs: Song[] = [];
  const artists: string[] = [];
  for (let i = 0; i < 5000; i++) {
    const res = await next(request, { excludeIds: songs.map((s) => s.id), excludeArtists: artists });
    if (res.status() === 404) {
      expect(await res.json()).toMatchObject({ error: 'NO_SONGS_LEFT' });
      return songs;
    }
    expect(res.status()).toBe(200);
    const { song } = (await res.json()) as { song: Song };
    songs.push(song);
    if (!artists.some((a) => a.toLowerCase() === song.artist.toLowerCase())) artists.push(song.artist);
  }
  throw new Error('catalog never exhausted');
}

test.describe('API', () => {
  test('GET /api/health → 200 {status:"ok"}', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('GET /api/songs/stats has the contract shape and consistent totals', async ({ request }) => {
    const res = await request.get('/api/songs/stats');
    expect(res.status()).toBe(200);
    const stats = (await res.json()) as {
      total: number;
      byLanguage: Record<string, number>;
      byDecade: Record<string, number>;
    };
    expect(Number.isInteger(stats.total)).toBe(true);
    expect(stats.total).toBeGreaterThan(0);
    expect(typeof stats.byLanguage.he).toBe('number');
    expect(typeof stats.byLanguage.en).toBe('number');
    expect(stats.byLanguage.he + stats.byLanguage.en).toBe(stats.total);
    const decades = Object.keys(stats.byDecade);
    expect(decades.length).toBeGreaterThan(0);
    for (const d of decades) {
      expect(d).toMatch(/^\d{3}0$/);
      expect(typeof stats.byDecade[d]).toBe('number');
    }
    expect(Object.values(stats.byDecade).reduce((a, b) => a + b, 0)).toBe(stats.total);
  });

  test('POST /api/songs/next with empty body returns a valid song', async ({ request }) => {
    const res = await next(request, {});
    expect(res.status()).toBe(200);
    const { song } = (await res.json()) as { song: Song };
    assertSong(song);
  });

  test('POST /api/songs/next never returns excluded ids; drains catalog, then 404 NO_SONGS_LEFT', async ({
    request,
  }) => {
    const stats = (await (await request.get('/api/songs/stats')).json()) as { total: number };
    const songs = await drainCatalog(request);
    songs.forEach(assertSong);
    const ids = songs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // no repeats
    expect(ids.length).toBe(stats.total);
  });

  test('POST /api/songs/next prefers artists not yet used (case-insensitive)', async ({ request }) => {
    const all = await drainCatalog(request);
    // While draining with growing excludeArtists, artist credits must not repeat until (nearly) all are used.
    // The server merges credit variants that share a contributor ("Lady Gaga" / "Lady Gaga & Bradley Cooper"),
    // so the number of distinct groups is slightly below the number of distinct credit strings.
    const distinct = new Set(all.map((s) => s.artist.toLowerCase()));
    const seen = new Set<string>();
    let firstRepeat = all.length;
    for (const [i, s] of all.entries()) {
      const k = s.artist.toLowerCase();
      if (seen.has(k)) {
        firstRepeat = i;
        break;
      }
      seen.add(k);
    }
    expect(firstRepeat, 'server repeated an artist while unused artists were left').toBeGreaterThanOrEqual(
      Math.floor(distinct.size * 0.9),
    );

    // Exclude every artist but one (sent in UPPER CASE) → must get that artist.
    const byArtist = new Map<string, Song[]>();
    for (const s of all) {
      const k = s.artist.toLowerCase();
      byArtist.set(k, [...(byArtist.get(k) ?? []), s]);
    }
    const [keep] = [...byArtist.keys()];
    const excludeArtists = [...new Set(all.map((s) => s.artist))]
      .filter((a) => a.toLowerCase() !== keep)
      .map((a) => a.toUpperCase());
    for (let i = 0; i < 5; i++) {
      const res = await next(request, { excludeArtists });
      expect(res.status()).toBe(200);
      const { song } = (await res.json()) as { song: Song };
      expect(song.artist.toLowerCase()).toBe(keep);
    }

    // Falls back to a repeated artist when the only unused artist has no songs left.
    const res = await next(request, { excludeArtists, excludeIds: byArtist.get(keep)!.map((s) => s.id) });
    expect(res.status()).toBe(200);
    const { song } = (await res.json()) as { song: Song };
    expect(song.artist.toLowerCase()).not.toBe(keep);

    // Every artist excluded → still returns a song.
    const res2 = await next(request, { excludeArtists: [...distinct] });
    expect(res2.status()).toBe(200);
  });

  test('POST /api/songs/next honours languages filter', async ({ request }) => {
    const stats = (await (await request.get('/api/songs/stats')).json()) as { byLanguage: Record<string, number> };
    for (const lang of ['he', 'en'] as const) {
      if (!stats.byLanguage[lang]) continue;
      for (let i = 0; i < 5; i++) {
        const res = await next(request, { languages: [lang] });
        expect(res.status()).toBe(200);
        const { song } = (await res.json()) as { song: Song };
        expect(song.language).toBe(lang);
      }
    }
  });

  for (const [label, body] of [
    ['excludeIds not an array', { excludeIds: 'abc' }],
    ['excludeIds with non-numbers', { excludeIds: ['x', {}] }],
    ['excludeArtists not an array', { excludeArtists: 42 }],
    ['languages not an array', { languages: 'he' }],
    ['unknown language code', { languages: ['fr'] }],
  ] as const) {
    test(`POST /api/songs/next → 400 INVALID_REQUEST (${label})`, async ({ request }) => {
      const res = await next(request, body);
      expect(res.status()).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    });
  }

  test('POST /api/songs/next → 400 on malformed JSON', async ({ request }) => {
    const res = await request.post('/api/songs/next', {
      headers: { 'content-type': 'application/json' },
      data: '{"excludeIds": [1,',
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('GET /api/songs/:id/preview (mock provider) → "/api/mock-audio"', async ({ request }) => {
    const { song } = (await (await next(request, {})).json()) as { song: Song };
    const res = await request.get(`/api/songs/${song.id}/preview`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ previewUrl: '/api/mock-audio' });
  });

  test('GET /api/mock-audio is a WAV file', async ({ request }) => {
    const res = await request.get('/api/mock-audio');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('audio/wav');
    const buf = await res.body();
    expect(buf.length).toBeGreaterThan(44);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  test('GET /api/songs/:id/preview for unknown id → 404 SONG_NOT_FOUND', async ({ request }) => {
    const res = await request.get('/api/songs/987654321/preview');
    expect(res.status()).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'SONG_NOT_FOUND' });
  });

  test('GET /api/songs/:id/cover (mock provider) → "/api/mock-cover"; preview has no cover', async ({ request }) => {
    const { song } = (await (await next(request, {})).json()) as { song: Song };
    const res = await request.get(`/api/songs/${song.id}/cover`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ coverUrl: '/api/mock-cover' });
    const preview = await request.get(`/api/songs/${song.id}/preview`);
    expect(Object.keys(await preview.json())).toEqual(['previewUrl']);
  });

  test('GET /api/songs/:id/cover for unknown id → 404 SONG_NOT_FOUND', async ({ request }) => {
    const res = await request.get('/api/songs/987654321/cover');
    expect(res.status()).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'SONG_NOT_FOUND' });
  });

  test('POST /api/songs/:id/guess judges artist and title and returns only two booleans', async ({ request }) => {
    const { song } = (await (await next(request, {})).json()) as { song: Song };
    const right = await request.post(`/api/songs/${song.id}/guess`, { data: { artist: song.artist, title: song.title } });
    expect(right.status()).toBe(200);
    expect(await right.json()).toEqual({ artistCorrect: true, titleCorrect: true });

    const loose = await request.post(`/api/songs/${song.id}/guess`, {
      data: { artist: `  ${song.artist.toUpperCase()} `, title: 'zz no such song zz' },
    });
    expect(await loose.json()).toEqual({ artistCorrect: true, titleCorrect: false });

    const wrong = await request.post(`/api/songs/${song.id}/guess`, { data: {} });
    const text = await wrong.text();
    expect(JSON.parse(text)).toEqual({ artistCorrect: false, titleCorrect: false });
    expect(text).not.toContain(String(song.year));
  });

  test('POST /api/songs/:id/guess → 404 for an unknown id, 400 for a bad body', async ({ request }) => {
    const unknown = await request.post('/api/songs/987654321/guess', { data: { artist: 'ABBA' } });
    expect(unknown.status()).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: 'SONG_NOT_FOUND' });

    const { song } = (await (await next(request, {})).json()) as { song: Song };
    for (const data of [{ artist: 5 }, { title: 'x'.repeat(201) }]) {
      const res = await request.post(`/api/songs/${song.id}/guess`, { data });
      expect(res.status(), JSON.stringify(data).slice(0, 40)).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'INVALID_REQUEST' });
    }
  });

  test('GET /api/mock-cover is a non-empty SVG image', async ({ request }) => {
    const res = await request.get('/api/mock-cover');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/svg+xml');
    expect((await res.body()).length).toBeGreaterThan(0);
  });

  test('unknown /api route → 404 JSON error', async ({ request }) => {
    for (const path of ['/api/does-not-exist', '/api/songs/nope/deeper/path']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      expect(res.headers()['content-type'], path).toContain('application/json');
      const body = (await res.json()) as { error?: unknown };
      expect(typeof body.error, path).toBe('string');
    }
  });

  test('non-/api GET falls back to the SPA index.html', async ({ request }) => {
    for (const path of ['/', '/some/client/route']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('text/html');
      expect(await res.text(), path).toMatch(/<div id="root"|<html/i);
    }
  });
});
