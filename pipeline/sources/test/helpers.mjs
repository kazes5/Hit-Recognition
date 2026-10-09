// Shared test helpers (not a test file itself; running it is a no-op).
import { readFileSync } from 'node:fs';
import { createHttpClient } from '../http.mjs';

export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/**
 * A fetch mock that answers from a route list: [[matcher, body | (url)=>body | Response]].
 * A matcher is a substring or a RegExp tested against the decoded URL. Unmatched URLs get 404.
 * Calls are recorded in `.calls` (decoded URLs).
 */
export function routerFetch(routes) {
  const calls = [];
  const fn = async (url) => {
    const u = decodeURIComponent(String(url));
    calls.push(u);
    for (const [m, ans] of routes) {
      if (typeof m === 'string' ? u.includes(m) : m.test(u)) {
        const v = typeof ans === 'function' ? ans(u) : ans;
        return v instanceof Response ? v : jsonResponse(v);
      }
    }
    return jsonResponse({ error: 'not found' }, 404);
  };
  fn.calls = calls;
  return fn;
}

/** A client with no cache, no waiting, and a mock fetch; returns { getJson, fetch, client }. */
export function mockClient(routes, opts = {}) {
  const fetch = routerFetch(routes);
  const client = createHttpClient({ fetch, cacheDir: false, sleep: async () => {}, retries: 2, ...opts });
  return { getJson: client.getJson, fetch, client };
}
