import { describe, expect, it } from 'vitest';
import { song } from '../test/fixtures';
import { gameReducer, initialGameState, type GameAction } from './reducer';
import { findWinners, wonOnTokens } from './rules';
import { MAX_TOKENS, START_TOKENS, type GameState, type NameGuess, type Player } from './types';

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

describe('gameReducer: tokens and bets', () => {
  const guess = (artistCorrect: boolean, titleCorrect: boolean): NameGuess => ({
    artist: 'typed artist',
    title: 'typed title',
    artistCorrect,
    titleCorrect,
  });

  /** Tokens and bets on; every player was dealt one card from 2000. */
  function tokenGame(names = ['Ann', 'Ben', 'Cat'], target = 10): GameState {
    let s = gameReducer(initialGameState, { type: 'START_GAME', names, targetScore: target, tokensAndBets: true });
    names.forEach((_, i) => {
      s = gameReducer(s, { type: 'DEAL_CARD', song: song(2000, { id: 100 + i, artist: `Dealt ${i}` }) });
    });
    return s;
  }

  const setPlayer = (s: GameState, i: number, patch: Partial<Player>): GameState => ({
    ...s,
    players: s.players.map((p, j) => (j === i ? { ...p, ...patch } : p)),
  });

  /** Gives player `i` one card per year. */
  const board = (s: GameState, i: number, years: number[]) => setPlayer(s, i, { timeline: years.map((y) => song(y)) });

  /** The current player hears a song from `year` and picks `slot`. */
  const play = (s: GameState, year: number, slot: number) =>
    run(s, { type: 'SONG_READY', song: song(year), previewUrl: '/x' }, { type: 'SELECT_SLOT', index: slot });

  /**
   * A bettor takes the phone, names one part right and bets on `slotIndex`. The
   * part is one the current player did not get right: the title if they named
   * the artist, else the artist.
   */
  const bet = (s: GameState, playerIndex: number, slotIndex: number) => {
    const titleOpenOnly = !!s.guess?.artistCorrect;
    return run(
      s,
      { type: 'BETTOR_START', playerIndex },
      { type: 'BETTOR_JUDGED', artistCorrect: !titleOpenOnly, titleCorrect: titleOpenOnly },
      { type: 'PLACE_BET', slotIndex },
    );
  };

  const tokensOf = (s: GameState) => s.players.map((p) => p.tokens);
  const cardsOf = (s: GameState) => s.players.map((p) => p.timeline.length);

  /**
   * Bets are open on Ann's turn: she holds 1980, 2000 and 2020 and put a 2010
   * song in slot 0 (wrong; slot 2 is right). Slots 1, 2 and 3 are free.
   */
  const openBets = () => run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 0), { type: 'LOCK_IN' });

  describe('start', () => {
    it('START_GAME gives every player START_TOKENS, with the switch on or off', () => {
      expect(START_TOKENS).toBe(1);
      const on = gameReducer(initialGameState, {
        type: 'START_GAME',
        names: ['Ann', 'Ben'],
        targetScore: 5,
        tokensAndBets: true,
      });
      expect(on.tokensAndBets).toBe(true);
      expect(tokensOf(on)).toEqual([1, 1]);
      expect(on).toMatchObject({ guess: null, bets: [], triedThisTurn: [], activeBettor: null });

      const omitted = gameReducer(initialGameState, { type: 'START_GAME', names: ['Ann', 'Ben'], targetScore: 5 });
      expect(omitted.tokensAndBets).toBe(false);
      expect(tokensOf(omitted)).toEqual([1, 1]);

      const off = gameReducer(initialGameState, {
        type: 'START_GAME',
        names: ['Ann', 'Ben'],
        targetScore: 5,
        tokensAndBets: false,
      });
      expect(off.tokensAndBets).toBe(false);
    });

    it('DEAL_CARD gives no token', () => {
      const s = tokenGame();
      expect(s.phase).toBe('turn');
      expect(cardsOf(s)).toEqual([1, 1, 1]);
      expect(tokensOf(s)).toEqual([1, 1, 1]);
    });
  });

  describe('LOCK_IN', () => {
    it('needs the turn phase, a song and a spot', () => {
      const s = tokenGame();
      expect(gameReducer(s, { type: 'LOCK_IN' })).toBe(s);
      const withSong = gameReducer(s, { type: 'SONG_READY', song: song(1990), previewUrl: '/x' });
      expect(gameReducer(withSong, { type: 'LOCK_IN' })).toBe(withSong);
      const betting = openBets();
      expect(gameReducer(betting, { type: 'LOCK_IN' })).toBe(betting);
    });

    it('opens bets when another player could bet', () => {
      const s = run(play(tokenGame(), 1990, 1), { type: 'LOCK_IN' });
      expect(s.phase).toBe('betting');
      expect(s).toMatchObject({ guess: null, bets: [], triedThisTurn: [], activeBettor: null, lastResult: null });
      expect(s.selectedSlot).toBe(1);
      expect(tokensOf(s)).toEqual([1, 1, 1]);
      expect(cardsOf(s)).toEqual([1, 1, 1]);
    });

    it('keeps a partly right guess and opens bets', () => {
      const g = guess(true, false);
      const s = run(play(tokenGame(), 1990, 0), { type: 'LOCK_IN', guess: g });
      expect(s.phase).toBe('betting');
      expect(s.guess).toEqual(g);
    });

    it('reveals at once when both names are right: no bets', () => {
      const g = guess(true, true);
      const s = run(play(tokenGame(), 1990, 0), { type: 'LOCK_IN', guess: g });
      expect(s.phase).toBe('result');
      expect(s.lastResult).toMatchObject({ correct: true, guess: g, bets: [], cardWinnerIndex: 0 });
      expect(tokensOf(s)).toEqual([2, 1, 1]);
      expect(cardsOf(s)).toEqual([2, 1, 1]);
    });

    it('named both but placed wrong: the card is out and nobody could bet, but naming still earns a token', () => {
      const s = run(play(tokenGame(), 1990, 1), { type: 'LOCK_IN', guess: guess(true, true) });
      expect(s.phase).toBe('result');
      expect(s.lastResult).toMatchObject({ correct: false, bets: [], cardWinnerIndex: null });
      expect(tokensOf(s)).toEqual([2, 1, 1]);
      expect(cardsOf(s)).toEqual([1, 1, 1]);
    });

    it('reveals at once when no other player has a token', () => {
      const s = run(play(setPlayer(setPlayer(tokenGame(), 1, { tokens: 0 }), 2, { tokens: 0 }), 1990, 0), {
        type: 'LOCK_IN',
        guess: guess(false, true),
      });
      expect(s.phase).toBe('result');
      expect(s.lastResult).toMatchObject({ correct: true, guess: guess(false, true), bets: [] });
      expect(tokensOf(s)).toEqual([2, 0, 0]);
    });

    it('reveals at once in a 1-player game; a card alone earns no token', () => {
      const s = run(play(tokenGame(['Solo']), 2010, 1), { type: 'LOCK_IN' });
      expect(s.phase).toBe('result');
      expect(s.lastResult?.correct).toBe(true);
      expect(tokensOf(s)).toEqual([1]);
      const named = run(play(tokenGame(['Solo']), 2010, 1), { type: 'LOCK_IN', guess: guess(false, true) });
      expect(tokensOf(named)).toEqual([2]);
    });

    it('with the switch off, reveals at once and ignores the guess', () => {
      const s = run(play(startedGame(['Ann', 'Ben'], 10), 1990, 0), { type: 'LOCK_IN', guess: guess(true, false) });
      expect(s.phase).toBe('result');
      expect(s.guess).toBeNull();
      expect(Object.keys(s.lastResult ?? {}).sort()).toEqual(['correct', 'slotIndex', 'song']);
      expect(s.lastResult?.correct).toBe(true);
      expect(tokensOf(s)).toEqual([1, 1]);
    });
  });

  describe('the betting round', () => {
    it('locks the spot and the song: SELECT_SLOT, SKIP_SONG and SONG_READY are ignored', () => {
      const s = setPlayer(openBets(), 0, { tokens: 5 });
      expect(gameReducer(s, { type: 'SELECT_SLOT', index: 2 })).toBe(s);
      expect(gameReducer(s, { type: 'SKIP_SONG' })).toBe(s);
      expect(gameReducer(s, { type: 'SONG_READY', song: song(1990), previewUrl: '/y' })).toBe(s);
    });

    it('BETTOR_START: any eligible player may go first; the try is used only once the names are checked', () => {
      let s = gameReducer(openBets(), { type: 'BETTOR_START', playerIndex: 2 });
      expect(s.activeBettor).toEqual({ playerIndex: 2, allowed: null });
      expect(s.triedThisTurn).toEqual([]);
      s = run(s, { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: true }, { type: 'PLACE_BET', slotIndex: 3 });
      s = gameReducer(s, { type: 'BETTOR_START', playerIndex: 1 });
      expect(s.activeBettor).toEqual({ playerIndex: 1, allowed: null });
    });

    it('BETTOR_START is refused for the current player, an unknown player, and outside betting', () => {
      const s = openBets();
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 0 })).toBe(s);
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 3 })).toBe(s);
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: -1 })).toBe(s);
      const turn = play(tokenGame(), 1990, 0);
      expect(gameReducer(turn, { type: 'BETTOR_START', playerIndex: 1 })).toBe(turn);
      const result = gameReducer(s, { type: 'REVEAL' });
      expect(gameReducer(result, { type: 'BETTOR_START', playerIndex: 1 })).toBe(result);
    });

    it('BETTOR_START is refused for a player with 0 tokens', () => {
      const s = setPlayer(openBets(), 1, { tokens: 0 });
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 1 })).toBe(s);
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 2 }).activeBettor?.playerIndex).toBe(2);
    });

    it('BETTOR_START is refused while another bettor holds the phone', () => {
      const s = gameReducer(openBets(), { type: 'BETTOR_START', playerIndex: 1 });
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 2 })).toBe(s);
      const judged = gameReducer(s, { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: true });
      expect(gameReducer(judged, { type: 'BETTOR_START', playerIndex: 2 })).toBe(judged);
    });

    it('BETTOR_START is refused a second time: after a bet, after "Not this time", after Cancel', () => {
      const afterBet = bet(openBets(), 1, 1);
      expect(gameReducer(afterBet, { type: 'BETTOR_START', playerIndex: 1 })).toBe(afterBet);

      const denied = run(
        openBets(),
        { type: 'BETTOR_START', playerIndex: 1 },
        { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: false },
        { type: 'BETTOR_DONE' },
      );
      expect(denied.activeBettor).toBeNull();
      expect(tokensOf(denied)).toEqual([1, 1, 1]);
      expect(gameReducer(denied, { type: 'BETTOR_START', playerIndex: 1 })).toBe(denied);

      const cancelled = run(
        openBets(),
        { type: 'BETTOR_START', playerIndex: 1 },
        { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: false },
        { type: 'BETTOR_DONE' },
      );
      expect(cancelled.bets).toEqual([]);
      expect(tokensOf(cancelled)).toEqual([1, 1, 1]);
      expect(gameReducer(cancelled, { type: 'BETTOR_START', playerIndex: 1 })).toBe(cancelled);
    });

    it('BETTOR_JUDGED: only a part the current player did not get right earns the bet', () => {
      const locked = (g: NameGuess) =>
        gameReducer(
          run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 0), { type: 'LOCK_IN', guess: g }),
          { type: 'BETTOR_START', playerIndex: 1 },
        );
      // Ann named the artist: Ben's right artist does not count, his right title does.
      const artistNamed = locked(guess(true, false));
      expect(artistNamed.phase).toBe('betting');
      const judge = (s: GameState, artistCorrect: boolean, titleCorrect: boolean) =>
        gameReducer(s, { type: 'BETTOR_JUDGED', artistCorrect, titleCorrect }).activeBettor?.allowed;
      expect(judge(artistNamed, true, false)).toBe(false);
      expect(judge(artistNamed, false, true)).toBe(true);
      // Ann named the title: only Ben's artist counts.
      const titleNamed = locked(guess(false, true));
      expect(judge(titleNamed, false, true)).toBe(false);
      expect(judge(titleNamed, true, false)).toBe(true);
    });

    it('BETTOR_JUDGED: one right part allows the bet, none does not; the try is used either way', () => {
      const start = gameReducer(openBets(), { type: 'BETTOR_START', playerIndex: 1 });
      const cases: [boolean, boolean, boolean][] = [
        [true, false, true],
        [false, true, true],
        [true, true, true],
        [false, false, false],
      ];
      for (const [artistCorrect, titleCorrect, allowed] of cases) {
        const s = gameReducer(start, { type: 'BETTOR_JUDGED', artistCorrect, titleCorrect });
        expect(s.activeBettor).toEqual({ playerIndex: 1, allowed });
        expect(s.triedThisTurn).toEqual([1]);
        expect(tokensOf(s)).toEqual([1, 1, 1]);
      }
    });

    it('BETTOR_JUDGED is ignored with no active bettor, or once the names were checked', () => {
      const s = openBets();
      expect(gameReducer(s, { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: true })).toBe(s);
      const denied = run(
        s,
        { type: 'BETTOR_START', playerIndex: 1 },
        { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: false },
      );
      expect(gameReducer(denied, { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: true })).toBe(denied);
    });

    it('BETTOR_DONE before the names are checked does not use the try', () => {
      let s = run(openBets(), { type: 'BETTOR_START', playerIndex: 1 }, { type: 'BETTOR_DONE' });
      expect(s.activeBettor).toBeNull();
      expect(s.triedThisTurn).toEqual([]);
      s = gameReducer(s, { type: 'BETTOR_START', playerIndex: 1 });
      expect(s.activeBettor).toEqual({ playerIndex: 1, allowed: null });
    });

    it('BETTOR_DONE is ignored with no active bettor', () => {
      const s = openBets();
      expect(gameReducer(s, { type: 'BETTOR_DONE' })).toBe(s);
    });

    it('PLACE_BET adds the bet in the order of play and gives the phone back; no token moves yet', () => {
      let s = bet(openBets(), 2, 3);
      expect(s.bets).toEqual([{ playerIndex: 2, slotIndex: 3 }]);
      expect(s.activeBettor).toBeNull();
      expect(s.triedThisTurn).toEqual([2]);
      s = bet(s, 1, 1);
      expect(s.bets).toEqual([
        { playerIndex: 2, slotIndex: 3 },
        { playerIndex: 1, slotIndex: 1 },
      ]);
      expect(s.triedThisTurn).toEqual([2, 1]);
      expect(s.phase).toBe('betting');
      expect(tokensOf(s)).toEqual([1, 1, 1]);
    });

    it('PLACE_BET is refused for a bettor who is not allowed, or not checked yet', () => {
      const nobody = openBets();
      expect(gameReducer(nobody, { type: 'PLACE_BET', slotIndex: 2 })).toBe(nobody);
      const notChecked = gameReducer(nobody, { type: 'BETTOR_START', playerIndex: 1 });
      expect(gameReducer(notChecked, { type: 'PLACE_BET', slotIndex: 2 })).toBe(notChecked);
      const denied = gameReducer(notChecked, { type: 'BETTOR_JUDGED', artistCorrect: false, titleCorrect: false });
      expect(gameReducer(denied, { type: 'PLACE_BET', slotIndex: 2 })).toBe(denied);
    });

    it("PLACE_BET is refused on the current player's spot, a taken spot, or a slot that does not exist", () => {
      // Ann picked 0; Ben bet on 2; Cat is allowed. Free: 1 and 3.
      const allowed = run(
        bet(openBets(), 1, 2),
        { type: 'BETTOR_START', playerIndex: 2 },
        { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: false },
      );
      for (const slotIndex of [0, 2, -1, 4, 1.5, Number.NaN]) {
        expect(gameReducer(allowed, { type: 'PLACE_BET', slotIndex })).toBe(allowed);
      }
      expect(gameReducer(allowed, { type: 'PLACE_BET', slotIndex: 3 }).bets).toHaveLength(2);
      expect(gameReducer(allowed, { type: 'PLACE_BET', slotIndex: 1 }).bets).toHaveLength(2);
    });

    it('PLACE_BET is refused for a bettor with no token', () => {
      const allowed = run(
        openBets(),
        { type: 'BETTOR_START', playerIndex: 1 },
        { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: false },
      );
      const broke = setPlayer(allowed, 1, { tokens: 0 });
      expect(gameReducer(broke, { type: 'PLACE_BET', slotIndex: 2 })).toBe(broke);
    });

    it('nobody may start once every spot is taken', () => {
      // Ann holds one card and picked slot 1; Ben bets on the only free slot.
      const s = bet(run(play(tokenGame(), 1990, 1), { type: 'LOCK_IN' }), 1, 0);
      expect(gameReducer(s, { type: 'BETTOR_START', playerIndex: 2 })).toBe(s);
      expect(gameReducer(s, { type: 'REVEAL' }).phase).toBe('result');
    });
  });

  describe('REVEAL', () => {
    it('in a turn, waits for Lock in while someone could bet', () => {
      const s = play(tokenGame(), 1990, 0);
      expect(gameReducer(s, { type: 'REVEAL' })).toBe(s);
    });

    it('in a turn, reveals at once when nobody could bet', () => {
      const s = play(setPlayer(setPlayer(tokenGame(), 1, { tokens: 0 }), 2, { tokens: 0 }), 1990, 0);
      const r = gameReducer(s, { type: 'REVEAL' });
      expect(r.phase).toBe('result');
      expect(r.lastResult).toMatchObject({ correct: true, guess: null, bets: [], cardWinnerIndex: 0 });
      expect(tokensOf(r)).toEqual([1, 0, 0]);
    });

    it('in the betting round, waits while a bettor holds the phone', () => {
      const s = gameReducer(openBets(), { type: 'BETTOR_START', playerIndex: 1 });
      expect(gameReducer(s, { type: 'REVEAL' })).toBe(s);
      const allowed = gameReducer(s, { type: 'BETTOR_JUDGED', artistCorrect: true, titleCorrect: false });
      expect(gameReducer(allowed, { type: 'REVEAL' })).toBe(allowed);
      expect(run(allowed, { type: 'BETTOR_DONE' }, { type: 'REVEAL' }).phase).toBe('result');
    });

    it('ends a round with no bets: a wrong card is out and no token moves', () => {
      const s = gameReducer(openBets(), { type: 'REVEAL' });
      expect(s.phase).toBe('result');
      expect(s.lastResult).toMatchObject({ correct: false, bets: [], cardWinnerIndex: null });
      expect(tokensOf(s)).toEqual([1, 1, 1]);
      expect(cardsOf(s)).toEqual([3, 1, 1]);
    });

    it('is ignored once the result is shown', () => {
      const s = gameReducer(bet(openBets(), 1, 2), { type: 'REVEAL' });
      expect(gameReducer(s, { type: 'REVEAL' })).toBe(s);
    });
  });

  describe('settling a turn', () => {
    it('current player right: the card and +1 token; a wrong bettor loses a token', () => {
      // Ann holds 1980, 2000, 2020 and puts a 2010 song in slot 2 (right).
      let s = run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 2), {
        type: 'LOCK_IN',
        guess: guess(false, true),
      });
      const before = s.players;
      s = bet(s, 1, 1);
      s = gameReducer(s, { type: 'REVEAL' });
      expect(s.phase).toBe('result');
      expect(s.activeBettor).toBeNull();
      expect(s.lastResult).toMatchObject({
        correct: true,
        slotIndex: 2,
        guess: guess(false, true),
        cardWinnerIndex: 0,
        bets: [{ playerIndex: 1, slotIndex: 1, outcome: 'lost' }],
      });
      expect(s.lastResult?.playersBefore).toEqual(before);
      expect(tokensOf(s)).toEqual([2, 0, 1]);
      expect(cardsOf(s)).toEqual([4, 1, 1]);
    });

    it("current player wrong, a bettor right: the card goes into the bettor's own timeline, the stake comes back", () => {
      let s = bet(openBets(), 1, 2); // Ben: right
      s = bet(s, 2, 3); // Cat: wrong
      s = gameReducer(s, { type: 'REVEAL' });
      expect(s.lastResult).toMatchObject({
        correct: false,
        cardWinnerIndex: 1,
        bets: [
          { playerIndex: 1, slotIndex: 2, outcome: 'won' },
          { playerIndex: 2, slotIndex: 3, outcome: 'lost' },
        ],
      });
      expect(s.players[1]?.timeline.map((c) => c.year)).toEqual([2000, 2010]);
      expect(tokensOf(s)).toEqual([1, 1, 0]);
      expect(cardsOf(s)).toEqual([3, 2, 1]);
      expect(s.usedIds).toContain(s.lastResult?.song.id);
    });

    it('two right bettors: the earlier bet wins the card, the later one keeps their token', () => {
      // Ann holds 1990, 2000, 2010 and puts a 2000 song in slot 0 (wrong): slots 1 and 2 are both right.
      let s = run(play(board(tokenGame(), 0, [1990, 2000, 2010]), 2000, 0), { type: 'LOCK_IN' });
      s = bet(s, 2, 2);
      s = bet(s, 1, 1);
      s = gameReducer(s, { type: 'REVEAL' });
      expect(s.lastResult?.cardWinnerIndex).toBe(2);
      expect(s.lastResult?.bets?.map((b) => [b.playerIndex, b.outcome])).toEqual([
        [2, 'won'],
        [1, 'right'],
      ]);
      expect(tokensOf(s)).toEqual([1, 1, 1]);
      expect(cardsOf(s)).toEqual([3, 1, 2]);
    });

    it('nobody right: the card is out and every bettor loses a token', () => {
      const s = gameReducer(bet(bet(openBets(), 1, 1), 2, 3), { type: 'REVEAL' });
      expect(s.lastResult).toMatchObject({ correct: false, cardWinnerIndex: null });
      expect(s.lastResult?.bets?.map((b) => b.outcome)).toEqual(['lost', 'lost']);
      expect(tokensOf(s)).toEqual([1, 0, 0]);
      expect(cardsOf(s)).toEqual([3, 1, 1]);
    });

    it('a bettor who reaches the target with a won bet ends the game on NEXT', () => {
      // Target 3: Ben already holds 2 cards. Ann (one 2000 card) puts a 2010 song before it; Ben bets after it.
      let s = board(tokenGame(['Ann', 'Ben', 'Cat'], 3), 1, [1990, 2005]);
      s = run(play(s, 2010, 0), { type: 'LOCK_IN', guess: guess(true, false) });
      s = bet(s, 1, 1);
      s = gameReducer(s, { type: 'REVEAL' });
      expect(s.currentPlayerIndex).toBe(0);
      expect(cardsOf(s)).toEqual([1, 3, 1]);
      s = gameReducer(s, { type: 'NEXT' });
      expect(s.phase).toBe('winner');
      expect(s.endedEarly).toBe(false);
      expect(s).toMatchObject({ guess: null, bets: [], triedThisTurn: [], activeBettor: null, currentSong: null });
      expect(findWinners(s.players, s.targetScore).map((p) => p.name)).toEqual(['Ben']);
    });

    it('tokens never go above 5 over many turns', () => {
      // Each turn the current player names the artist (+1 token) and puts the newest song first (wrong);
      // the other player names the title and bets last (right), winning the card but no token.
      let s = tokenGame(['Ann', 'Ben'], 30);
      for (let turn = 1; turn <= 12; turn++) {
        const current = s.currentPlayerIndex;
        const other = 1 - current;
        const last = s.players[current]?.timeline.length ?? 0;
        s = run(play(s, 2100 + turn, 0), { type: 'LOCK_IN', guess: guess(true, false) });
        s = gameReducer(bet(s, other, last), { type: 'REVEAL' });
        expect(s.lastResult?.cardWinnerIndex).toBe(other);
        for (const p of s.players) expect(p.tokens).toBeLessThanOrEqual(MAX_TOKENS);
        s = gameReducer(s, { type: 'NEXT' });
      }
      expect(cardsOf(s)).toEqual([7, 7]);
      expect(tokensOf(s)).toEqual([MAX_TOKENS, MAX_TOKENS]);

      let solo = tokenGame(['Solo'], 30);
      for (let turn = 1; turn <= 8; turn++) {
        solo = run(
          play(solo, 2000 + turn, solo.players[0]?.timeline.length ?? 0),
          { type: 'LOCK_IN', guess: guess(false, true) },
          { type: 'NEXT' },
        );
        expect(solo.players[0]?.tokens).toBe(Math.min(MAX_TOKENS, 1 + turn));
      }
      expect(cardsOf(solo)).toEqual([9]);
    });

    it('with the switch off the game plays as before: no token moves, results carry no extras', () => {
      let s = startedGame(['Ann', 'Ben'], 10);
      s = run(play(s, 1990, 0), { type: 'REVEAL' });
      expect(s.lastResult?.correct).toBe(true);
      expect(Object.keys(s.lastResult ?? {}).sort()).toEqual(['correct', 'slotIndex', 'song']);
      s = run(s, { type: 'NEXT' });
      s = run(play(s, 1990, 1), { type: 'REVEAL' });
      expect(s.lastResult?.correct).toBe(false);
      expect(gameReducer(s, { type: 'ACCEPT_GUESS' })).toBe(s);
      expect(tokensOf(s)).toEqual([1, 1]);
      expect(cardsOf(s)).toEqual([2, 1]);
    });
  });

  describe('a song failing, ending the game', () => {
    it('SONG_FAILED in the betting round goes back to the turn; no token moves', () => {
      let s = gameReducer(bet(openBets(), 1, 2), { type: 'BETTOR_START', playerIndex: 2 });
      const songId = s.currentSong?.id;
      s = gameReducer(s, { type: 'SONG_FAILED' });
      expect(s.phase).toBe('turn');
      expect(s).toMatchObject({
        currentPlayerIndex: 0,
        currentSong: null,
        currentPreviewUrl: null,
        selectedSlot: null,
        lastResult: null,
        guess: null,
        bets: [],
        triedThisTurn: [],
        activeBettor: null,
      });
      expect(s.usedIds).toContain(songId);
      expect(tokensOf(s)).toEqual([1, 1, 1]);
      expect(cardsOf(s)).toEqual([3, 1, 1]);
      // With the new song, Ben may try again.
      s = run(play(s, 1990, 0), { type: 'LOCK_IN' }, { type: 'BETTOR_START', playerIndex: 1 });
      expect(s.activeBettor).toEqual({ playerIndex: 1, allowed: null });
    });

    it('END_GAME in the betting round drops the bets; a tie on cards goes to more tokens', () => {
      // Ann: 2 cards and 3 tokens; Ben: 2 cards and 1 token; Cat: 1 card.
      let s = board(board(setPlayer(tokenGame(), 0, { tokens: 3 }), 0, [1990, 2010]), 1, [1980, 1985]);
      s = run(play(s, 2000, 0), { type: 'LOCK_IN' }); // Ann is wrong; slot 1 is right
      s = bet(s, 1, 1);
      s = gameReducer(s, { type: 'BETTOR_START', playerIndex: 2 });
      s = gameReducer(s, { type: 'END_GAME' });
      expect(s.phase).toBe('winner');
      expect(s.endedEarly).toBe(true);
      expect(s).toMatchObject({
        currentSong: null,
        selectedSlot: null,
        guess: null,
        bets: [],
        triedThisTurn: [],
        activeBettor: null,
      });
      expect(cardsOf(s)).toEqual([2, 2, 1]);
      expect(tokensOf(s)).toEqual([3, 1, 1]);
      expect(findWinners(s.players, s.targetScore).map((p) => p.name)).toEqual(['Ann']);
      expect(wonOnTokens(s.players, s.targetScore)).toBe(true);
    });
  });

  describe('SKIP_SONG', () => {
    /** The current player holds `tokens` and hears song 555. */
    const ready = (tokens: number, s = tokenGame()) =>
      gameReducer(setPlayer(s, 0, { tokens }), {
        type: 'SONG_READY',
        song: song(1990, { id: 555, artist: 'Skipped' }),
        previewUrl: '/x',
      });

    it('costs 3 tokens, keeps the song used, and clears the song and the spot', () => {
      let s = gameReducer(ready(4), { type: 'SELECT_SLOT', index: 1 });
      s = gameReducer(s, { type: 'SKIP_SONG' });
      expect(s.phase).toBe('turn');
      expect(s).toMatchObject({ currentPlayerIndex: 0, currentSong: null, currentPreviewUrl: null, selectedSlot: null });
      expect(tokensOf(s)).toEqual([1, 1, 1]);
      expect(cardsOf(s)).toEqual([1, 1, 1]);
      expect(s.usedIds).toContain(555);
      expect(s.usedArtists.filter((a) => a === 'Skipped')).toHaveLength(1);
    });

    it('the turn goes on with a new song', () => {
      let s = gameReducer(ready(3), { type: 'SKIP_SONG' });
      expect(tokensOf(s)).toEqual([0, 1, 1]);
      s = run(play(s, 2010, 1), { type: 'LOCK_IN' }, { type: 'REVEAL' });
      expect(s.lastResult?.correct).toBe(true);
      expect(tokensOf(s)).toEqual([0, 1, 1]);
      expect(cardsOf(s)).toEqual([2, 1, 1]);
    });

    it('leaves 2 tokens out of 5', () => {
      expect(tokensOf(gameReducer(ready(5), { type: 'SKIP_SONG' }))).toEqual([2, 1, 1]);
    });

    it('is refused with 2 tokens, with the switch off, without a song, or after Lock in', () => {
      const two = ready(2);
      expect(gameReducer(two, { type: 'SKIP_SONG' })).toBe(two);
      const off = ready(5, startedGame(['Ann', 'Ben'], 10));
      expect(gameReducer(off, { type: 'SKIP_SONG' })).toBe(off);
      const noSong = setPlayer(tokenGame(), 0, { tokens: 5 });
      expect(gameReducer(noSong, { type: 'SKIP_SONG' })).toBe(noSong);
      const locked = run(ready(5), { type: 'SELECT_SLOT', index: 0 }, { type: 'LOCK_IN' });
      expect(locked.phase).toBe('betting');
      expect(gameReducer(locked, { type: 'SKIP_SONG' })).toBe(locked);
    });
  });

  describe('ACCEPT_GUESS ("We accept it")', () => {
    /** Ann's names were rejected and her 2010 song is in the wrong slot; Ben bet right (slot 2), Cat wrong (slot 3). */
    const stolen = () => {
      const locked = run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 0), {
        type: 'LOCK_IN',
        guess: guess(true, false),
      });
      return gameReducer(bet(bet(locked, 1, 2), 2, 3), { type: 'REVEAL' });
    };

    it('cancels every bet and takes a stolen card back', () => {
      const before = stolen();
      expect(before.lastResult?.cardWinnerIndex).toBe(1);
      // Ann named the artist (+1); Ben named the title and won the card (stake back); Cat lost.
      expect(tokensOf(before)).toEqual([2, 1, 0]);
      const s = gameReducer(before, { type: 'ACCEPT_GUESS' });
      expect(s.phase).toBe('result');
      expect(s.lastResult).toMatchObject({
        accepted: true,
        correct: false,
        cardWinnerIndex: null,
        bets: [
          { playerIndex: 1, slotIndex: 2, outcome: 'refunded' },
          { playerIndex: 2, slotIndex: 3, outcome: 'refunded' },
        ],
      });
      // The accepted names earn Ann her naming token; every bet is refunded.
      expect(tokensOf(s)).toEqual([2, 1, 1]);
      expect(cardsOf(s)).toEqual([3, 1, 1]);
      expect(s.players.map((p) => p.timeline)).toEqual(before.lastResult?.playersBefore?.map((p) => p.timeline));
    });

    it('gives the bet tokens back when the current player was right', () => {
      let s = run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 2), {
        type: 'LOCK_IN',
        guess: guess(false, false),
      });
      s = gameReducer(bet(s, 1, 0), { type: 'REVEAL' });
      expect(tokensOf(s)).toEqual([1, 0, 1]);
      s = gameReducer(s, { type: 'ACCEPT_GUESS' });
      expect(s.lastResult).toMatchObject({ accepted: true, correct: true, cardWinnerIndex: 0 });
      expect(tokensOf(s)).toEqual([2, 1, 1]);
      expect(cardsOf(s)).toEqual([4, 1, 1]);
    });

    it('takes back a card that reached the target, so the game goes on', () => {
      let s = board(tokenGame(['Ann', 'Ben', 'Cat'], 3), 1, [1990, 2005]);
      s = run(play(s, 2010, 0), { type: 'LOCK_IN', guess: guess(false, true) });
      s = gameReducer(bet(s, 1, 1), { type: 'REVEAL' });
      expect(cardsOf(s)).toEqual([1, 3, 1]);
      s = run(s, { type: 'ACCEPT_GUESS' }, { type: 'NEXT' });
      expect(s.phase).toBe('turn');
      expect(s.currentPlayerIndex).toBe(1);
      expect(cardsOf(s)).toEqual([1, 2, 1]);
    });

    it('is ignored with no bets, when tapped twice, or outside the result', () => {
      const noBets = run(play(tokenGame(), 1990, 1), { type: 'LOCK_IN', guess: guess(true, false) }, { type: 'REVEAL' });
      expect(noBets.phase).toBe('result');
      expect(gameReducer(noBets, { type: 'ACCEPT_GUESS' })).toBe(noBets);

      const once = gameReducer(stolen(), { type: 'ACCEPT_GUESS' });
      expect(gameReducer(once, { type: 'ACCEPT_GUESS' })).toBe(once);

      const betting = bet(openBets(), 1, 2);
      expect(gameReducer(betting, { type: 'ACCEPT_GUESS' })).toBe(betting);
    });

    it('is ignored when the names were right', () => {
      const named = run(play(tokenGame(), 1990, 1), { type: 'LOCK_IN', guess: guess(true, true) });
      expect(gameReducer(named, { type: 'ACCEPT_GUESS' })).toBe(named);
      // Even with bets on record (a save edited by hand), right names leave nothing to accept.
      const s = stolen();
      const edited: GameState = s.lastResult ? { ...s, lastResult: { ...s.lastResult, guess: guess(true, true) } } : s;
      expect(gameReducer(edited, { type: 'ACCEPT_GUESS' })).toBe(edited);
    });

    it('is ignored when the current player typed no names', () => {
      const s = gameReducer(bet(openBets(), 1, 2), { type: 'REVEAL' });
      expect(s.lastResult?.guess).toBeNull();
      expect(s.lastResult?.cardWinnerIndex).toBe(1);
      expect(gameReducer(s, { type: 'ACCEPT_GUESS' })).toBe(s);
    });
  });

  describe('per-turn fields', () => {
    it('NEXT clears the guess, the bets and the tries', () => {
      let s = run(play(board(tokenGame(), 0, [1980, 2000, 2020]), 2010, 0), {
        type: 'LOCK_IN',
        guess: guess(true, false),
      });
      s = gameReducer(bet(s, 1, 2), { type: 'REVEAL' });
      expect(s.guess).not.toBeNull();
      expect(s.bets).toHaveLength(1);
      expect(s.triedThisTurn).toEqual([1]);
      s = gameReducer(s, { type: 'NEXT' });
      expect(s).toMatchObject({
        phase: 'turn',
        currentPlayerIndex: 1,
        lastResult: null,
        guess: null,
        bets: [],
        triedThisTurn: [],
        activeBettor: null,
      });
    });

    it('SONG_READY starts the turn with no guess, bets or tries', () => {
      const stale: GameState = {
        ...tokenGame(),
        guess: guess(true, false),
        bets: [{ playerIndex: 1, slotIndex: 0 }],
        triedThisTurn: [1],
        activeBettor: { playerIndex: 2, allowed: true },
      };
      const s = gameReducer(stale, { type: 'SONG_READY', song: song(1990), previewUrl: '/x' });
      expect(s).toMatchObject({ guess: null, bets: [], triedThisTurn: [], activeBettor: null, selectedSlot: null });
    });
  });
});
