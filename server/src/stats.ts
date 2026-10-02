import type { Language, Song } from './types.js';

export interface CatalogStats {
  total: number;
  byLanguage: Record<Language, number>;
  byDecade: Record<string, number>;
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function computeStats(songs: readonly Song[]): CatalogStats {
  const byLanguage: Record<Language, number> = { he: 0, en: 0 };
  const decadeCounts = new Map<number, number>();
  for (const song of songs) {
    byLanguage[song.language] += 1;
    const decade = decadeOf(song.year);
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  const byDecade: Record<string, number> = {};
  for (const decade of [...decadeCounts.keys()].sort((a, b) => a - b)) {
    byDecade[String(decade)] = decadeCounts.get(decade) ?? 0;
  }
  return { total: songs.length, byLanguage, byDecade };
}
