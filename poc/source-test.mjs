// Source test: for 30 Hebrew + 30 English catalog songs (years already verified),
// how often does each public source find the song, and does its year match ours?
// Sources: Wikipedia infobox (he/en), Wikidata P577, MusicBrainz (artist MBID + earliest
// first-release-date), iTunes (preview + store date), Deezer (preview + rank).
// Read-only. Run from GitHub Actions (the dev sandbox cannot reach these hosts).
import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'HitRecognition-SourceTest/0.2 (https://github.com/kazes5/Hit-Recognition)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const songs = JSON.parse(readFileSync(new URL('../server/data/songs.json', import.meta.url), 'utf8'));

function spread(list, n) {
  const sorted = [...list].sort((a, b) => a.year - b.year || a.id - b.id);
  return Array.from({ length: n }, (_, i) => sorted[Math.floor((i * sorted.length) / n)]);
}
const sample = [...spread(songs.filter((s) => s.language === 'he'), 30), ...spread(songs.filter((s) => s.language === 'en'), 30)];

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const sameTitle = (a, b) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x));
};

async function getJson(url, { tries = 3, wait = 1500 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (res.status === 503 || res.status === 429) { await sleep(wait * (i + 1)); continue; }
      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (e) {
      if (i === tries - 1) return { error: e.cause?.code ?? e.name };
      await sleep(wait);
    }
  }
  return { error: 'rate-limited' };
}
const years = (text) => [...String(text).matchAll(/\b(19[4-9]\d|20[0-2]\d)\b/g)].map((m) => Number(m[1]));

// --- Wikipedia (infobox year) + Wikidata (P577) ---
const INFOBOX_KEY = /^\s*\|\s*(released|release_date|recorded|יצא לאור|תאריך יציאה|שנת יציאה|הוצאה|יציאה|תאריך הוצאה|שנה)\s*=(.*)$/im;
async function wikipedia(song) {
  const lang = song.language === 'he' ? 'he' : 'en';
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const q = `${song.title} ${song.artist}`;
  const search = await getJson(`${api}?action=query&list=search&format=json&srlimit=5&srsearch=${encodeURIComponent(q)}`);
  if (search.error) return { error: search.error };
  const hit = (search.query?.search ?? []).find((h) => sameTitle(h.title.replace(/\s*\(.*\)$/, ''), song.title));
  if (!hit) return { found: false };
  const page = await getJson(`${api}?action=parse&format=json&prop=wikitext|properties&page=${encodeURIComponent(hit.title)}`);
  const wikitext = page.parse?.wikitext?.['*'] ?? '';
  let year = null;
  for (const line of wikitext.split('\n')) {
    const m = line.match(INFOBOX_KEY);
    if (m) { const ys = years(m[2]); if (ys.length) { year = Math.min(...ys); break; } }
  }
  const qid = (page.parse?.properties ?? []).find((p) => p.name === 'wikibase_item')?.['*'];
  let wikidataYear = null;
  if (qid) {
    const wd = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    const claims = wd.entities?.[qid]?.claims?.P577 ?? [];
    const ys = claims.map((c) => Number(c.mainsnak?.datavalue?.value?.time?.slice(1, 5))).filter((y) => y > 1900);
    if (ys.length) wikidataYear = Math.min(...ys);
  }
  return { found: true, page: hit.title, year, wikidataYear };
}

// --- MusicBrainz: artist MBID first, then the earliest first-release-date of that artist's recordings ---
async function musicbrainz(song) {
  const names = [song.artist, ...(song.artistAliases ?? [])].slice(0, 3);
  let arid = null;
  for (const name of names) {
    const a = await getJson(`https://musicbrainz.org/ws/2/artist?fmt=json&limit=3&query=${encodeURIComponent(`artist:"${name}" OR alias:"${name}"`)}`);
    await sleep(1100);
    const best = (a.artists ?? []).find((x) => (x.score ?? 0) >= 90);
    if (best) { arid = best.id; break; }
  }
  if (!arid) return { found: false, note: 'artist not found' };
  const titles = [song.title, ...(song.titleAliases ?? [])].slice(0, 2);
  const found = [];
  for (const t of titles) {
    const r = await getJson(`https://musicbrainz.org/ws/2/recording?fmt=json&limit=100&query=${encodeURIComponent(`arid:${arid} AND recording:"${t}"`)}`);
    await sleep(1100);
    for (const rec of r.recordings ?? []) {
      if (!sameTitle(rec.title, t)) continue;
      if (/live|remix|demo|instrumental|karaoke|version/i.test(rec.disambiguation ?? '')) continue;
      const y = Number((rec['first-release-date'] ?? '').slice(0, 4));
      if (y > 1900) found.push(y);
    }
    if (found.length) break;
  }
  return found.length ? { found: true, year: Math.min(...found) } : { found: false, note: 'artist found, song not' };
}

