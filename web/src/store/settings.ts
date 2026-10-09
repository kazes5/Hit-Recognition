import type { DifficultySetting, Language, SongLanguageSetting } from '../game/types';

export const SONG_LANG_STORAGE_KEY = 'hitster.songLanguages';
export const DEFAULT_SONG_LANGS: SongLanguageSetting = 'both';

export function loadSongLanguages(): SongLanguageSetting {
  try {
    const v = localStorage.getItem(SONG_LANG_STORAGE_KEY);
    return v === 'he' || v === 'en' || v === 'both' ? v : DEFAULT_SONG_LANGS;
  } catch {
    return DEFAULT_SONG_LANGS;
  }
}

export function saveSongLanguages(value: SongLanguageSetting): void {
  try {
    localStorage.setItem(SONG_LANG_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function toLanguages(value: SongLanguageSetting): Language[] {
  return value === 'both' ? ['he', 'en'] : [value];
}

export const TOKENS_BETS_STORAGE_KEY = 'hitster.tokensAndBets';
/** The "Tokens & bets" switch in Setup is on unless this phone turned it off. */
export const DEFAULT_TOKENS_AND_BETS = true;

export function loadTokensAndBets(): boolean {
  try {
    const v = localStorage.getItem(TOKENS_BETS_STORAGE_KEY);
    return v === 'on' ? true : v === 'off' ? false : DEFAULT_TOKENS_AND_BETS;
  } catch {
    return DEFAULT_TOKENS_AND_BETS;
  }
}

export function saveTokensAndBets(value: boolean): void {
  try {
    localStorage.setItem(TOKENS_BETS_STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

export const DIFFICULTY_STORAGE_KEY = 'hitster.difficulty';
/** Easy by default: only the best-known songs (level 1). */
export const DEFAULT_DIFFICULTY: DifficultySetting = 'easy';

export function loadDifficulty(): DifficultySetting {
  try {
    const v = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    return v === 'easy' || v === 'medium' || v === 'hard' ? v : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

export function saveDifficulty(value: DifficultySetting): void {
  try {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Easy → 1 (level 1 only), Medium → 2 (levels 1–2), Hard → 3 (all levels). */
export function toMaxDifficulty(value: DifficultySetting): 1 | 2 | 3 {
  return value === 'easy' ? 1 : value === 'medium' ? 2 : 3;
}
