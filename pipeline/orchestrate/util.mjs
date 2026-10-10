// Small helpers shared by batch.mjs and recheck.mjs (task 3.7, 3.8).
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { norm, normArtist } from '../sources/normalize.mjs';

/** --key value pairs and bare --flags → object. `known` maps flag → 'value' | 'bool'. */
export function parseArgs(argv, known) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const name = k.replace(/^--/, '');
    if (!k.startsWith('--') || !(name in known)) throw new Error(`unknown argument ${k}`);
    if (known[name] === 'bool') out[name] = true;
    else {
      if (argv[i + 1] === undefined) throw new Error(`${k} needs a value`);
      out[name] = argv[++i];
    }
  }
  return out;
}

/** Stable key of a song: language|performer|title, normalised. */
export const songKey = (s) => `${s.language}|${normArtist(s.artist)}|${norm(s.title)}`;

export const decadeOf = (y) => (Number.isInteger(y) ? `${Math.floor(y / 10) * 10}s` : 'unknown');

export const sha = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);

/** One CSV field (RFC 4180). */
export function csvField(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join(';') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text with a header row. A BOM makes Excel read the Hebrew as UTF-8. */
export function toCsv(columns, rows) {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(','))];
  return '﻿' + lines.join('\n') + '\n';
}

/** Run fn over items with at most `limit` in flight; results keep the input order. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/** Count values: [['a', 3], ['b', 1]] sorted by count desc, then key. */
export function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) for (const k of [keyFn(it)].flat()) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export const mdTable = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');

/**
 * Resume log: one JSON line per finished item in <dir>/<file>. A restarted run reads it
 * and skips the keys it already has. Lines written by a killed process may be cut off;
 * those are ignored.
 */
export function createProgress(dir, file = 'progress.jsonl') {
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, file);
  const done = new Map();
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const { key, value } = JSON.parse(line);
        if (key) done.set(key, value);
      } catch {
        // partial line from an interrupted run
      }
    }
  }
  return {
    file: p,
    done,
    record(key, value) {
      done.set(key, value);
      appendFileSync(p, JSON.stringify({ key, value }) + '\n');
    },
  };
}

export function readJsonIf(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 1) + '\n');
}
