import {
  MAX_PLAYERS,
  MAX_TARGET,
  MIN_PLAYERS,
  MIN_TARGET,
  type Player,
  type Song,
} from './types';

/** Returns a new array sorted by year ascending; equal years keep their order. */
export function sortTimeline(timeline: readonly Song[]): Song[] {
  return timeline
    .map((song, i) => ({ song, i }))
    .sort((a, b) => a.song.year - b.song.year || a.i - b.i)
    .map((x) => x.song);
}

/**
 * Slot `i` (0…n) means "insert before the i-th card" of the sorted timeline;
 * `n` means after the last card. Correct iff prevYear <= year <= nextYear,
 * a missing neighbour being unbounded.
 */
export function isPlacementCorrect(
  timeline: readonly Song[],
  slotIndex: number,
  year: number,
): boolean {
  const sorted = sortTimeline(timeline);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > sorted.length) {
    return false;
  }
  const prev = slotIndex > 0 ? sorted[slotIndex - 1] : undefined;
  const next = slotIndex < sorted.length ? sorted[slotIndex] : undefined;
  if (prev && year < prev.year) return false;
  if (next && year > next.year) return false;
  return true;
}

/** Inserts the song at its chronological position (after equal years). */
export function insertCard(timeline: readonly Song[], song: Song): Song[] {
  const sorted = sortTimeline(timeline);
  let index = sorted.findIndex((c) => c.year > song.year);
  if (index === -1) index = sorted.length;
  return [...sorted.slice(0, index), song, ...sorted.slice(index)];
}

export function nextPlayerIndex(current: number, playerCount: number): number {
  if (playerCount <= 0) return 0;
  return (current + 1) % playerCount;
}

export function score(player: Player): number {
  return player.timeline.length;
}

export function hasReachedTarget(player: Player, target: number): boolean {
  return score(player) >= target;
}

/** Players with the highest score (several on a tie). Empty if no players. */
export function leaders(players: readonly Player[]): Player[] {
  if (players.length === 0) return [];
  const best = Math.max(...players.map(score));
  return players.filter((p) => score(p) === best);
}

/**
 * Winners of the game: anyone who reached the target; if nobody did
 * (game ended early) the leaders.
 */
export function findWinners(players: readonly Player[], target: number): Player[] {
  const reached = players.filter((p) => hasReachedTarget(p, target));
  return reached.length > 0 ? leaders(reached) : leaders(players);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export type NameError = 'empty' | 'duplicate' | 'tooMany';

export function validateNewPlayerName(
  name: string,
  existing: readonly string[],
): NameError | null {
  const n = normalizeName(name);
  if (!n) return 'empty';
  if (existing.length >= MAX_PLAYERS) return 'tooMany';
  const lower = n.toLocaleLowerCase();
  if (existing.some((e) => normalizeName(e).toLocaleLowerCase() === lower)) return 'duplicate';
  return null;
}

export function isValidTarget(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_TARGET && value <= MAX_TARGET;
}

export function canStartGame(names: readonly string[], target: number): boolean {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) return false;
  const normalized = names.map((n) => normalizeName(n).toLocaleLowerCase());
  if (normalized.some((n) => !n)) return false;
  if (new Set(normalized).size !== normalized.length) return false;
  return isValidTarget(target);
}

/** Adds an artist to the used list unless already present (case-insensitive). */
export function addUsedArtist(artists: readonly string[], artist: string): string[] {
  const lower = artist.toLocaleLowerCase();
  return artists.some((a) => a.toLocaleLowerCase() === lower) ? [...artists] : [...artists, artist];
}

export function addUsedId(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

/** Decade bucket used for the card colour, clamped to 1950…2020. */
export function decadeOf(year: number): number {
  const d = Math.floor(year / 10) * 10;
  return Math.min(2020, Math.max(1950, d));
}
