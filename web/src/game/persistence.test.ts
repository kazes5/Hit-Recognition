import { describe, expect, it } from 'vitest';
import { song } from '../test/fixtures';
import { clearSavedGame, GAME_STORAGE_KEY, loadSavedGame, saveGame } from './persistence';
import { gameReducer, initialGameState, type GameAction } from './reducer';
import type { GameState } from './types';

const inProgress = () =>
  gameReducer(
    gameReducer(initialGameState, { type: 'START_GAME', names: ['A'], targetScore: 5 }),
    { type: 'DEAL_CARD', song: song(1990) },
  );

describe('persistence', () => {
  it('saves and loads an in-progress game', () => {
    const s = inProgress();
    saveGame(s);
    expect(loadSavedGame()).toEqual(s);
  });

  it('does not keep finished or setup games', () => {
    saveGame(inProgress());
    saveGame(gameReducer(inProgress(), { type: 'END_GAME' }));
    expect(localStorage.getItem(GAME_STORAGE_KEY)).toBeNull();
    saveGame(initialGameState);
    expect(loadSavedGame()).toBeNull();
  });

  it('ignores corrupt or foreign data', () => {
    localStorage.setItem(GAME_STORAGE_KEY, '{not json');
    expect(loadSavedGame()).toBeNull();
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version: 99, state: inProgress() }));
    expect(loadSavedGame()).toBeNull();
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version: 1, state: { phase: 'turn' } }));
    expect(loadSavedGame()).toBeNull();
  });

  it('clearSavedGame removes it', () => {
    saveGame(inProgress());
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });
});

