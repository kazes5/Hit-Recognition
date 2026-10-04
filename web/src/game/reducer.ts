import {
  addUsedArtist,
  addUsedId,
  anyReachedTarget,
  canStartGame,
  insertCard,
  nextPlayerIndex,
  normalizeName,
} from './rules';
import { anyoneCouldBet, canSkip, earnsBet, eligibleBettors, freeBetSlots, namesCorrect, settleTurn, spendTokens } from './tokens';
import {
  DEFAULT_TARGET,
  SKIP_COST,
  START_TOKENS,
  type GameState,
  type NameGuess,
  type Song,
  type TurnResult,
} from './types';

export type GameAction =
  /** `tokensAndBets` defaults to off, so a game started without it plays as before. */
  | { type: 'START_GAME'; names: string[]; targetScore: number; tokensAndBets?: boolean }
  /** Starting card for the next player still waiting for one. */
  | { type: 'DEAL_CARD'; song: Song }
  /** A song was fetched; mark it used even if it turns out to be unplayable. */
  | { type: 'MARK_USED'; song: Song }
  | { type: 'SONG_READY'; song: Song; previewUrl: string }
  /** Preview missing / failed to load: drop the song (id stays used). */
  | { type: 'SONG_FAILED' }
  | { type: 'SELECT_SLOT'; index: number }
  /** Pay SKIP_COST tokens to drop the current song before Lock in; a new song is fetched. */
  | { type: 'SKIP_SONG' }
  /** The current player confirms the spot (and the server-checked names, if typed): opens bets, or reveals. */
  | { type: 'LOCK_IN'; guess?: NameGuess | null }
  /** A player takes the phone to try to bet (first come, first served). */
  | { type: 'BETTOR_START'; playerIndex: number }
  /** The server checked the active bettor's names: one right part earns the bet. Uses up their try. */
  | { type: 'BETTOR_JUDGED'; artistCorrect: boolean; titleCorrect: boolean }
  | { type: 'PLACE_BET'; slotIndex: number }
  /** The active bettor gives the phone back (after "Not this time", or Cancel). */
  | { type: 'BETTOR_DONE' }
  | { type: 'REVEAL' }
  /** "We accept it": the current player's rejected names count, so this turn's bets are cancelled. */
  | { type: 'ACCEPT_GUESS' }
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
  tokensAndBets: false,
  guess: null,
  bets: [],
  triedThisTurn: [],
  activeBettor: null,
};

/** The per-turn naming and betting fields, reset between turns. */
function clearedTurn(): Pick<GameState, 'guess' | 'bets' | 'triedThisTurn' | 'activeBettor'> {
  return { guess: null, bets: [], triedThisTurn: [], activeBettor: null };
}

