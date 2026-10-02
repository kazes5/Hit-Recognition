import { describe, expect, it } from 'vitest';
import { song } from '../test/fixtures';
import { clearSavedGame, GAME_STORAGE_KEY, loadSavedGame, saveGame } from './persistence';
import { gameReducer, initialGameState } from './reducer';

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