describe('persistence: tokens and bets (version 2)', () => {
  const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

  /**
   * Tokens and bets on. Ann holds 1980 and 2000 and put a 1990 song after 2000
   * (wrong); she typed names that were judged partly right. Ben bet on slot 1
   * (right). Slot 0 is still free, and Cat has not tried yet.
   */
  function bettingGame(): GameState {
    let s = run(
      initialGameState,
      { type: 'START_GAME', names: ['Ann', 'Ben', 'Cat'], targetScore: 5, tokensAndBets: true },
      { type: 'DEAL_CARD', song: song(2000, { id: 1 }) },
      { type: 'DEAL_CARD', song: song(2000, { id: 2 }) },
      { type: 'DEAL_CARD', song: song(2000, { id: 3 }) },
    );
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, timeline: [song(1980, { id: 5 }), ...p.timeline] } : p)) };
    return run(
      s,
      { type: 'SONG_READY', song: song(1990, { id: 4 }), previewUrl: '/x' },
      { type: 'SELECT_SLOT', index: 2 },
      { type: 'LOCK_IN', guess: { artist: 'abba', title: 'nope', artistCorrect: true, titleCorrect: false } },
      { type: 'BETTOR_START', playerIndex: 1 },
      { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: true },
      { type: 'PLACE_BET', slotIndex: 1 },
    );
  }

  const stored = () => JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) ?? 'null') as { version: number } | null;
  const store = (version: number, state: unknown) =>
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version, state }));

  it('round-trips a game in the betting round, with its bets, tries and an allowed bettor', () => {
    const s = run(
      bettingGame(),
      { type: 'BETTOR_START', playerIndex: 2 },
      { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: false },
    );
    expect(s.phase).toBe('betting');
    expect(s.bets).toEqual([{ playerIndex: 1, slotIndex: 1 }]);
    expect(s.triedThisTurn).toEqual([1, 2]);
    expect(s.activeBettor).toEqual({ playerIndex: 2, allowed: true });
    saveGame(s);
    expect(stored()?.version).toBe(2);
    const loaded = loadSavedGame();
    expect(loaded).toEqual(s);

    // The round goes on: Cat bets on slot 0 (wrong), then Reveal. Ben's earlier bet wins.
    const done = run(loaded as GameState, { type: 'PLACE_BET', slotIndex: 0 }, { type: 'REVEAL' });
    expect(done.phase).toBe('result');
    expect(done.lastResult?.cardWinnerIndex).toBe(1);
    expect(done.players.map((p) => p.tokens)).toEqual([1, 2, 0]);
  });

  it('keeps a bettor whose names were checked, allowed or not', () => {
    const denied = run(
      bettingGame(),
      { type: 'BETTOR_START', playerIndex: 2 },
      { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: false },
    );
    saveGame(denied);
    expect(loadSavedGame()).toEqual(denied);
    expect(loadSavedGame()?.activeBettor).toEqual({ playerIndex: 2, allowed: false });
  });

  it('sends a bettor whose names were not checked yet back to "Who\'s betting?", with their try unused', () => {
    const s = gameReducer(bettingGame(), { type: 'BETTOR_START', playerIndex: 2 });
    expect(s.activeBettor).toEqual({ playerIndex: 2, allowed: null });
    saveGame(s);
    const loaded = loadSavedGame();
    expect(loaded).toEqual({ ...s, activeBettor: null });
    expect(loaded?.triedThisTurn).toEqual([1]);
    expect(loaded?.bets).toEqual(s.bets);
    const again = gameReducer(loaded as GameState, { type: 'BETTOR_START', playerIndex: 2 });
    expect(again.activeBettor).toEqual({ playerIndex: 2, allowed: null });
  });

  it('round-trips a result, and "We accept it" still works after loading', () => {
    const s = gameReducer(bettingGame(), { type: 'REVEAL' });
    expect(s.lastResult?.cardWinnerIndex).toBe(1);
    saveGame(s);
    const loaded = loadSavedGame();
    expect(loaded).toEqual(s);
    const accepted = gameReducer(loaded as GameState, { type: 'ACCEPT_GUESS' });
    expect(accepted.lastResult?.accepted).toBe(true);
    expect(accepted.players).toEqual(s.lastResult?.playersBefore);
  });

  it('migrates a version 1 save: 1 token each, tokens and bets off, and the game still plays', () => {
    const v1 = {
      phase: 'turn',
      players: [
        { name: 'Ann', timeline: [song(2000, { id: 1 })] },
        { name: 'Ben', timeline: [song(1990, { id: 2 }), song(2010, { id: 3 })] },
      ],
      targetScore: 5,
      currentPlayerIndex: 1,
      dealtCount: 2,
      currentSong: null,
      currentPreviewUrl: null,
      selectedSlot: null,
      lastResult: null,
      usedIds: [1, 2, 3],
      usedArtists: ['Artist 1', 'Artist 2', 'Artist 3'],
      endedEarly: false,
    };
    store(1, v1);
    const loaded = loadSavedGame();
    expect(loaded).toEqual({
      ...v1,
      players: v1.players.map((p) => ({ ...p, tokens: 1 })),
      tokensAndBets: false,
      guess: null,
      bets: [],
      triedThisTurn: [],
      activeBettor: null,
    });

    // Ben plays under the old rules: Reveal works at once and no token moves.
    let s = run(
      loaded as GameState,
      { type: 'SONG_READY', song: song(2000, { id: 4 }), previewUrl: '/x' },
      { type: 'SELECT_SLOT', index: 1 },
      { type: 'REVEAL' },
    );
    expect(s.phase).toBe('result');
    expect(s.lastResult).toEqual({ song: expect.objectContaining({ id: 4 }), slotIndex: 1, correct: true });
    expect(s.players.map((p) => [p.timeline.length, p.tokens])).toEqual([
      [1, 1],
      [3, 1],
    ]);
    s = run(s, { type: 'NEXT' }, { type: 'SONG_READY', song: song(1980, { id: 5 }), previewUrl: '/x' }, { type: 'SELECT_SLOT', index: 0 }, { type: 'LOCK_IN' });
    expect(s.phase).toBe('result');
    expect(s.players[0]?.timeline).toHaveLength(2);
    expect(s.players.map((p) => p.tokens)).toEqual([1, 1]);
    saveGame(s);
    expect(stored()?.version).toBe(2);
  });

  it('migrates a version 1 save shown on the result screen', () => {
    const card = song(1995, { id: 9 });
    store(1, {
      phase: 'result',
      players: [{ name: 'Solo', timeline: [song(1990, { id: 8 }), card] }],
      targetScore: 5,
      currentPlayerIndex: 0,
      dealtCount: 1,
      currentSong: card,
      currentPreviewUrl: '/x',
      selectedSlot: 1,
      lastResult: { song: card, slotIndex: 1, correct: true },
      usedIds: [8, 9],
      usedArtists: ['Artist 8', 'Artist 9'],
      endedEarly: false,
    });
    const loaded = loadSavedGame() as GameState;
    expect(loaded.phase).toBe('result');
    expect(gameReducer(loaded, { type: 'ACCEPT_GUESS' })).toBe(loaded);
    expect(gameReducer(loaded, { type: 'NEXT' }).phase).toBe('turn');
  });

  it('ignores a save from an unknown version', () => {
    store(99, bettingGame());
    expect(loadSavedGame()).toBeNull();
    store(3, bettingGame());
    expect(loadSavedGame()).toBeNull();
  });

  it('rejects a version 2 save missing the token fields', () => {
    const s = bettingGame();
    store(2, { ...s, players: s.players.map(({ name, timeline }) => ({ name, timeline })) });
    expect(loadSavedGame()).toBeNull();
    for (const key of ['tokensAndBets', 'bets', 'triedThisTurn']) {
      const copy: Record<string, unknown> = { ...s };
      delete copy[key];
      store(2, copy);
      expect(loadSavedGame()).toBeNull();
    }
    store(2, s);
    expect(loadSavedGame()).toEqual(s);
  });
});
