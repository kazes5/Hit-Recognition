import { describe, expect, it, vi } from 'vitest';
import { ItunesPreviewProvider } from '../src/preview/itunes.js';
import { MockPreviewProvider } from '../src/preview/mock.js';
import { song } from './helpers.js';

const jb = song({ id: 227, artist: 'James Brown', title: 'I Got You (I Feel Good)', year: 1965 });
const silent = { warn: () => undefined };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ItunesPreviewProvider', () => {
  it('builds the search URL with term, entity, limit and country', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }));
    const p = new ItunesPreviewProvider({ country: 'US', fetch: fetchMock as typeof fetch, logger: silent });
    await p.getPreviewUrl(jb);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe('https://itunes.apple.com/search');
    expect(url.searchParams.get('term')).toBe('James Brown I Got You (I Feel Good)');
    expect(url.searchParams.get('entity')).toBe('song');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('country')).toBe('US');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults the country to IL', () => {
    const p = new ItunesPreviewProvider({ fetch: vi.fn() as unknown as typeof fetch });
    expect(new URL(p.buildSearchUrl(jb)).searchParams.get('country')).toBe('IL');
  });

  it('returns the best preview and caches it', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        resultCount: 2,
        results: [
          { kind: 'song', artistName: 'Glee Cast', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://cover' },
          { kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://audio-ssl.itunes.apple.com/jb.m4a' },
        ],
      }),
    );
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(jb)).toBe('https://audio-ssl.itunes.apple.com/jb.m4a');
    expect(await p.getPreviewUrl(jb)).toBe('https://audio-ssl.itunes.apple.com/jb.m4a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches "not found" as null', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ resultCount: 0, results: [] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(jb)).toBeNull();
    expect(await p.getPreviewUrl(jb)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent lookups', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    await Promise.all([p.getPreviewUrl(jb), p.getPreviewUrl(jb), p.getPreviewUrl(jb)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['network error', async () => Promise.reject(new TypeError('fetch failed'))],
    ['HTTP 503', async () => new Response('down', { status: 503 })],
    ['invalid JSON', async () => new Response('<html>', { status: 200 })],
    ['unexpected shape', async () => jsonResponse({ nope: true })],
  ])('never throws on %s (returns null)', async (_name, impl) => {
    const p = new ItunesPreviewProvider({ fetch: vi.fn(impl) as unknown as typeof fetch, logger: silent });
    await expect(p.getPreviewUrl(jb)).resolves.toBeNull();
  });

  it('times out slow requests and returns null', async () => {
    const hang = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const p = new ItunesPreviewProvider({ fetch: hang as typeof fetch, timeoutMs: 20, logger: silent });
    await expect(p.getPreviewUrl(jb)).resolves.toBeNull();
  });

  it('caches error nulls only for the error TTL', async () => {
    let now = 1_000;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://ok' }] }),
      );
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, errorTtlMs: 100, now: () => now, logger: silent });
    expect(await p.getPreviewUrl(jb)).toBeNull();
    now += 50;
    expect(await p.getPreviewUrl(jb)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 100;
    expect(await p.getPreviewUrl(jb)).toBe('https://ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('Hebrew songs, logging and pinned track ids', () => {
  const artzi = song({ id: 301, artist: 'שלמה ארצי', title: 'ירח', language: 'he' });
  const heTrack = { kind: 'song', artistId: 1, artistName: 'שלמה ארצי', trackName: 'ירח', previewUrl: 'https://p/he.m4a' };
  const other = { kind: 'song', artistId: 2, artistName: 'אריק איינשטיין', trackName: 'אוהב להיות בבית', previewUrl: 'https://p/x.m4a' };
  const urlsOf = (fetchMock: { mock: { calls: unknown[][] } }) => fetchMock.mock.calls.map((c) => new URL(String(c[0])));

  it('adds lang=he_il only for Hebrew songs', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [heTrack] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(artzi)).toBe('https://p/he.m4a');
    expect(await p.getPreviewUrl(jb)).toBeNull();
    const [he, en] = urlsOf(fetchMock);
    expect(he?.searchParams.get('lang')).toBe('he_il');
    expect(en?.searchParams.has('lang')).toBe(false);
    expect(new URL(p.buildSearchUrl(jb)).searchParams.has('lang')).toBe(false);
  });

  it('makes a single request when the he_il search matches', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [heTrack] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(artzi)).toBe('https://p/he.m4a');
    expect(await p.getCoverUrl(artzi)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('searches again without lang when the he_il search finds no match, and caches that', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [other] }))
      .mockResolvedValueOnce(jsonResponse({ results: [other, heTrack] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(artzi)).toBe('https://p/he.m4a');
    expect(await p.getPreviewUrl(artzi)).toBe('https://p/he.m4a');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = urlsOf(fetchMock);
    expect(first?.searchParams.get('lang')).toBe('he_il');
    expect(second?.searchParams.has('lang')).toBe(false);
    expect(second?.searchParams.get('term')).toBe('שלמה ארצי ירח');
  });

  it('accepts transliterated results for Hebrew songs', async () => {
    const latin = { ...heTrack, artistName: 'Shlomo Artzi', trackName: 'Yareach', previewUrl: 'https://p/latin.m4a' };
    const fetchMock = vi.fn(async () => jsonResponse({ results: [latin] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(artzi)).toBe('https://p/latin.m4a');
  });

  it('logs the first 3 results when nothing matches (once per song), but not for empty results', async () => {
    const warn = vi.fn();
    const results = [other, { ...other, trackName: 'שיר 2' }, { ...other, trackName: 'שיר 3' }, { ...other, trackName: 'שיר 4' }];
    const p = new ItunesPreviewProvider({ fetch: vi.fn(async () => jsonResponse({ results })) as unknown as typeof fetch, logger: { warn } });
    expect(await p.getPreviewUrl(artzi)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[preview] no match for song 301 "שלמה ארצי – ירח": "אריק איינשטיין – אוהב להיות בבית", "אריק איינשטיין – שיר 2", "אריק איינשטיין – שיר 3"',
    );

    const quiet = vi.fn();
    const empty = new ItunesPreviewProvider({ fetch: vi.fn(async () => jsonResponse({ results: [] })) as unknown as typeof fetch, logger: { warn: quiet } });
    expect(await empty.getPreviewUrl(jb)).toBeNull();
    expect(quiet).not.toHaveBeenCalled();
  });

  it('uses the lookup URL for a pinned itunesTrackId and skips the search', async () => {
    const pinned = { ...artzi, itunesTrackId: 123456 };
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          { wrapperType: 'track', kind: 'song', trackId: 123456, artistName: 'Shlomo Artzi', trackName: 'Something Else', previewUrl: 'https://p/pinned.m4a', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg' },
        ],
      }),
    );
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(pinned)).toBe('https://p/pinned.m4a');
    expect(await p.getCoverUrl(pinned)).toBe('https://is1-ssl.mzstatic.com/a/300x300bb.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = urlsOf(fetchMock);
    expect(`${url?.origin}${url?.pathname}`).toBe('https://itunes.apple.com/lookup');
    expect(url?.searchParams.get('id')).toBe('123456');
    expect(url?.searchParams.get('country')).toBe('IL');
    expect(url?.searchParams.get('entity')).toBe('song');
  });

  it('sanitizes the pinned cover', async () => {
    const pinned = { ...jb, itunesTrackId: 7 };
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{ kind: 'song', trackId: 7, previewUrl: 'https://p/7.m4a', artworkUrl100: 'https://evil.example/a.jpg' }] }));
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getCoverUrl(pinned)).toBeNull();
    expect(await p.getPreviewUrl(pinned)).toBe('https://p/7.m4a');
  });

  it('falls back to search when the pinned lookup returns nothing', async () => {
    const pinned = { ...jb, itunesTrackId: 999 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ resultCount: 0, results: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ kind: 'song', artistName: 'James Brown', trackName: 'I Got You (I Feel Good)', previewUrl: 'https://p/jb.m4a' }] }),
      );
    const p = new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent });
    expect(await p.getPreviewUrl(pinned)).toBe('https://p/jb.m4a');
    const [lookup, search] = urlsOf(fetchMock);
    expect(lookup?.pathname).toBe('/lookup');
    expect(search?.pathname).toBe('/search');
  });
});

