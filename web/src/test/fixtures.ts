import type { Song } from '../game/types';

let nextId = 1000;

export function song(year: number, overrides: Partial<Song> = {}): Song {
  const id = overrides.id ?? nextId++;
  return {
    id,
    artist: `Artist ${id}`,
    title: `Title ${id}`,
    year,
    language: 'en',
    genre: 'pop',
    ...overrides,
  };
}
