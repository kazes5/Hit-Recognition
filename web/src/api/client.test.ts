import { afterEach, describe, expect, it, vi } from 'vitest';
import { song } from '../test/fixtures';
import { ApiError, checkGuess, fetchNextSong, fetchCoverUrl, fetchPreviewUrl } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('fetchNextSong', () => {
  it('POSTs the exclusions and returns the song', async () => {
    const s = song(1965, { id: 227 });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { song: s }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchNextSong({
      excludeIds: [1],
      excludeArtists: ['ABBA'],
      languages: ['he'],
      maxDifficulty: 2,
    });
    expect(result).toEqual(s);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/songs/next');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      excludeIds: [1],
      excludeArtists: ['ABBA'],
      languages: ['he'],
      maxDifficulty: 2,
    });
  });

  it('maps 404 NO_SONGS_LEFT to an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { error: 'NO_SONGS_LEFT', message: 'none' })));
    await expect(fetchNextSong({})).rejects.toMatchObject({ code: 'NO_SONGS_LEFT', status: 404 });
  });

  it('maps network failures to NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await fetchNextSong({}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('NETWORK');
  });

  it('maps 5xx without a body to NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 502 })));
    await expect(fetchNextSong({})).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('fetchPreviewUrl', () => {
  it('returns the url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { previewUrl: '/api/mock-audio' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPreviewUrl(5)).resolves.toBe('/api/mock-audio');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/songs/5/preview');
  });

  it('returns null when there is no preview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { previewUrl: null })));
    await expect(fetchPreviewUrl(5)).resolves.toBeNull();
  });

  it('throws SONG_NOT_FOUND for unknown ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { error: 'SONG_NOT_FOUND' })));
    await expect(fetchPreviewUrl(999)).rejects.toMatchObject({ code: 'SONG_NOT_FOUND' });
  });
});

describe('checkGuess', () => {
  it('POSTs the typed artist and title to the song and returns the two answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { artistCorrect: true, titleCorrect: false }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(checkGuess(42, { artist: 'Queen', title: 'Bohemian' })).resolves.toEqual({
      artistCorrect: true,
      titleCorrect: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/songs/42/guess');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ artist: 'Queen', title: 'Bohemian' });
  });

  it('sends empty fields as they are (the server judges them wrong)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { artistCorrect: false, titleCorrect: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(checkGuess(7, { artist: '', title: 'שיר' })).resolves.toEqual({
      artistCorrect: false,
      titleCorrect: true,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ artist: '', title: 'שיר' });
  });

  it('cuts each field to 200 characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { artistCorrect: false, titleCorrect: false }));
    vi.stubGlobal('fetch', fetchMock);
    await checkGuess(1, { artist: 'a'.repeat(250), title: 'b'.repeat(200) });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { artist: string; title: string };
    expect(body.artist).toBe('a'.repeat(200));
    expect(body.title).toBe('b'.repeat(200));
  });

  it('counts anything but true as wrong', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { artistCorrect: true, titleCorrect: true })));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).resolves.toEqual({ artistCorrect: true, titleCorrect: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { artistCorrect: 'yes', titleCorrect: 1 })));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).resolves.toEqual({ artistCorrect: false, titleCorrect: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {})));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).resolves.toEqual({ artistCorrect: false, titleCorrect: false });
  });

  it('maps errors like the other calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, { error: 'SONG_NOT_FOUND', message: 'no' })));
    await expect(checkGuess(999, { artist: 'a', title: 't' })).rejects.toMatchObject({
      code: 'SONG_NOT_FOUND',
      status: 404,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { error: 'INVALID_REQUEST', message: 'bad' })));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      status: 400,
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await checkGuess(1, { artist: 'a', title: 't' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('NETWORK');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 503 })));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).rejects.toMatchObject({ code: 'NETWORK' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    await expect(checkGuess(1, { artist: 'a', title: 't' })).rejects.toMatchObject({ code: 'UNKNOWN' });
  });
});

describe('fetchCoverUrl', () => {
  it('returns the cover url, or null when absent', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ coverUrl: 'https://x/c.jpg' }), { status: 200 }))));
    await expect(fetchCoverUrl(5)).resolves.toBe('https://x/c.jpg');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ coverUrl: null }), { status: 200 }))));
    await expect(fetchCoverUrl(5)).resolves.toBeNull();
  });
});
