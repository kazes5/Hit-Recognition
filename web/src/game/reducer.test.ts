import { describe, expect, it } from 'vitest';
import { song } from '../test/fixtures';
import { gameReducer, initialGameState, type GameAction } from './reducer';
import type { GameState } from './types';

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

function startedGame(names = ['Ann', 'Ben'], target = 3): GameState {
  let s = gameReducer(initialGameState, { type: 'START_GAME', names, targetScore: target });
  names.forEach((_, i) => {
    s = gameReducer(s, { type: 'DEAL_CARD', song: song(2000, { id: i + 1, artist: `Dealt ${i}` }) });
  });
  return s;
}

describe('gameReducer: setup → dealing', () => {
  it('starts dealing with empty timelines', () => {
    const s = gameReducer(initialGameState, { type: 'START_GAME', names: [' Ann ', 'Ben'], targetScore: 5 });
    expect(s.phase).toBe('dealing');
    expect(s.players.map((p) => p.name)).toEqual(['Ann', 'Ben']);
    expect(s.players.every((p) => p.timeline.length === 0)).toBe(true);
    expect(s.targetScore).toBe(5);
    expect(s.dealtCount).toBe(0);
  });

  it('ignores invalid starts', () => {
    expect(gameReducer(initialGameState, { type: 'START_GAME', names: [], targetScore: 10 })).toBe(initialGameState);
    expect(gameReducer(initialGameState, { type: 'START_GAME', names: ['A', 'a'], targetScore: 10 })).toBe(
      initialGameState,
    );
    expect(gameReducer(initialGameState, { type: 'START_GAME', names: ['A'], targetScore: 1 })).toBe(initialGameState);
  });

  it('deals one card per player then moves to the first turn', () => {
    let s = gameReducer(initialGameState, { type: 'START_GAME', names: ['A', 'B'], targetScore: 5 });
    s = gameReducer(s, { type: 'DEAL_CARD', song: song(1970, { id: 1, artist: 'X' }) });
    expect(s.phase).toBe('dealing');
    expect(s.dealtCount).toBe(1);
    s = gameReducer(s, { type: 'DEAL_CARD', song: song(1980, { id: 2, artist: 'Y' }) });
    expect(s.phase).toBe('turn');
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.players[0]?.timeline.map((c) => c.id)).toEqual([1]);
    expect(s.players[1]?.timeline.map((c) => c.id)).toEqual([2]);
    expect(s.usedIds).toEqual([1, 2]);
    expect(s.usedArtists).toEqual(['X', 'Y']);
  });

  it('keeps one usedArtists entry per dealt song, even for the same artist', () => {
    let s = gameReducer(initialGameState, { type: 'START_GAME', names: ['A', 'B'], targetScore: 5 });
    s = gameReducer(s, { type: 'DEAL_CARD', song: song(1970, { id: 1, artist: 'ABBA' }) });
    s = gameReducer(s, { type: 'DEAL_CARD', song: song(1980, { id: 2, artist: 'abba' }) });
    expect(s.usedArtists).toEqual(['ABBA', 'abba']);
  });

  it('MARK_USED followed by SONG_READY for the same song adds a single artist entry', () => {
    const base = startedGame();
    const n = base.usedArtists.length;
    const sg = song(1990, { id: 70, artist: 'Queen' });
    let s = gameReducer(base, { type: 'MARK_USED', song: sg });
    s = gameReducer(s, { type: 'SONG_READY', song: sg, previewUrl: '/a.mp3' });
    expect(s.usedArtists).toHaveLength(n + 1);
  });

  it('ignores DEAL_CARD outside dealing', () => {
    const s = startedGame();
    expect(gameReducer(s, { type: 'DEAL_CARD', song: song(1990) })).toBe(s);
  });
});

