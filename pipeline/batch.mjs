#!/usr/bin/env node
// Task 3.7: one song batch, from hit lists to songs ready to merge.
//
//   node pipeline/batch.mjs --request pipeline/batch-request.json --out .pipeline-out [--concurrency 3]
//
// Request: { name, sources: [...], language?: 'he'|'en', fromYear, toYear, size = 300, top = 20 }.
// Writes to --out: batch.json (accepted songs, catalog shape, no ids), flagged.csv, excluded.csv,
// provenance.json (year sources, charts and difficulty inputs per accepted song), report.md,
// and the resume state (selection.json, progress-<hash>.jsonl). Re-running with the same
// request and out dir continues where it stopped. Network: run it on GitHub Actions
// (workflow song-batch.yml). Flow and rules: orchestrate/batch-flow.mjs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBatch } from './orchestrate/batch-flow.mjs';
import { loadBatchDeps } from './orchestrate/deps.mjs';
import { parseArgs } from './orchestrate/util.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2), { request: 'value', out: 'value', concurrency: 'value' });
  if (!args.request) throw new Error('usage: batch.mjs --request <file> --out <dir>');
  const request = JSON.parse(readFileSync(args.request, 'utf8'));
  const out = args.out ?? '.pipeline-out';
  const { songs, flagged, excluded } = await runBatch(request, { out, deps: await loadBatchDeps(), concurrency: Number(args.concurrency ?? 3), log: (s) => console.log(s) });
  console.log(`\nAccepted ${songs.length}, flagged ${flagged.length}, excluded ${excluded.length}. Report: ${path.join(out, 'report.md')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
