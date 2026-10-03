import {
  addUsedArtist,
  addUsedId,
  canStartGame,
  hasReachedTarget,
  insertCard,
  isPlacementCorrect,
  nextPlayerIndex,
  normalizeName,
} from './rules';
import { DEFAULT_TARGET, type GameState, type Song } from './types';

export type GameAction =
  | { type: 'START_GAME'; names: string[]; targetScore: number }
  /** Starting card for the next player still waiting for one. */
  | { type: 'DEAL_CARD'; song: Song }
  /** A song was fetched; mark it used even if it turns out to be unplayable. */
  | { type: 'MARK_USED'; song: Song }
  | { type: 'SONG_READY'; song: Song; previewUrl: string }
  /** Preview missing / failed to load: drop the song (id stays used). */
  | { type: 'SONG_FAILED' }
  | { type: 'SELECT_SLOT'; index: number }
  | { type: 'REVEAL' }
  | { type: 'NEXT' }
  | { type: 'END_GAME' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: GameState };

export const initialGameState: GameState = {
  phase: 'setup',
  players: [],
  targetScore: DEFAULT_TARGET,
  currentPlayerIndex: 0,
  dealtCount: 0,
  currentSong: null,
  currentPreviewUrl: null,
  selectedSlot: null,
  lastResult: null,
  usedIds: [],
  usedArtists: [],
  endedEarly: false,
};

/** Records a dealt song once: one usedArtists entry per distinct song id (MARK_USED then SONG_READY must not double-count). */
function markUsed(state: GameState, song: Song): GameState {
  if (state.usedIds.includes(song.id)) return state;
  return {
    ...state,
    usedIds: addUsedId(state.usedIds, song.id),
    usedArtists: addUsedArtist(state.usedArtists, song.artist),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const names = action.names.map(normalizeName);
      if (!canStartGame(names, action.targetScore)) return state;
      return {
        ...initialGameState,
        phase: 'dealing',
        players: names.map((name) => ({ name, timeline: [] })),
        targetScore: action.targetScore,
      };
    }

    case 'DEAL_CARD': {
      if (state.phase !== 'dealing') return state;
      const idx = state.dealtCount;
      const player = state.players[idx];
      if (!player) return state;
      const players = state.players.map((p, i) =>
        i === idx ? { ...p, timeline: insertCard(p.timeline, action.song) } : p,
      );
      const dealtCount = idx + 1;
      const done = dealtCount >= players.length;
      return {
        ...markUsed(state, action.song),
        players,
        dealtCount,
        phase: done ? 'turn' : 'dealing',
        currentPlayerIndex: 0,
      };
    }

    case 'MARK_USED':
      return markUsed(state, action.song);

    case 'SONG_READY': {
      if (state.phase !== 'turn') return state;
      return {
        ...markUsed(state, action.song),
        currentSong: action.song,
        currentPreviewUrl: action.previewUrl,
        selectedSlot: null,
      };
    }

    case 'SONG_FAILED': {
      if (state.phase !== 'turn') return state;
      const withUsed = state.currentSong ? markUsed(state, state.currentSong) : state;
      return { ...withUsed, currentSong: null, currentPreviewUrl: null, selectedSlot: null };
    }

    case 'SELECT_SLOT': {
      if (state.phase !== 'turn') return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player) return state;
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index > player.timeline.length) return state;
      return { ...state, selectedSlot: index };
    }

    case 'REVEAL': {
      if (state.phase !== 'turn' || !state.currentSong || state.selectedSlot === null) return state;
      const idx = state.currentPlayerIndex;
      const player = state.players[idx];
      if (!player) return state;
      const song = state.currentSong;
      const correct = isPlacementCorrect(player.timeline, state.selectedSlot, song.year);
      const players = correct
        ? state.players.map((p, i) => (i === idx ? { ...p, timeline: insertCard(p.timeline, song) } : p))
        : state.players;
      return {
        ...markUsed(state, song),
        players,
        phase: 'result',
        lastResult: { song, slotIndex: state.selectedSlot, correct },
      };
    }

    case 'NEXT': {
      if (state.phase !== 'result') return state;
      const player = state.players[state.currentPlayerIndex];
      if (player && hasReachedTarget(player, state.targetScore)) {
        return { ...state, phase: 'winner', currentSong: null, currentPreviewUrl: null };
      }
      return {
        ...state,
        phase: 'turn',
        currentPlayerIndex: nextPlayerIndex(state.currentPlayerIndex, state.players.length),
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
        lastResult: null,
      };
    }

    case 'END_GAME': {
      if (state.phase === 'setup' || state.phase === 'winner') return state;
      return {
        ...state,
        phase: 'winner',
        endedEarly: true,
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
      };
    }

    case 'RESET':
      return initialGameState;

    case 'RESTORE':
      return action.state;

    default:
      return state;
  }
}