// --- iTunes: preview + store date (upper bound only) ---
async function itunes(song) {
  const country = song.language === 'he' ? 'IL' : 'US';
  const r = await getJson(`https://itunes.apple.com/search?entity=song&limit=15&country=${country}&term=${encodeURIComponent(`${song.artist} ${song.title}`)}`, { wait: 4000 });
  await sleep(3200); // ~20 requests/minute
  if (r.error) return { error: r.error };
  const hits = (r.results ?? []).filter((x) => sameTitle(x.trackName, song.title));
  if (!hits.length) return { found: false };
  const ys = hits.map((h) => Number(String(h.releaseDate).slice(0, 4))).filter(Boolean);
  return { found: true, preview: hits.some((h) => h.previewUrl), year: Math.min(...ys), genre: hits[0].primaryGenreName };
}

// --- Deezer: preview + popularity rank ---
async function deezer(song) {
  const r = await getJson(`https://api.deezer.com/search?limit=10&q=${encodeURIComponent(`artist:"${song.artistAliases?.[0] ?? song.artist}" track:"${song.titleAliases?.[0] ?? song.title}"`)}`);
  await sleep(250);
  if (r.error) return { error: typeof r.error === 'string' ? r.error : `code ${r.error.code}` };
  let hit = (r.data ?? []).find((x) => sameTitle(x.title, song.title) || (song.titleAliases ?? []).some((t) => sameTitle(x.title, t)));
  if (!hit && song.language === 'he') {
    const r2 = await getJson(`https://api.deezer.com/search?limit=10&q=${encodeURIComponent(`${song.artist} ${song.title}`)}`);
    hit = (r2.data ?? []).find((x) => sameTitle(x.title, song.title));
  }
  return hit ? { found: true, preview: !!hit.preview, rank: hit.rank } : { found: false };
}

const rows = [];
for (const s of sample) {
  const [wp, mb] = [await wikipedia(s), await musicbrainz(s)];
  const it = await itunes(s);
  const dz = await deezer(s);
  rows.push({ id: s.id, lang: s.language, year: s.year, artist: s.artist, title: s.title, wp, mb, it, dz });
  console.log(`${s.language} ${s.year} ${s.artist} – ${s.title} | WP ${wp.year ?? (wp.found ? 'no year' : wp.error ?? '-')} WD ${wp.wikidataYear ?? '-'} | MB ${mb.year ?? mb.note ?? mb.error ?? '-'} | iT ${it.found ? `${it.year}${it.preview ? ' ▶' : ''} ${it.genre}` : it.error ?? '-'} | DZ ${dz.found ? `rank ${dz.rank}${dz.preview ? ' ▶' : ''}` : dz.error ?? '-'}`);
}

// --- Summary ---
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const lines = ['| Source | Lang | Found | Year exact | Year ±1 | Year wrong (>1) |', '|---|---|---|---|---|---|'];
const sources = {
  'Wikipedia infobox': (r) => r.wp.year,
  'Wikidata P577': (r) => r.wp.wikidataYear,
  MusicBrainz: (r) => r.mb.year,
  'iTunes store date': (r) => (r.it.found ? r.it.year : null),
};
for (const [name, get] of Object.entries(sources)) {
  for (const lang of ['he', 'en']) {
    const rs = rows.filter((r) => r.lang === lang);
    const ys = rs.map((r) => [get(r), r.year]).filter(([y]) => y);
    const exact = ys.filter(([y, t]) => y === t).length;
    const near = ys.filter(([y, t]) => Math.abs(y - t) <= 1).length;
    lines.push(`| ${name} | ${lang} | ${ys.length}/${rs.length} | ${pct(exact, ys.length)} | ${pct(near, ys.length)} | ${ys.length - near} |`);
  }
}
for (const lang of ['he', 'en']) {
  const rs = rows.filter((r) => r.lang === lang);
  lines.push(`| iTunes preview | ${lang} | ${rs.filter((r) => r.it.preview).length}/${rs.length} | | | |`);
  lines.push(`| Deezer found / preview | ${lang} | ${rs.filter((r) => r.dz.found).length} / ${rs.filter((r) => r.dz.preview).length} of ${rs.length} | | | |`);
}
// Combined rule: earliest of the trusted sources (WP, WD, MB); accepted when a second one agrees within 1 year.
const rule = { he: { acc: 0, accOk: 0, flagged: 0, none: 0 }, en: { acc: 0, accOk: 0, flagged: 0, none: 0 } };
for (const r of rows) {
  const ys = [r.wp.year, r.wp.wikidataYear, r.mb.year].filter(Boolean);
  const o = rule[r.lang];
  if (!ys.length) { o.none++; continue; }
  const earliest = Math.min(...ys);
  const agree = ys.filter((y) => Math.abs(y - earliest) <= 1).length >= 2;
  if (agree) { o.acc++; if (earliest === r.year) o.accOk++; } else o.flagged++;
}
lines.push('', '**Combined rule** (earliest of Wikipedia / Wikidata / MusicBrainz, accepted when two agree within 1 year):', '');
for (const lang of ['he', 'en']) {
  const o = rule[lang];
  lines.push(`- ${lang}: accepted automatically ${o.acc}/30 (correct ${o.accOk}/${o.acc}), flagged for a person ${o.flagged}, no year from any source ${o.none}`);
}
const summary = lines.join('\n');
console.log('\n' + summary);
writeFileSync('summary.md', summary + '\n');
writeFileSync('rows.json', JSON.stringify(rows, null, 1));
