import { afterEach, describe, expect, it, vi } from 'vitest';
import { song } from '../test/fixtures';
import { ApiError, fetchNextSong, fetchPreviewUrl } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('fetchNextSong', () => {
  it('POSTs the exclusions and returns the song', async () => {
    const s = song(1965, { id: 227 });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { song: s }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchNextSong({ excludeIds: [1], excludeArtists: ['ABBA'], languages: ['he'] });
    expect(result).toEqual(s);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/songs/next');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ excludeIds: [1], excludeArtists: ['ABBA'], languages: ['he'] });
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
