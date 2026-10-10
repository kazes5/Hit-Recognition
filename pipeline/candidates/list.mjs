#!/usr/bin/env node
// List the chart candidates of the annual hit lists (task 3.2).
//
//   node pipeline/candidates/list.mjs [--sources reshet-gimel,galgalatz] [--from 1969] [--to 2025] [--top 20] [--out .pipeline-out]
//
// Writes <out>/candidates.json, <out>/problems.json, <out>/pages.json and <out>/summary.md
// (counts per source and year, pages read, problems), and prints the summary.
// Network: run it on GitHub Actions (the dev sandbox cannot reach Wikipedia).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultHttp } from '../sources/http.mjs';
import { ALL_SOURCES, compactYears, extract } from './index.mjs';

export function parseArgs(argv) {
  const a = { sources: ALL_SOURCES, from: 1900, to: 2100, top: 20, out: '.pipeline-out' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--sources') { a.sources = v === 'all' ? ALL_SOURCES : v.split(',').map((s) => s.trim()).filter(Boolean); i++; }
    else if (k === '--from') { a.from = Number(v); i++; }
    else if (k === '--to') { a.to = Number(v); i++; }
    else if (k === '--top') { a.top = Number(v); i++; }
    else if (k === '--out') { a.out = v; i++; }
    else throw new Error(`unknown argument ${k}`);
  }
  for (const k of ['from', 'to', 'top']) if (!Number.isInteger(a[k])) throw new Error(`--${k} must be a whole number`);
  return a;
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Markdown summary of an extract() result. */
export function summarize({ candidates, problems, pages }, { sources, from, to, top, seconds = null, http = null }) {
  const L = [];
  L.push('# Chart candidates', '');
  L.push(`Sources: ${sources.join(', ')}; years ${from}–${to}; top ${top}.${seconds != null ? ` ${seconds} s.` : ''}${http ? ` Requests ${http.requests}, cache hits ${http.cacheHits}, retries ${http.retries}, failed ${http.errors}.` : ''}`, '');
  L.push(`**${candidates.length} candidates, ${problems.length} problems.**`, '');
  L.push('| Source | Language | Years with a chart | Candidates | Problems |', '|---|---|---|---|---|');
  for (const s of sources) {
    const cs = candidates.filter((c) => c.source === s);
    const years = [...new Set(cs.map((c) => c.chartYear))].sort((a, b) => a - b);
    const langs = [...new Set(cs.map((c) => c.language))].join(', ') || '–';
    L.push(`| ${s} | ${langs} | ${years.length ? `${years.length} (${compactYears(years)})` : '0'} | ${cs.length} | ${problems.filter((p) => p.source === s).length} |`);
  }
  // Problems that belong to no single source (e.g. airplay rankings on the shared Hebrew pages)
  for (const s of [...new Set(problems.map((p) => p.source))].filter((s) => !sources.includes(s))) {
    L.push(`| ${s} | – | – | – | ${problems.filter((p) => p.source === s).length} |`);
  }
  L.push('');
  for (const s of sources) {
    const cs = candidates.filter((c) => c.source === s);
    if (!cs.length) continue;
    const byYear = new Map();
    for (const c of cs) byYear.set(c.chartYear, (byYear.get(c.chartYear) ?? 0) + 1);
    L.push(`## ${s}: candidates per year`, '');
    L.push([...byYear].sort((a, b) => a[0] - b[0]).map(([y, n]) => `${y}: ${n}`).join(' · '), '');
    const first = [...byYear.keys()].sort((a, b) => a - b)[0];
    const sample = cs.filter((c) => c.chartYear === first).slice(0, 3).map((c) => `${c.rank}. ${c.title} – ${c.artist}`).join('; ');
    L.push(`Sample (${first}): ${sample}`, '');
  }
  L.push('## Pages read', '', '| Source | Page | Years | Rows | Ignored tables/lists |', '|---|---|---|---|---|');
  for (const p of pages) L.push(`| ${p.source} | [${esc(p.title)}](${p.url}) | ${p.years.length ? esc(compactYears(p.years)) : '–'} | ${p.entries} | ${p.notes.length} |`);
  L.push('');
  L.push('## Problems', '');
  if (!problems.length) L.push('None.');
  else {
    L.push('| Source | Page | Problem |', '|---|---|---|');
    for (const p of problems.slice(0, 300)) L.push(`| ${p.source} | ${esc(decodeURIComponent(String(p.page).replace(/^https:\/\/(\w+)\.wikipedia\.org\/wiki\//, '$1:')))} | ${esc(p.detail ? `${p.reason}: ${p.detail}` : p.reason)} |`);
    if (problems.length > 300) L.push('', `… and ${problems.length - 300} more (see problems.json).`);
  }
  const notes = pages.flatMap((p) => p.notes.map((n) => ({ p, n })));
  if (notes.length) {
    L.push('', '<details><summary>Ignored tables and lists (' + notes.length + ')</summary>', '');
    for (const { p, n } of notes.slice(0, 200)) L.push(`- ${esc(p.title)}: ${esc(n)}`);
    L.push('', '</details>');
  }
  return L.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const result = await extract({ sources: args.sources, fromYear: args.from, toYear: args.to, top: args.top });
  const summary = summarize(result, { ...args, seconds: Math.round((Date.now() - t0) / 1000), http: defaultHttp().stats });
  mkdirSync(args.out, { recursive: true });
  writeFileSync(path.join(args.out, 'candidates.json'), JSON.stringify(result.candidates, null, 1));
  writeFileSync(path.join(args.out, 'problems.json'), JSON.stringify(result.problems, null, 1));
  writeFileSync(path.join(args.out, 'pages.json'), JSON.stringify(result.pages, null, 1));
  writeFileSync(path.join(args.out, 'summary.md'), summary);
  console.log(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
