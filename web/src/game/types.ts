export type Language = 'he' | 'en';
export type Genre = 'pop' | 'rock' | 'light-rock' | 'classic-rock';

/** Song as returned by the API (docs/CONTRACTS.md §4). */
export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number;
  language: Language;
  genre: Genre;
}

export type SongLanguageSetting = 'he' | 'en' | 'both';

export interface Player {
  name: string;
  /** Cards sorted by year ascending (stable for equal years). */
  timeline: Song[];
}

export type Phase = 'setup' | 'dealing' | 'turn' | 'result' | 'winner';

export interface TurnResult {
  song: Song;
  slotIndex: number;
  correct: boolean;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  targetScore: number;
  currentPlayerIndex: number;
  /** Number of players who already received their starting card. */
  dealtCount: number;
  /** Song currently being guessed (hidden until reveal). */
  currentSong: Song | null;
  currentPreviewUrl: string | null;
  selectedSlot: number | null;
  lastResult: TurnResult | null;
  /** Every song id that appeared in this game (dealt, played or skipped). */
  usedIds: number[];
  /** Every artist that appeared in this game (unique, original casing). */
  usedArtists: string[];
  endedEarly: boolean;
}

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 10;
export const MIN_TARGET = 3;
export const MAX_TARGET = 30;
export const DEFAULT_TARGET = 10;
export const CLIP_SECONDS = 30;
export const DECK_CODE = 'IL01';
