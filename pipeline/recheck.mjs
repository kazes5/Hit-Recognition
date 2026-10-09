#!/usr/bin/env node
// Task 3.8: re-check the years and previews of the songs already in the catalog.
//
//   node pipeline/recheck.mjs --out .pipeline-out [--limit N] [--ids 4,17] [--concurrency 3]
//       → recheck-fixes.json (id, old, new, sources), recheck-flagged.csv, recheck-report.md,
//         recheck-trackids.json; resumable through recheck-progress.jsonl.
//   node pipeline/recheck.mjs --apply [--fixes <file> | --out <dir>]
//       → applies <out>/recheck-fixes.json to server/data/songs.json through build/catalog-io.mjs
//         (no network; run it locally after reviewing the fixes).
// Rules (D8): orchestrate/recheck-flow.mjs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecheckDeps } from './orchestrate/deps.mjs';
import { applyFixes, runRecheck } from './orchestrate/recheck-flow.mjs';
import { parseArgs } from './orchestrate/util.mjs';

/** --apply: read the fixes, apply them, write the catalog (only when something changed). */
export async function applyCommand({ fixesFile, deps, log = console.log }) {
  const fixes = JSON.parse(readFileSync(fixesFile, 'utf8'));
  const catalog = await deps.readCatalog();
  const { songs, applied, skipped } = applyFixes(catalog, fixes);
  for (const f of applied) log(`fixed ${f.id} ${f.artist} – ${f.title}: ${f.old} → ${f.new}`);
  for (const s of skipped) log(`skipped ${s.fix.id} ${s.fix.artist} – ${s.fix.title}: ${s.why}`);
  if (applied.length) await deps.writeCatalog(songs);
  log(`${applied.length} fixes applied, ${skipped.length} skipped.`);
  return { applied, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { out: 'value', apply: 'bool', fixes: 'value', limit: 'value', ids: 'value', concurrency: 'value' });
  const out = args.out ?? '.pipeline-out';
  const deps = await loadRecheckDeps();
  if (args.apply) {
    await applyCommand({ fixesFile: args.fixes ?? path.join(out, 'recheck-fixes.json'), deps });
    return;
  }
  const ids = args.ids ? args.ids.split(',').map(Number).filter(Number.isInteger) : undefined;
  const { fixes, flagged } = await runRecheck({ out, deps, ids, limit: args.limit ? Number(args.limit) : undefined, concurrency: Number(args.concurrency ?? 3), log: (s) => console.log(s) });
  console.log(`\nFixes ${fixes.length}, flagged ${flagged.length}. Report: ${path.join(out, 'recheck-report.md')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
