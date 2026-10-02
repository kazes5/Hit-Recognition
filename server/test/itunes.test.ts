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

describe('MockPreviewProvider', () => {
  it('always returns the mock audio path', async () => {
    expect(await new MockPreviewProvider().getPreviewUrl()).toBe('/api/mock-audio');
  });
});
