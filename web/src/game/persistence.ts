import { START_TOKENS, type GameState, type Phase } from './types';

export const GAME_STORAGE_KEY = 'hitster.game';
/** 2: tokens, naming and bets. Version 1 saves are migrated and finish with tokens and bets off. */
const VERSION = 2;

const RESUMABLE: Phase[] = ['dealing', 'turn', 'betting', 'result'];

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

/** Checks the fields every version has. */
function looksLikeBaseState(value: unknown): value is Record<string, unknown> & { players: Record<string, unknown>[] } {
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

function looksLikeState(value: unknown): value is GameState {
  if (!looksLikeBaseState(value)) return false;
  return (
    value.players.every((p) => typeof p.tokens === 'number') &&
    typeof value.tokensAndBets === 'boolean' &&
    Array.isArray(value.bets) &&
    Array.isArray(value.triedThisTurn)
  );
}

/** A version 1 game gets 1 token per player and finishes with tokens and bets off. */
function migrateV1(value: unknown): unknown {
  if (!looksLikeBaseState(value)) return value;
  return {
    ...value,
    players: value.players.map((p) => ({ ...p, tokens: START_TOKENS })),
    tokensAndBets: false,
    guess: null,
    bets: [],
    triedThisTurn: [],
    activeBettor: null,
  };
}

/** A bettor whose names were not checked yet goes back to "Who's betting?"; their try is not used. */
function resumeState(state: GameState): GameState {
  return state.activeBettor?.allowed === null ? { ...state, activeBettor: null } : state;
}

export function loadSavedGame(): GameState | null {
  try {
    const raw = safeStorage()?.getItem(GAME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; state?: unknown };
    const state = parsed.version === 1 ? migrateV1(parsed.state) : parsed.version === VERSION ? parsed.state : null;
    if (!looksLikeState(state)) return null;
    return isResumable(state) ? resumeState(state) : null;
  } catch {
    return null;
  }
}
