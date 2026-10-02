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
