import { START_TOKENS, type Player, type Song } from '../game/types';

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

/** A player whose timeline holds one card per year (sorted as given). */
export function player(name: string, years: number[] = [], tokens = START_TOKENS): Player {
  return { name, timeline: years.map((y) => song(y)), tokens };
}