describe('cover URLs', () => {
  const track = (artworkUrl100: string | undefined, extra: Record<string, unknown> = {}) => ({
    kind: 'song',
    artistName: 'James Brown',
    trackName: 'I Got You (I Feel Good)',
    previewUrl: 'https://audio-ssl.itunes.apple.com/jb.m4a',
    artworkUrl100,
    ...extra,
  });
  const provider = (results: unknown[]) => {
    const fetchMock = vi.fn(async () => jsonResponse({ results }));
    return { fetchMock, p: new ItunesPreviewProvider({ fetch: fetchMock as typeof fetch, logger: silent }) };
  };

  it('upscales 100x100 to 300x300 for the best-matching track', async () => {
    const { p } = provider([
      track('https://is1-ssl.mzstatic.com/image/thumb/x/cast/100x100bb.jpg', { artistName: 'Glee Cast' }),
      track('https://is1-ssl.mzstatic.com/image/thumb/x/jb/100x100bb.jpg'),
    ]);
    expect(await p.getCoverUrl(jb)).toBe('https://is1-ssl.mzstatic.com/image/thumb/x/jb/300x300bb.jpg');
  });

  it('shares ONE lookup between preview and cover (concurrent and sequential)', async () => {
    const { fetchMock, p } = provider([track('https://is1-ssl.mzstatic.com/a/100x100bb.jpg')]);
    const [preview, cover] = await Promise.all([p.getPreviewUrl(jb), p.getCoverUrl(jb)]);
    expect(preview).toBe('https://audio-ssl.itunes.apple.com/jb.m4a');
    expect(cover).toBe('https://is1-ssl.mzstatic.com/a/300x300bb.jpg');
    await p.getCoverUrl(jb);
    await p.getPreviewUrl(jb);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['http scheme', 'http://is1-ssl.mzstatic.com/a/100x100bb.jpg'],
    ['foreign host', 'https://evil.example.com/a/100x100bb.jpg'],
    ['lookalike host', 'https://notmzstatic.com/a/100x100bb.jpg'],
    ['mzstatic as a subdomain of another host', 'https://mzstatic.com.evil.example/a.jpg'],
    ['not a URL', 'nonsense'],
    ['missing', undefined],
  ])('returns null cover for %s', async (_name, url) => {
    const { p } = provider([track(url)]);
    expect(await p.getCoverUrl(jb)).toBeNull();
  });

  it('accepts the bare mzstatic.com host', async () => {
    const { p } = provider([track('https://mzstatic.com/a/100x100bb.jpg')]);
    expect(await p.getCoverUrl(jb)).toBe('https://mzstatic.com/a/300x300bb.jpg');
  });

  it('returns null when nothing matches, and on errors (error cached only briefly)', async () => {
    const none = provider([]);
    expect(await none.p.getCoverUrl(jb)).toBeNull();
    expect(await none.p.getCoverUrl(jb)).toBeNull();
    expect(none.fetchMock).toHaveBeenCalledTimes(1);

    const failing = new ItunesPreviewProvider({ fetch: vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch, logger: silent });
    await expect(failing.getCoverUrl(jb)).resolves.toBeNull();
  });
});

describe('MockPreviewProvider', () => {
  it('always returns the mock audio and cover paths', async () => {
    expect(await new MockPreviewProvider().getPreviewUrl()).toBe('/api/mock-audio');
    expect(await new MockPreviewProvider().getCoverUrl()).toBe('/api/mock-cover');
  });
});
