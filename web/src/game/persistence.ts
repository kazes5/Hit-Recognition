import type { GameState, Phase } from './types';

export const GAME_STORAGE_KEY = 'hitster.game';
const VERSION = 1;

const RESUMABLE: Phase[] = ['dealing', 'turn', 'result'];

export function isResumable(state: GameState): boolean {
  return RESUMABLE.includes(state.phase) && state.players.length > 0;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (isResumable(state)) {
      storage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version: VERSION, state }));
    } else {
      storage.removeItem(GAME_STORAGE_KEY);
    }
  } catch {
    /* storage full / blocked: resume is a convenience only */
  }
}

export function clearSavedGame(): void {
  try {
    safeStorage()?.removeItem(GAME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function looksLikeState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.phase === 'string' &&
    Array.isArray(s.players) &&
    s.players.every(
      (p) =>
        !!p &&
        typeof (p as Record<string, unknown>).name === 'string' &&
        Array.isArray((p as Record<string, unknown>).timeline),
    ) &&
    typeof s.targetScore === 'number' &&
    typeof s.currentPlayerIndex === 'number' &&
    typeof s.dealtCount === 'number' &&
    Array.isArray(s.usedIds) &&
    Array.isArray(s.usedArtists)
  );
}

export function loadSavedGame(): GameState | null {
  try {
    const raw = safeStorage()?.getItem(GAME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; state?: unknown };
    if (parsed.version !== VERSION || !looksLikeState(parsed.state)) return null;
    return isResumable(parsed.state) ? parsed.state : null;
  } catch {
    return null;
  }
}