/** Settles the turn (docs/TOKENS_AND_BETS.md §5.3) and shows the result. */
function reveal(state: GameState): GameState {
  const current = state.currentPlayerIndex;
  const song = state.currentSong;
  const pickedSlot = state.selectedSlot;
  if (!song || pickedSlot === null || !state.players[current]) return state;
  const settled = settleTurn({
    players: state.players,
    current,
    song,
    pickedSlot,
    bets: state.bets,
    tokensAndBets: state.tokensAndBets,
  });
  const lastResult: TurnResult = { song, slotIndex: pickedSlot, correct: settled.correct };
  if (state.tokensAndBets) {
    lastResult.guess = state.guess;
    lastResult.bets = settled.bets;
    lastResult.cardWinnerIndex = settled.cardWinnerIndex;
    lastResult.playersBefore = state.players;
  }
  return {
    ...markUsed(state, song),
    players: settled.players,
    phase: 'result',
    lastResult,
    activeBettor: null,
  };
}

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
        players: names.map((name) => ({ name, timeline: [], tokens: START_TOKENS })),
        targetScore: action.targetScore,
        tokensAndBets: action.tokensAndBets ?? false,
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
        ...clearedTurn(),
      };
    }

    case 'SONG_FAILED': {
      // Also mid-bet: the turn starts again with a new song; no token has moved yet.
      if (state.phase !== 'turn' && state.phase !== 'betting') return state;
      const withUsed = state.currentSong ? markUsed(state, state.currentSong) : state;
      return {
        ...withUsed,
        phase: 'turn',
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
        ...clearedTurn(),
      };
    }

    case 'SKIP_SONG': {
      if (!canSkip(state) || !state.currentSong) return state;
      const idx = state.currentPlayerIndex;
      return {
        ...markUsed(state, state.currentSong),
        players: state.players.map((p, i) => (i === idx ? { ...p, tokens: spendTokens(p.tokens, SKIP_COST) } : p)),
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
        ...clearedTurn(),
      };
    }

    case 'SELECT_SLOT': {
      if (state.phase !== 'turn') return state;
      const player = state.players[state.currentPlayerIndex];
      if (!player) return state;
      const { index } = action;
      if (!Number.isInteger(index) || index < 0 || index > player.timeline.length) return state;
      return { ...state, selectedSlot: index };
    }

    case 'LOCK_IN': {
      if (state.phase !== 'turn' || !state.currentSong || state.selectedSlot === null) return state;
      const locked: GameState = {
        ...state,
        ...clearedTurn(),
        guess: state.tokensAndBets ? (action.guess ?? null) : null,
      };
      return eligibleBettors(locked).length > 0 ? { ...locked, phase: 'betting' } : reveal(locked);
    }

    case 'BETTOR_START': {
      if (state.phase !== 'betting' || state.activeBettor) return state;
      if (!eligibleBettors(state).includes(action.playerIndex)) return state;
      return { ...state, activeBettor: { playerIndex: action.playerIndex, allowed: null } };
    }

    case 'BETTOR_JUDGED': {
      const active = state.activeBettor;
      if (state.phase !== 'betting' || !active || active.allowed !== null) return state;
      return {
        ...state,
        activeBettor: { ...active, allowed: earnsBet(action.artistCorrect, action.titleCorrect) },
        triedThisTurn: [...state.triedThisTurn, active.playerIndex],
      };
    }

    case 'PLACE_BET': {
      const active = state.activeBettor;
      if (state.phase !== 'betting' || !active || active.allowed !== true) return state;
      const current = state.players[state.currentPlayerIndex];
      const bettor = state.players[active.playerIndex];
      if (!current || !bettor || bettor.tokens < 1 || state.selectedSlot === null) return state;
      if (!freeBetSlots(current.timeline.length, state.selectedSlot, state.bets).includes(action.slotIndex)) {
        return state;
      }
      return {
        ...state,
        bets: [...state.bets, { playerIndex: active.playerIndex, slotIndex: action.slotIndex }],
        activeBettor: null,
      };
    }

    case 'BETTOR_DONE': {
      if (state.phase !== 'betting' || !state.activeBettor) return state;
      return { ...state, activeBettor: null };
    }

    case 'REVEAL': {
      if (!state.currentSong || state.selectedSlot === null) return state;
      // In a turn, Reveal is only for when nobody could bet; otherwise the player locks in first.
      if (state.phase === 'turn' && !(state.tokensAndBets && anyoneCouldBet(state))) return reveal(state);
      if (state.phase === 'betting' && !state.activeBettor) return reveal(state);
      return state;
    }

    case 'ACCEPT_GUESS': {
      const r = state.lastResult;
      if (state.phase !== 'result' || !r || r.accepted || !r.playersBefore || !r.bets?.length) return state;
      if (namesCorrect(r.guess ?? null)) return state;
      const settled = settleTurn({
        players: r.playersBefore,
        current: state.currentPlayerIndex,
        song: r.song,
        pickedSlot: r.slotIndex,
        bets: r.bets.map(({ playerIndex, slotIndex }) => ({ playerIndex, slotIndex })),
        tokensAndBets: state.tokensAndBets,
        accepted: true,
      });
      return {
        ...state,
        players: settled.players,
        lastResult: { ...r, bets: settled.bets, cardWinnerIndex: settled.cardWinnerIndex, accepted: true },
      };
    }

    case 'NEXT': {
      if (state.phase !== 'result') return state;
      if (anyReachedTarget(state.players, state.targetScore)) {
        return { ...state, phase: 'winner', currentSong: null, currentPreviewUrl: null, ...clearedTurn() };
      }
      return {
        ...state,
        phase: 'turn',
        currentPlayerIndex: nextPlayerIndex(state.currentPlayerIndex, state.players.length),
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
        lastResult: null,
        ...clearedTurn(),
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
        ...clearedTurn(),
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