describe('gameReducer: turn → result → next', () => {
  it('SONG_READY sets the song and marks it used', () => {
    const s = gameReducer(startedGame(), {
      type: 'SONG_READY',
      song: song(1990, { id: 50, artist: 'Queen' }),
      previewUrl: '/a.mp3',
    });
    expect(s.currentSong?.id).toBe(50);
    expect(s.currentPreviewUrl).toBe('/a.mp3');
    expect(s.usedIds).toContain(50);
    expect(s.usedArtists).toContain('Queen');
  });

  it('MARK_USED records skipped songs; SONG_FAILED drops the song but keeps it used', () => {
    let s = gameReducer(startedGame(), { type: 'MARK_USED', song: song(1990, { id: 60 }) });
    expect(s.usedIds).toContain(60);
    s = gameReducer(s, { type: 'SONG_READY', song: song(1991, { id: 61 }), previewUrl: '/x' });
    s = gameReducer(s, { type: 'SELECT_SLOT', index: 0 });
    s = gameReducer(s, { type: 'SONG_FAILED' });
    expect(s.currentSong).toBeNull();
    expect(s.currentPreviewUrl).toBeNull();
    expect(s.selectedSlot).toBeNull();
    expect(s.usedIds).toEqual(expect.arrayContaining([60, 61]));
  });

  it('SELECT_SLOT validates the index', () => {
    const s = startedGame(); // each player has 1 card → slots 0..1
    expect(gameReducer(s, { type: 'SELECT_SLOT', index: 1 }).selectedSlot).toBe(1);
    expect(gameReducer(s, { type: 'SELECT_SLOT', index: 2 }).selectedSlot).toBeNull();
    expect(gameReducer(s, { type: 'SELECT_SLOT', index: -1 }).selectedSlot).toBeNull();
  });

  it('REVEAL requires a song and a slot', () => {
    const s = startedGame();
    expect(gameReducer(s, { type: 'REVEAL' })).toBe(s);
    const withSong = gameReducer(s, { type: 'SONG_READY', song: song(1990), previewUrl: '/x' });
    expect(gameReducer(withSong, { type: 'REVEAL' })).toBe(withSong);
  });

  it('correct placement adds the card', () => {
    const s = run(
      startedGame(),
      { type: 'SONG_READY', song: song(1990, { id: 77 }), previewUrl: '/x' },
      { type: 'SELECT_SLOT', index: 0 },
      { type: 'REVEAL' },
    );
    expect(s.phase).toBe('result');
    expect(s.lastResult).toMatchObject({ correct: true, slotIndex: 0 });
    expect(s.players[0]?.timeline.map((c) => c.year)).toEqual([1990, 2000]);
  });

  it('wrong placement discards the card', () => {
    const s = run(
      startedGame(),
      { type: 'SONG_READY', song: song(1990, { id: 78 }), previewUrl: '/x' },
      { type: 'SELECT_SLOT', index: 1 },
      { type: 'REVEAL' },
    );
    expect(s.lastResult?.correct).toBe(false);
    expect(s.players[0]?.timeline).toHaveLength(1);
    expect(s.usedIds).toContain(78);
  });

  it('NEXT rotates to the next player and clears the turn', () => {
    const s = run(
      startedGame(['A', 'B', 'C']),
      { type: 'SONG_READY', song: song(1990), previewUrl: '/x' },
      { type: 'SELECT_SLOT', index: 1 },
      { type: 'REVEAL' },
      { type: 'NEXT' },
    );
    expect(s.phase).toBe('turn');
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.currentSong).toBeNull();
    expect(s.selectedSlot).toBeNull();
    expect(s.lastResult).toBeNull();
  });

  it('rotation wraps from last player back to the first', () => {
    let s = startedGame(['A', 'B']);
    for (let i = 0; i < 2; i++) {
      s = run(
        s,
        { type: 'SONG_READY', song: song(1990), previewUrl: '/x' },
        { type: 'SELECT_SLOT', index: 1 },
        { type: 'REVEAL' },
        { type: 'NEXT' },
      );
    }
    expect(s.currentPlayerIndex).toBe(0);
  });

  it('NEXT shows the winner once the player reaches the target', () => {
    let s = startedGame(['A', 'B'], 3);
    // A: correct (2 cards) → B: wrong → A: correct (3 cards = target)
    const turn = (year: number, slot: number) =>
      (s = run(
        s,
        { type: 'SONG_READY', song: song(year), previewUrl: '/x' },
        { type: 'SELECT_SLOT', index: slot },
        { type: 'REVEAL' },
      ));
    turn(1990, 0);
    s = gameReducer(s, { type: 'NEXT' });
    turn(1990, 1);
    s = gameReducer(s, { type: 'NEXT' });
    turn(2010, 2);
    expect(s.players[0]?.timeline).toHaveLength(3);
    expect(s.phase).toBe('result');
    s = gameReducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('winner');
  });

  it('NEXT outside result is ignored', () => {
    const s = startedGame();
    expect(gameReducer(s, { type: 'NEXT' })).toBe(s);
  });
});

describe('gameReducer: end, reset, restore', () => {
  it('END_GAME jumps to the winner screen early', () => {
    const s = gameReducer(startedGame(), { type: 'END_GAME' });
    expect(s.phase).toBe('winner');
    expect(s.endedEarly).toBe(true);
  });

  it('END_GAME is ignored in setup', () => {
    expect(gameReducer(initialGameState, { type: 'END_GAME' })).toBe(initialGameState);
  });

  it('RESET returns to setup and RESTORE replaces the state', () => {
    const s = startedGame();
    expect(gameReducer(s, { type: 'RESET' })).toEqual(initialGameState);
    expect(gameReducer(initialGameState, { type: 'RESTORE', state: s })).toBe(s);
  });
});
