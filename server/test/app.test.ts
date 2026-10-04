import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { MockPreviewProvider } from '../src/preview/mock.js';
import type { PreviewProvider } from '../src/preview/types.js';
import { song } from './helpers.js';

const songs = [
  song({ id: 1, artist: 'ABBA', year: 1976, language: 'en' }),
  song({ id: 2, artist: 'Queen', year: 1975, language: 'en' }),
  song({ id: 3, artist: 'אייל גולן', title: 'מי שמאמין', year: 2010, language: 'he' }),
  song({ id: 227, artist: 'James Brown', year: 1965, language: 'en' }),
];

const app = createApp({ songs, previewProvider: new MockPreviewProvider() });

describe('API', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /api/songs/stats', async () => {
    const res = await request(app).get('/api/songs/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 4, byLanguage: { he: 1, en: 3 }, byDecade: { '1960': 1, '1970': 2, '2010': 1 } });
  });

  describe('POST /api/songs/next', () => {
    it('returns a song with an empty body', async () => {
      const res = await request(app).post('/api/songs/next');
      expect(res.status).toBe(200);
      expect(songs.map((s) => s.id)).toContain(res.body.song.id);
      expect(Object.keys(res.body.song).sort()).toEqual(['artist', 'genre', 'id', 'language', 'title', 'year']);
    });

    it('respects excludeIds, excludeArtists and languages', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/songs/next')
          .send({ excludeIds: [1], excludeArtists: ['queen'], languages: ['en'] });
        expect(res.status).toBe(200);
        expect(res.body.song.id).toBe(227);
      }
    });

    it('filters to Hebrew', async () => {
      const res = await request(app).post('/api/songs/next').send({ languages: ['he'] });
      expect(res.body.song).toMatchObject({ id: 3, language: 'he' });
    });

    it('404 NO_SONGS_LEFT when everything is excluded', async () => {
      const res = await request(app).post('/api/songs/next').send({ excludeIds: [3], languages: ['he'] });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NO_SONGS_LEFT');
      expect(typeof res.body.message).toBe('string');
    });

    it.each([
      [{ excludeIds: 'x' }],
      [{ excludeIds: ['1'] }],
      [{ excludeArtists: [1] }],
      [{ languages: ['fr'] }],
      [[1, 2]],
    ])('400 INVALID_REQUEST for %j', async (body) => {
      const res = await request(app).post('/api/songs/next').send(body as object);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_REQUEST');
    });

    it('400 INVALID_REQUEST for malformed JSON', async () => {
      const res = await request(app).post('/api/songs/next').set('Content-Type', 'application/json').send('{"excludeIds": [');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_REQUEST');
    });

    it('400 INVALID_REQUEST for oversized body', async () => {
      const res = await request(app)
        .post('/api/songs/next')
        .send({ excludeArtists: Array.from({ length: 5000 }, (_, i) => `artist ${i}`) });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_REQUEST');
    });

    it('never exposes internal artistKeys and honours them', async () => {
      const withKeys = [
        { ...song({ id: 50, artist: 'Mark Ronson', title: 'Uptown Funk' }), artistKeys: ['Mark Ronson', 'Bruno Mars'] },
        song({ id: 51, artist: 'Bruno Mars' }),
        song({ id: 52, artist: 'Other' }),
      ];
      const keyed = createApp({ songs: withKeys, previewProvider: new MockPreviewProvider() });
      for (let i = 0; i < 10; i++) {
        const res = await request(keyed).post('/api/songs/next').send({ excludeIds: [52], excludeArtists: ['Bruno Mars'] });
        expect([50, 51]).toContain(res.body.song.id); // fallback: only Bruno Mars repeats left
        expect(res.body.song.artistKeys).toBeUndefined();
      }
      const res = await request(keyed).post('/api/songs/next').send({ excludeArtists: ['Mark Ronson'] });
      expect(res.body.song.id).toBe(52);
    });

    it('passes itunesTrackId to the provider but never exposes it', async () => {
      const pinned = [{ ...song({ id: 60, artist: 'A', title: 'T' }), itunesTrackId: 123 }];
      const provider: PreviewProvider = { getPreviewUrl: vi.fn(async () => 'https://a/p.m4a'), getCoverUrl: vi.fn(async () => null) };
      const pinnedApp = createApp({ songs: pinned, previewProvider: provider });
      const next = await request(pinnedApp).post('/api/songs/next').send({});
      expect(next.body.song.id).toBe(60);
      expect(next.body.song).not.toHaveProperty('itunesTrackId');
      const preview = await request(pinnedApp).get('/api/songs/60/preview');
      expect(preview.body).toEqual({ previewUrl: 'https://a/p.m4a' });
      const cover = await request(pinnedApp).get('/api/songs/60/cover');
      expect(cover.body).toEqual({ coverUrl: null });
      expect(provider.getPreviewUrl).toHaveBeenCalledWith(expect.objectContaining({ id: 60, itunesTrackId: 123 }));
      expect(provider.getCoverUrl).toHaveBeenCalledWith(expect.objectContaining({ id: 60, itunesTrackId: 123 }));
    });

    it('treats duplicated excludeArtists entries as one dealt song each (max 2 per artist)', async () => {
      const pool = [
        song({ id: 60, artist: 'A' }),
        song({ id: 61, artist: 'A' }),
        song({ id: 62, artist: 'A' }),
        song({ id: 63, artist: 'B' }),
      ];
      const capped = createApp({ songs: pool, previewProvider: new MockPreviewProvider() });
      for (const r of [0, 0.5, 0.99]) {
        const seeded = createApp({ songs: pool, previewProvider: new MockPreviewProvider(), rng: () => r });
        const res = await request(seeded).post('/api/songs/next').send({ excludeArtists: ['A', 'a'] });
        expect(res.body.song.id).toBe(63);
      }
      const one = await request(capped).post('/api/songs/next').send({ excludeIds: [63], excludeArtists: ['A'] });
      expect(one.status).toBe(200);
      const fallback = await request(capped).post('/api/songs/next').send({ excludeIds: [63, 60], excludeArtists: ['A', 'A'] });
      expect(fallback.status).toBe(200);
      expect([61, 62]).toContain(fallback.body.song.id);
    });

    it('uses the injected rng', async () => {
      const seeded = createApp({ songs, previewProvider: new MockPreviewProvider(), rng: () => 0 });
      const res = await request(seeded).post('/api/songs/next').send({});
      expect(res.body.song.id).toBe(1);
    });
  });

  describe('GET /api/songs/:id/preview', () => {
    it('returns the mock preview URL', async () => {
      const res = await request(app).get('/api/songs/227/preview');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ previewUrl: '/api/mock-audio' });
    });

    it('404 SONG_NOT_FOUND for unknown or invalid ids', async () => {
      for (const id of ['999', 'abc', '1.5']) {
        const res = await request(app).get(`/api/songs/${id}/preview`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('SONG_NOT_FOUND');
      }
    });

    it('passes the song to the provider and returns null previews', async () => {
      const provider: PreviewProvider = { getPreviewUrl: vi.fn(async () => null), getCoverUrl: async () => null };
      const res = await request(createApp({ songs, previewProvider: provider })).get('/api/songs/3/preview');
      expect(res.body).toEqual({ previewUrl: null });
      expect(provider.getPreviewUrl).toHaveBeenCalledWith(songs[2]);
    });

    it('returns null if a provider throws anyway', async () => {
      const provider: PreviewProvider = { getPreviewUrl: async () => Promise.reject(new Error('boom')), getCoverUrl: async () => null };
      const res = await request(createApp({ songs, previewProvider: provider })).get('/api/songs/1/preview');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ previewUrl: null });
    });
  });

  describe('GET /api/songs/:id/cover', () => {
    it('returns the mock cover URL', async () => {
      const res = await request(app).get('/api/songs/227/cover');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ coverUrl: '/api/mock-cover' });
    });

    it('404 SONG_NOT_FOUND for unknown or invalid ids', async () => {
      for (const id of ['999', 'abc', '1.5']) {
        const res = await request(app).get(`/api/songs/${id}/cover`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('SONG_NOT_FOUND');
      }
    });

    it('returns null for no cover and when the provider throws', async () => {
      const none: PreviewProvider = { getPreviewUrl: async () => null, getCoverUrl: vi.fn(async () => null) };
      const res = await request(createApp({ songs, previewProvider: none })).get('/api/songs/3/cover');
      expect(res.body).toEqual({ coverUrl: null });
      expect(none.getCoverUrl).toHaveBeenCalledWith(songs[2]);

      const boom: PreviewProvider = { getPreviewUrl: async () => null, getCoverUrl: async () => Promise.reject(new Error('boom')) };
      const res2 = await request(createApp({ songs, previewProvider: boom })).get('/api/songs/1/cover');
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ coverUrl: null });
    });

    it('preview response never contains the cover', async () => {
      const both: PreviewProvider = { getPreviewUrl: async () => 'https://a/p.m4a', getCoverUrl: async () => 'https://x.mzstatic.com/c.jpg' };
      const res = await request(createApp({ songs, previewProvider: both })).get('/api/songs/1/preview');
      expect(res.body).toEqual({ previewUrl: 'https://a/p.m4a' });
    });
  });

  describe('POST /api/songs/:id/guess', () => {
    it('returns exactly the two booleans for a right guess', async () => {
      const res = await request(app).post('/api/songs/3/guess').send({ artist: 'אייל גולן', title: 'מי שמאמין' });
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({ artistCorrect: true, titleCorrect: true });
    });

    it('judges each field on its own and never leaks the answer', async () => {
      const res = await request(app).post('/api/songs/3/guess').send({ artist: 'Eyal Golan', title: 'מי שמאמינ' });
      expect(res.body).toEqual({ artistCorrect: false, titleCorrect: true });
      expect(res.text).not.toMatch(/אייל|2010|Title/);
    });

    it('treats a missing body or blank fields as a wrong guess', async () => {
      const empty = await request(app).post('/api/songs/227/guess');
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ artistCorrect: false, titleCorrect: false });
      const blank = await request(app).post('/api/songs/227/guess').send({ artist: ' ', title: '' });
      expect(blank.body).toEqual({ artistCorrect: false, titleCorrect: false });
    });

    it('404 SONG_NOT_FOUND for unknown or invalid ids', async () => {
      for (const id of ['999', 'abc', '1.5']) {
        const res = await request(app).post(`/api/songs/${id}/guess`).send({ artist: 'ABBA' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('SONG_NOT_FOUND');
      }
    });

    it('400 INVALID_REQUEST for a bad body', async () => {
      for (const body of [[], { artist: 5 }, { title: null }, { artist: 'x'.repeat(201) }]) {
        const res = await request(app).post('/api/songs/1/guess').send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_REQUEST');
      }
    });

    it('accepts aliases but never exposes them', async () => {
      const aliased = [
        { ...song({ id: 70, artist: 'אייל גולן', title: 'מי שמאמין', language: 'he' }), artistAliases: ['Eyal Golan'], titleAliases: ['Mi Shemamin'] },
      ];
      const aliasApp = createApp({ songs: aliased, previewProvider: new MockPreviewProvider() });
      const guess = await request(aliasApp).post('/api/songs/70/guess').send({ artist: 'eyal golan', title: 'mi shemamin' });
      expect(guess.body).toEqual({ artistCorrect: true, titleCorrect: true });
      const next = await request(aliasApp).post('/api/songs/next').send({});
      expect(next.body.song).not.toHaveProperty('artistAliases');
      expect(next.body.song).not.toHaveProperty('titleAliases');
    });
  });

  it('GET /api/mock-cover returns a square SVG', async () => {
    const res = await request(app).get('/api/mock-cover').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/svg\+xml/);
    const svg = (res.body as Buffer).toString('utf8');
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('viewBox="0 0 300 300"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('GET /api/mock-audio returns a WAV', async () => {
    const res = await request(app).get('/api/mock-audio').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/wav');
    const body = res.body as Buffer;
    expect(body.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(body.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  it('unknown /api routes return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('non-API paths 404 when no static dir is configured', async () => {
    const res = await request(app).get('/anything');
    expect(res.status).toBe(404);
  });
});

describe('static frontend', () => {
  let dir: string;
  let staticApp: ReturnType<typeof createApp>;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'hitster-static-'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Hitster</title>');
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    staticApp = createApp({ songs, previewProvider: new MockPreviewProvider(), staticDir: dir });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('serves index.html at /', async () => {
    const res = await request(staticApp).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Hitster</title>');
  });

  it('serves assets with long cache', async () => {
    const res = await request(staticApp).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('falls back to index.html for unknown non-API GETs', async () => {
    const res = await request(staticApp).get('/some/deep/link');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<title>Hitster</title>');
  });

  it('does not fall back for /api paths', async () => {
    const res = await request(staticApp).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('is skipped when the directory does not exist', async () => {
    const missing = createApp({ songs, previewProvider: new MockPreviewProvider(), staticDir: path.join(dir, 'missing') });
    expect((await request(missing).get('/')).status).toBe(404);
    expect((await request(missing).get('/api/health')).status).toBe(200);
  });
});
