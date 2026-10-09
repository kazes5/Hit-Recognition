import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { HttpError, USER_AGENT, cacheKey, createHttpClient } from '../http.mjs';
import { jsonResponse } from './helpers.mjs';

const dirs = [];
async function tempDir() {
  const d = await mkdtemp(path.join(tmpdir(), 'pipeline-cache-test-'));
  dirs.push(d);
  return d;
}
after(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

/** fetch mock answering from a queue of responses / errors. */
function queueFetch(items) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = items.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  };
  fn.calls = calls;
  return fn;
}

describe('http getJson', () => {
  test('sends the pipeline User-Agent and parses JSON', async () => {
    const fetch = queueFetch([jsonResponse({ ok: 1 })]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async () => {} });
    assert.deepEqual(await c.getJson('https://example.org/a'), { ok: 1 });
    assert.equal(fetch.calls[0].init.headers['User-Agent'], USER_AGENT);
    assert.equal(USER_AGENT, 'HitRecognition-Pipeline/1.0 (https://github.com/kazes5/Hit-Recognition)');
    assert.ok(fetch.calls[0].init.signal, 'request has a timeout signal');
  });

  test('retries 429 and 503 with growing backoff, then succeeds', async () => {
    const waits = [];
    const fetch = queueFetch([jsonResponse({}, 429), jsonResponse({}, 503), jsonResponse({ done: true })]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async (ms) => waits.push(ms), backoffMs: 100, hostIntervals: { 'example.org': 0 } });
    assert.deepEqual(await c.getJson('https://example.org/x'), { done: true });
    assert.equal(fetch.calls.length, 3);
    assert.deepEqual(waits, [100, 200]);
    assert.equal(c.stats.retries, 2);
  });

  test('honours Retry-After seconds', async () => {
    const waits = [];
    const fetch = queueFetch([jsonResponse({}, 503, { 'retry-after': '3' }), jsonResponse({ ok: 1 })]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async (ms) => waits.push(ms), hostIntervals: { 'example.org': 0 } });
    await c.getJson('https://example.org/x');
    assert.deepEqual(waits, [3000]);
  });

  test('retries network errors and gives up after the last retry', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
    const fetch = queueFetch([err, err, err]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async () => {}, retries: 2 });
    await assert.rejects(c.getJson('https://example.org/x'), (e) => e === err);
    assert.equal(fetch.calls.length, 3);
  });

  test('does not retry other 4xx; throws HttpError with the status', async () => {
    const fetch = queueFetch([jsonResponse({}, 400)]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async () => {} });
    await assert.rejects(c.getJson('https://example.org/x'), (e) => e instanceof HttpError && e.status === 400);
    assert.equal(fetch.calls.length, 1);
  });

  test('retryIf retries a 200 body that is really an error', async () => {
    const fetch = queueFetch([jsonResponse({ error: { code: 4 } }), jsonResponse({ data: [1] })]);
    const c = createHttpClient({ fetch, cacheDir: false, sleep: async () => {} });
    assert.deepEqual(await c.getJson('https://example.org/x', { retryIf: (b) => b.error?.code === 4 }), { data: [1] });
  });
});

describe('http rate limiter', () => {
  test('spaces requests to the same host; other hosts are independent', async () => {
    let clock = 0;
    const waits = [];
    const fetch = async () => jsonResponse({});
    const c = createHttpClient({ fetch, cacheDir: false, now: () => clock, sleep: async (ms) => { waits.push(ms); clock += ms; } });
    await c.getJson('https://musicbrainz.org/ws/2/a');
    await c.getJson('https://musicbrainz.org/ws/2/b');
    await c.getJson('https://musicbrainz.org/ws/2/c');
    assert.deepEqual(waits, [1100, 1100]);
    await c.getJson('https://itunes.apple.com/search?a');
    assert.deepEqual(waits, [1100, 1100], 'first iTunes request does not wait for MusicBrainz');
  });

  test('host intervals: MusicBrainz 1.1 s, iTunes 3 s (20/min), Wikimedia 0.2 s (5/s)', () => {
    const c = createHttpClient({ cacheDir: false });
    assert.equal(c.intervalFor('musicbrainz.org'), 1100);
    assert.equal(c.intervalFor('itunes.apple.com'), 3000);
    assert.equal(c.intervalFor('he.wikipedia.org'), 200);
    assert.equal(c.intervalFor('www.wikidata.org'), 200);
    assert.equal(c.intervalFor('wikimedia.org'), 200);
  });
});

describe('http cache', () => {
  test('second request is served from disk without fetch or rate limiting', async () => {
    const dir = await tempDir();
    let n = 0;
    const fetch = async () => jsonResponse({ n: ++n });
    const waits = [];
    const c1 = createHttpClient({ fetch, cacheDir: dir, sleep: async (ms) => waits.push(ms) });
    assert.deepEqual(await c1.getJson('https://musicbrainz.org/ws/2/x'), { n: 1 });
    const c2 = createHttpClient({ fetch, cacheDir: dir, sleep: async (ms) => waits.push(ms) });
    assert.deepEqual(await c2.getJson('https://musicbrainz.org/ws/2/x'), { n: 1 });
    assert.deepEqual(await c1.getJson('https://musicbrainz.org/ws/2/x'), { n: 1 });
    assert.equal(n, 1);
    assert.equal(c2.stats.cacheHits, 1);
    assert.deepEqual(waits, [], 'cache hits never wait');
    assert.deepEqual(await readdir(dir), [cacheKey('https://musicbrainz.org/ws/2/x') + '.json']);
  });

  test('404 is cached as a 404; 5xx and retryable bodies are not cached', async () => {
    const dir = await tempDir();
    let calls = 0;
    const fetch = async (url) => {
      calls++;
      if (url.endsWith('/missing')) return jsonResponse({}, 404);
      if (url.endsWith('/quota')) return jsonResponse({ error: { code: 4 } });
      return jsonResponse({}, 500);
    };
    const c = createHttpClient({ fetch, cacheDir: dir, sleep: async () => {}, retries: 0 });
    for (let i = 0; i < 2; i++) await assert.rejects(c.getJson('https://example.org/missing'), (e) => e.status === 404);
    assert.equal(calls, 1);
    await assert.rejects(c.getJson('https://example.org/err'));
    await assert.rejects(c.getJson('https://example.org/err'));
    assert.equal(calls, 3);
    await assert.rejects(c.getJson('https://example.org/quota', { retryIf: (b) => !!b.error }));
    await assert.rejects(c.getJson('https://example.org/quota', { retryIf: (b) => !!b.error }));
    assert.equal(calls, 5);
  });

  test('cache: false bypasses the cache', async () => {
    const dir = await tempDir();
    let n = 0;
    const c = createHttpClient({ fetch: async () => jsonResponse({ n: ++n }), cacheDir: dir, sleep: async () => {} });
    await c.getJson('https://example.org/y', { cache: false });
    await c.getJson('https://example.org/y', { cache: false });
    assert.equal(n, 2);
  });

  test('cache directory comes from PIPELINE_CACHE_DIR', async () => {
    const dir = await tempDir();
    const old = process.env.PIPELINE_CACHE_DIR;
    process.env.PIPELINE_CACHE_DIR = dir;
    try {
      const c = createHttpClient({ fetch: async () => jsonResponse({ a: 1 }), sleep: async () => {} });
      await c.getJson('https://example.org/env');
      assert.equal((await readdir(dir)).length, 1);
    } finally {
      if (old === undefined) delete process.env.PIPELINE_CACHE_DIR;
      else process.env.PIPELINE_CACHE_DIR = old;
    }
  });
});
