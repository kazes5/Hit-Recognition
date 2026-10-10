import type { CatalogSong } from '../src/types.js';

export function song(partial: Partial<CatalogSong> & { id: number }): CatalogSong {
  return {
    artist: `Artist ${partial.id}`,
    title: `Title ${partial.id}`,
    year: 2000,
    language: 'en',
    genre: 'pop',
    difficulty: 1,
    ...partial,
  };
}

/** Deterministic RNG cycling through the given values. */
export function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}
