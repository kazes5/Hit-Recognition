import type { Song } from '../src/types.js';

export function song(partial: Partial<Song> & { id: number }): Song {
  return {
    artist: `Artist ${partial.id}`,
    title: `Title ${partial.id}`,
    year: 2000,
    language: 'en',
    genre: 'pop',
    ...partial,
  };
}

/** Deterministic RNG cycling through the given values. */
export function seq(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}
