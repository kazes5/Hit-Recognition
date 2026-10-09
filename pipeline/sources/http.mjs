// Shared HTTP client for the source adapters: User-Agent, timeout, retries with
// backoff, a per-host rate limiter and an on-disk response cache.
//
// Cache: one JSON file per URL under PIPELINE_CACHE_DIR (default .pipeline-cache),
// named by the SHA-256 of the URL. 2xx bodies and 404s are cached (a 404 is a real
// answer, e.g. "no page views"). Cache hits skip the rate limiter and the network,
// so a restarted run does not repeat requests.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const USER_AGENT = 'HitRecognition-Pipeline/1.0 (https://github.com/kazes5/Hit-Recognition)';

/** Minimum gap between two requests to the same host, in ms (matched by host suffix). */
export const DEFAULT_HOST_INTERVALS = {
  'musicbrainz.org': 1100, // MusicBrainz: 1 request per second
  'itunes.apple.com': 3000, // iTunes Search: about 20 per minute
  'wikipedia.org': 200, // Wikimedia: about 5 per second
  'wikidata.org': 200,
  'wikimedia.org': 200,
  'api.deezer.com': 200, // Deezer: 50 per 5 seconds
};
const DEFAULT_INTERVAL = 200;
const RETRY_STATUS = new Set([429, 502, 503, 504]);

export class HttpError extends Error {
  constructor(status, url, message) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function cacheKey(url) {
  return createHash('sha256').update(url).digest('hex');
}

/**
 * @param {object} [opts]
 * @param {typeof fetch} [opts.fetch]       fetch implementation (tests pass a mock)
 * @param {string|false} [opts.cacheDir]    false disables the cache
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.retries]           extra attempts after the first
 * @param {number} [opts.backoffMs]         first backoff; doubles each retry
 * @param {Record<string,number>} [opts.hostIntervals]
 * @param {(ms:number)=>Promise<void>} [opts.sleep]
 * @param {()=>number} [opts.now]
 */
export function createHttpClient(opts = {}) {
  const fetchImpl = opts.fetch ?? ((...a) => globalThis.fetch(...a));
  const cacheDir = opts.cacheDir === undefined ? process.env.PIPELINE_CACHE_DIR || '.pipeline-cache' : opts.cacheDir;
  const timeoutMs = opts.timeoutMs ?? 20000;
  const retries = opts.retries ?? 4;
  const backoffMs = opts.backoffMs ?? 1000;
  const maxBackoffMs = opts.maxBackoffMs ?? 30000;
  const intervals = { ...DEFAULT_HOST_INTERVALS, ...(opts.hostIntervals ?? {}) };
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? Date.now;
  const userAgent = opts.userAgent ?? USER_AGENT;
  const nextSlot = new Map(); // host -> earliest time of the next request
  const stats = { requests: 0, cacheHits: 0, retries: 0, errors: 0 };

  function intervalFor(host) {
    let best = null;
    for (const [suffix, ms] of Object.entries(intervals)) {
      if ((host === suffix || host.endsWith('.' + suffix)) && (best === null || suffix.length > best[0].length)) best = [suffix, ms];
    }
    return best ? best[1] : DEFAULT_INTERVAL;
  }

  async function throttle(host) {
    const t = now();
    const slot = Math.max(t, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + intervalFor(host));
    if (slot > t) await sleep(slot - t);
  }

  function cacheFile(url) {
    return path.join(cacheDir, cacheKey(url) + '.json');
  }
  async function cacheRead(url) {
    if (!cacheDir) return null;
    try {
      const entry = JSON.parse(await readFile(cacheFile(url), 'utf8'));
      return entry && entry.url === url ? entry : null;
    } catch {
      return null;
    }
  }
  async function cacheWrite(url, status, body) {
    if (!cacheDir) return;
    try {
      await mkdir(cacheDir, { recursive: true });
      const file = cacheFile(url);
      const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, JSON.stringify({ url, status, fetchedAt: new Date(now()).toISOString(), body }));
      await rename(tmp, file);
    } catch {
      // A cache write failure must never fail a lookup.
    }
  }

  function retryDelay(attempt, res) {
    const ra = res?.headers?.get?.('retry-after');
    if (ra && /^\d+$/.test(ra.trim())) return Math.min(Number(ra) * 1000, maxBackoffMs);
    return Math.min(backoffMs * 2 ** attempt, maxBackoffMs);
  }

  /**
   * GET a URL and parse JSON. Throws HttpError (with .status) on a non-2xx answer
   * after retries, or the last network error.
   * @param {string} url
   * @param {object} [o]
   * @param {boolean} [o.cache=true]
   * @param {(body:any)=>boolean} [o.retryIf]  body-level "try again" (e.g. Deezer quota errors in a 200)
   * @param {(body:any)=>boolean} [o.cacheIf]  only cache bodies that pass (default: all)
   */
  async function getJson(url, o = {}) {
    const useCache = o.cache !== false;
    if (useCache) {
      const hit = await cacheRead(url);
      if (hit) {
        stats.cacheHits++;
        if (hit.status >= 200 && hit.status < 300) return hit.body;
        throw new HttpError(hit.status, url);
      }
    }
    const host = new URL(url).host;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) stats.retries++;
      await throttle(host);
      stats.requests++;
      let res;
      try {
        res = await fetchImpl(url, {
          headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        lastErr = e; // network error or timeout
        if (attempt < retries) await sleep(retryDelay(attempt));
        continue;
      }
      if (RETRY_STATUS.has(res.status)) {
        lastErr = new HttpError(res.status, url);
        if (attempt < retries) await sleep(retryDelay(attempt, res));
        continue;
      }
      if (res.status === 404) {
        if (useCache) await cacheWrite(url, 404, null);
        throw new HttpError(404, url);
      }
      if (!res.ok) {
        stats.errors++;
        throw new HttpError(res.status, url);
      }
      let body;
      try {
        body = await res.json();
      } catch (e) {
        lastErr = e; // truncated/HTML body: retry
        if (attempt < retries) await sleep(retryDelay(attempt));
        continue;
      }
      if (o.retryIf?.(body)) {
        lastErr = new Error(`retryable body from ${url}`);
        if (attempt < retries) await sleep(retryDelay(attempt));
        continue;
      }
      if (useCache && (!o.cacheIf || o.cacheIf(body))) await cacheWrite(url, res.status, body);
      return body;
    }
    stats.errors++;
    throw lastErr ?? new Error(`request failed: ${url}`);
  }

  return { getJson, stats, intervalFor };
}

let defaultClient = null;
/** The process-wide client (shared rate limiter state). */
export function defaultHttp() {
  if (!defaultClient) defaultClient = createHttpClient();
  return defaultClient;
}

/** getJson on the default client. */
export function getJson(url, o) {
  return defaultHttp().getJson(url, o);
}

/** Short error text for reports. */
export function errorText(e) {
  if (e instanceof HttpError) return `HTTP ${e.status}`;
  return e?.cause?.code ?? e?.name ?? String(e);
}
