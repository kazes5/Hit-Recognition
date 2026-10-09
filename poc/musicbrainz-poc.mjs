// POC: can we reach MusicBrainz, and do its first-release years match our catalog?
// Usage: node mb-poc.mjs   (MusicBrainz asks for <= 1 request/second and a User-Agent)
import { readFileSync } from 'node:fs';

const songs = JSON.parse(readFileSync(new URL('../server/data/songs.json', import.meta.url), 'utf8'));
const pick = [
  'Rock Around the Clock', 'Johnny B. Goode', 'Hotel California', 'Billie Jean', 'Wonderwall',
  'Crazy in Love', 'Uptown Funk', 'Espresso',
  'ירושלים של זהב', 'הפרח בגני', 'אור גדול', 'יום ועוד יומיים',
];
const sample = pick.map((t) => songs.find((s) => s.title === t)).filter(Boolean);
const UA = 'HitRecognition-POC/0.1 (https://github.com/kazes5/Hit-Recognition)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/(["\\])/g, '\\$1');

for (const s of sample) {
  const q = `recording:"${esc(s.title)}" AND artist:"${esc(s.artistAliases?.[0] ?? s.artist)}"`;
  const url = `https://musicbrainz.org/ws/2/recording?fmt=json&limit=25&query=${encodeURIComponent(q)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    const ms = Date.now() - t0;
    if (!res.ok) { console.log(`${s.title}: HTTP ${res.status} (${ms} ms)`); await sleep(1100); continue; }
    const body = await res.json();
    const years = (body.recordings ?? [])
      .filter((r) => (r.score ?? 0) >= 90)
      .map((r) => Number((r['first-release-date'] ?? '').slice(0, 4)))
      .filter((y) => y >= 1900);
    const mb = years.length ? Math.min(...years) : null;
    const verdict = mb === null ? 'NOT FOUND' : mb === s.year ? 'match' : Math.abs(mb - s.year) === 1 ? 'off by 1' : 'DIFFERENT';
    console.log(`${s.year}  ${s.artist} – ${s.title}: MusicBrainz ${mb ?? '-'} → ${verdict}  (${body.count} hits, ${ms} ms)`);
  } catch (e) {
    console.log(`${s.title}: ${e.cause?.message ?? e.message}`);
  }
  await sleep(1100);
}
