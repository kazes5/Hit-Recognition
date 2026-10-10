// The real modules behind the batch and the recheck, loaded on demand so the
// orchestration (and its tests, which inject stubs) loads without them.
// Paths and signatures: pipeline/INTERFACES.md.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultHttp } from '../sources/http.mjs';
import { lookupSong } from './lookup.mjs';

const PIPELINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Default selection when build/select.mjs is not there (or exports none of the known names):
 * higher-ranked songs first (D7, task 3.6); ties broken by the number of charts the song was
 * on, then the chart year. Ranking first gives every chart year the same share, which keeps
 * the decades balanced.
 */
export function defaultSelect(candidates, { size }) {
  return [...candidates]
    .sort((a, b) => (a.bestRank ?? a.rank ?? 99) - (b.bestRank ?? b.rank ?? 99) || (b.charts?.length ?? 1) - (a.charts?.length ?? 1) || (a.firstChartYear ?? a.chartYear ?? 0) - (b.firstChartYear ?? b.chartYear ?? 0))
    .slice(0, size);
}

async function selectFn() {
  try {
    const m = await import('../build/select.mjs');
    const fn = m.selectBatch ?? m.selectCandidates ?? m.select ?? m.default;
    if (typeof fn === 'function') {
      return async (cands, opts) => {
        const r = await fn(cands, opts);
        return Array.isArray(r) ? r : r?.selected ?? [];
      };
    }
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
  return defaultSelect;
}

export function readArtistGenres() {
  return JSON.parse(readFileSync(path.join(PIPELINE, 'artist-genres.json'), 'utf8'));
}

/** import() with a clear message when a work stream's module is not there yet. */
async function need(spec) {
  try {
    return await import(spec);
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(spec.slice(2))) throw new Error(`pipeline module missing: pipeline${spec.slice(2)} (see pipeline/INTERFACES.md)`);
    throw e;
  }
}

export async function loadBatchDeps() {
  const [{ extract }, { matchCatalog }, { assignGenre }, { computeDifficulty }, { readCatalog }] = await Promise.all([
    need('../candidates/index.mjs'),
    need('../build/match.mjs'),
    need('../build/genre.mjs'),
    need('../build/difficulty.mjs'),
    need('../build/catalog-io.mjs'),
  ]);
  return {
    extract,
    matchCatalog,
    assignGenre,
    computeDifficulty,
    readCatalog,
    artistGenres: readArtistGenres(),
    select: await selectFn(),
    lookup: (song) => lookupSong(song, { aliases: true }),
    httpStats: () => defaultHttp().stats,
  };
}

export async function loadRecheckDeps() {
  const { readCatalog, writeCatalog } = await need('../build/catalog-io.mjs');
  return {
    readCatalog,
    writeCatalog,
    lookup: (song) => lookupSong(song),
    httpStats: () => defaultHttp().stats,
  };
}
