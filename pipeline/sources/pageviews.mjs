// Wikimedia REST pageviews (task 3.9 "fame today"). Free, no key; a User-Agent is required.
//   https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Wonderwall_(song)/monthly/2025100100/2026093000
//   → { items: [ { project: "en.wikipedia", article: "Wonderwall_(song)", granularity: "monthly",
//        timestamp: "2025100100", access: "all-access", agent: "user", views: 123456 } ] }
// 404 = no data for that article/range → 0 views.
import { HttpError, errorText, getJson as defaultGetJson } from './http.mjs';

const pad = (n) => String(n).padStart(2, '0');

/** The last 12 complete calendar months before `today`: { start: "YYYYMM0100", end: "YYYYMMDD00" }. */
export function last12Months(today = new Date()) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth(); // 0-based current month (incomplete)
  const startD = new Date(Date.UTC(y, m - 12, 1));
  const endD = new Date(Date.UTC(y, m, 0)); // last day of previous month
  const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}00`;
  return { start: fmt(startD), end: fmt(endD) };
}

export function pageviewsUrl(lang, title, range = last12Months()) {
  const article = encodeURIComponent(String(title).replace(/ /g, '_'));
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${article}/monthly/${range.start}/${range.end}`;
}

export function sumViews(json) {
  return (json?.items ?? []).reduce((s, it) => s + (Number(it.views) || 0), 0);
}

/** Total user views of an article over the last 12 complete months. Never throws. */
export async function pageviews12m(lang, title, { getJson = defaultGetJson, today } = {}) {
  if (!title) return { found: false };
  const range = last12Months(today);
  try {
    const json = await getJson(pageviewsUrl(lang, title, range));
    return { found: true, views: sumViews(json), months: json?.items?.length ?? 0, ...range };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return { found: true, views: 0, months: 0, ...range };
    return { found: false, error: errorText(e) };
  }
}
