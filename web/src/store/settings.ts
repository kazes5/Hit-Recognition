import type { Language, SongLanguageSetting } from '../game/types';

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
