import { describe, expect, it } from 'vitest';
import { player, song } from '../test/fixtures';
import { initialGameState } from './reducer';
import {
  anyoneCouldBet,
  awardToken,
  betBlock,
  canSkip,
  earnsBet,
  eligibleBettors,
  freeBetSlots,
  namesCorrect,
  settleTurn,
  spendTokens,
} from './tokens';
import { MAX_TOKENS, SKIP_COST, type Bet, type GameState, type NameGuess, type Player } from './types';

const guess = (artistCorrect: boolean, titleCorrect: boolean): NameGuess => ({
  artist: 'typed artist',
  title: 'typed title',
  artistCorrect,
  titleCorrect,
});

/**
 * Bets are open: Ann (current, cards 1990 and 2010) picked slot 1, so slots 0
 * and 2 are free. Ben and Cat hold 1 token each.
 */
function betting(overrides: Partial<GameState> = {}): GameState {
  return {
    ...initialGameState,
    phase: 'betting',
    tokensAndBets: true,
    players: [player('Ann', [1990, 2010]), player('Ben', [2000]), player('Cat', [2000])],
    currentPlayerIndex: 0,
    dealtCount: 3,
    currentSong: song(2000),
    currentPreviewUrl: '/x',
    selectedSlot: 1,
    ...overrides,
  };
}

const withTokens = (s: GameState, ...tokens: number[]): GameState => ({
  ...s,
  players: s.players.map((p, i) => ({ ...p, tokens: tokens[i] ?? p.tokens })),
});

describe('awardToken / spendTokens', () => {
  it('awards one token, up to MAX_TOKENS; a token earned at the cap is lost', () => {
    expect(MAX_TOKENS).toBe(5);
    expect(awardToken(0)).toBe(1);
    expect(awardToken(1)).toBe(2);
    expect(awardToken(4)).toBe(5);
    expect(awardToken(5)).toBe(5);
  });

  it('spends one token by default and never goes below 0', () => {
    expect(spendTokens(1)).toBe(0);
    expect(spendTokens(4)).toBe(3);
    expect(spendTokens(0)).toBe(0);
  });

  it('spends several tokens at once (the skip price), floored at 0', () => {
    expect(SKIP_COST).toBe(3);
    expect(spendTokens(5, SKIP_COST)).toBe(2);
    expect(spendTokens(3, SKIP_COST)).toBe(0);
    expect(spendTokens(2, SKIP_COST)).toBe(0);
  });
});

describe('namesCorrect / earnsBet', () => {
  it('namesCorrect needs both the artist and the title', () => {
    expect(namesCorrect(guess(true, true))).toBe(true);
    expect(namesCorrect(guess(true, false))).toBe(false);
    expect(namesCorrect(guess(false, true))).toBe(false);
    expect(namesCorrect(guess(false, false))).toBe(false);
    expect(namesCorrect(null)).toBe(false);
  });

  it('earnsBet needs the artist or the title', () => {
    expect(earnsBet(true, true)).toBe(true);
    expect(earnsBet(true, false)).toBe(true);
    expect(earnsBet(false, true)).toBe(true);
    expect(earnsBet(false, false)).toBe(false);
  });
});

describe('freeBetSlots', () => {
  it('lists every slot except the current pick', () => {
    expect(freeBetSlots(2, 1, [])).toEqual([0, 2]);
    expect(freeBetSlots(1, 0, [])).toEqual([1]);
    expect(freeBetSlots(3, 3, [])).toEqual([0, 1, 2]);
  });

  it('leaves out the slots of earlier bets', () => {
    expect(freeBetSlots(3, 0, [{ playerIndex: 1, slotIndex: 3 }])).toEqual([1, 2]);
    expect(
      freeBetSlots(2, 1, [
        { playerIndex: 1, slotIndex: 0 },
        { playerIndex: 2, slotIndex: 2 },
      ]),
    ).toEqual([]);
  });

  it('is empty when the only slot is the pick', () => {
    expect(freeBetSlots(0, 0, [])).toEqual([]);
  });
});

describe('betBlock', () => {
  it('is null for a player who may try', () => {
    expect(betBlock(betting(), 1)).toBeNull();
    expect(betBlock(betting(), 2)).toBeNull();
  });

  it("blocks the current player, and an index that isn't a player", () => {
    expect(betBlock(betting(), 0)).toBe('current');
    expect(betBlock(betting({ currentPlayerIndex: 1 }), 1)).toBe('current');
    expect(betBlock(betting(), 7)).not.toBeNull();
  });

  it('blocks a player with no token', () => {
    expect(betBlock(withTokens(betting(), 1, 0, 1), 1)).toBe('noTokens');
  });

  it('blocks a player who already tried this turn', () => {
    expect(betBlock(betting({ triedThisTurn: [2] }), 2)).toBe('tried');
    expect(betBlock(betting({ triedThisTurn: [2] }), 1)).toBeNull();
  });

  it('blocks everyone once no free slot is left', () => {
    const full = betting({ bets: [{ playerIndex: 1, slotIndex: 0 }, { playerIndex: 2, slotIndex: 2 }], triedThisTurn: [1, 2] });
    const dan = { ...full, players: [...full.players, player('Dan', [2000])] };
    expect(betBlock(dan, 3)).toBe('noFreeSlots');
  });
});

describe('eligibleBettors', () => {
  it('lists the players who may still try, in seat order', () => {
    expect(eligibleBettors(betting())).toEqual([1, 2]);
    expect(eligibleBettors(betting({ currentPlayerIndex: 1 }))).toEqual([0, 2]);
  });

  it('is empty with the switch off', () => {
    expect(eligibleBettors(betting({ tokensAndBets: false }))).toEqual([]);
  });

  it('is empty when the current player named both; one right name is not enough', () => {
    expect(eligibleBettors(betting({ guess: guess(true, true) }))).toEqual([]);
    expect(eligibleBettors(betting({ guess: guess(true, false) }))).toEqual([1, 2]);
    expect(eligibleBettors(betting({ guess: guess(false, false) }))).toEqual([1, 2]);
  });

  it('is empty in a 1-player game', () => {
    expect(eligibleBettors(betting({ players: [player('Ann', [2000], 5)] }))).toEqual([]);
  });

  it('leaves out players with 0 tokens', () => {
    expect(eligibleBettors(withTokens(betting(), 1, 0, 1))).toEqual([2]);
    expect(eligibleBettors(withTokens(betting(), 5, 0, 0))).toEqual([]);
  });

  it('leaves out players who already tried', () => {
    expect(eligibleBettors(betting({ triedThisTurn: [1] }))).toEqual([2]);
    expect(eligibleBettors(betting({ triedThisTurn: [1, 2] }))).toEqual([]);
  });

  it('is empty once no free slot is left', () => {
    // Ann has one card: slots 0 and 1. She picked 1 and Ben bet on 0.
    const s = betting({
      players: [player('Ann', [2000]), player('Ben', [2000]), player('Cat', [2000])],
      bets: [{ playerIndex: 1, slotIndex: 0 }],
      triedThisTurn: [1],
    });
    expect(betBlock(s, 2)).toBe('noFreeSlots');
    expect(eligibleBettors(s)).toEqual([]);
  });
});

describe('anyoneCouldBet', () => {
  const turn = (overrides: Partial<GameState> = {}) => betting({ phase: 'turn', ...overrides });

  it('is true when another player holds a token', () => {
    expect(anyoneCouldBet(turn())).toBe(true);
    expect(anyoneCouldBet(withTokens(turn(), 0, 0, 1))).toBe(true);
  });

  it('is true before a spot is picked', () => {
    expect(anyoneCouldBet(turn({ selectedSlot: null }))).toBe(true);
  });

  it("ignores this turn's guess, bets and tries", () => {
    const s = turn({
      guess: guess(true, true),
      bets: [{ playerIndex: 1, slotIndex: 0 }, { playerIndex: 2, slotIndex: 2 }],
      triedThisTurn: [1, 2],
    });
    expect(anyoneCouldBet(s)).toBe(true);
  });

  it('is false when the other players have no token', () => {
    expect(anyoneCouldBet(withTokens(turn(), 5, 0, 0))).toBe(false);
    expect(anyoneCouldBet(withTokens(turn({ selectedSlot: null }), 5, 0, 0))).toBe(false);
  });

  it('is false in a 1-player game and with the switch off', () => {
    expect(anyoneCouldBet(turn({ players: [player('Ann', [2000], 5)] }))).toBe(false);
    expect(anyoneCouldBet(turn({ tokensAndBets: false }))).toBe(false);
  });
});

describe('canSkip', () => {
  const turn = (tokens: number, overrides: Partial<GameState> = {}) =>
    withTokens(betting({ phase: 'turn', selectedSlot: null, ...overrides }), tokens);

  it('needs SKIP_COST tokens', () => {
    expect(canSkip(turn(3))).toBe(true);
    expect(canSkip(turn(5))).toBe(true);
    expect(canSkip(turn(2))).toBe(false);
    expect(canSkip(turn(0))).toBe(false);
  });

  it('works with or without a picked spot', () => {
    expect(canSkip(turn(3, { selectedSlot: 1 }))).toBe(true);
  });

  it('needs the switch on, a song, and the turn phase (before Lock in)', () => {
    expect(canSkip(turn(5, { tokensAndBets: false }))).toBe(false);
    expect(canSkip(turn(5, { currentSong: null }))).toBe(false);
    expect(canSkip(turn(5, { phase: 'betting', selectedSlot: 1 }))).toBe(false);
    expect(canSkip(turn(5, { phase: 'result' }))).toBe(false);
  });

  it("checks the current player's tokens", () => {
    const s = withTokens(betting({ phase: 'turn', currentPlayerIndex: 1 }), 5, 2, 5);
    expect(canSkip(s)).toBe(false);
    expect(canSkip(withTokens(s, 0, 3, 0))).toBe(true);
  });
});

describe('settleTurn', () => {
  /** Ann (current) holds 1990 and 2010; the song is from 2000, so only slot 1 is right. */
  const SONG_YEAR = 2000;
  const setup = (players: Player[], pickedSlot: number, bets: Bet[], extra: { accepted?: boolean; tokensAndBets?: boolean } = {}) => {
    const card = song(SONG_YEAR, { id: 4242 });
    const result = settleTurn({
      players,
      current: 0,
      song: card,
      pickedSlot,
      bets,
      tokensAndBets: extra.tokensAndBets ?? true,
      accepted: extra.accepted,
    });
    return { ...result, card };
  };
  const years = (p: Player | undefined) => p?.timeline.map((c) => c.year);
  const table = () => [player('Ann', [1990, 2010]), player('Ben', [1980]), player('Cat', [2005]), player('Dan', [1970])];

  it('current right, no bets: the card and +1 token', () => {
    const players = table();
    const r = setup(players, 1, []);
    expect(r.correct).toBe(true);
    expect(r.cardWinnerIndex).toBe(0);
    expect(r.bets).toEqual([]);
    expect(years(r.players[0])).toEqual([1990, 2000, 2010]);
    expect(r.players[0]?.tokens).toBe(2);
    expect(r.players.slice(1)).toEqual(players.slice(1));
  });

  it('current right: every wrong bettor loses their token', () => {
    const r = setup(table(), 1, [
      { playerIndex: 1, slotIndex: 0 },
      { playerIndex: 2, slotIndex: 2 },
    ]);
    expect(r.cardWinnerIndex).toBe(0);
    expect(r.bets).toEqual([
      { playerIndex: 1, slotIndex: 0, outcome: 'lost' },
      { playerIndex: 2, slotIndex: 2, outcome: 'lost' },
    ]);
    expect(r.players.map((p) => p.tokens)).toEqual([2, 0, 0, 1]);
    // A wrong bet takes nothing from the bettor's timeline.
    expect(years(r.players[1])).toEqual([1980]);
    expect(years(r.players[2])).toEqual([2005]);
  });

  it('current right: a bettor on another right spot (same year) keeps their token', () => {
    // Ann holds 1990, 2000, 2010: slots 1 and 2 are both right for a 2000 song.
    const players = [player('Ann', [1990, 2000, 2010]), player('Ben', [1980]), player('Cat', [2005])];
    const r = setup(players, 1, [
      { playerIndex: 1, slotIndex: 2 },
      { playerIndex: 2, slotIndex: 0 },
    ]);
    expect(r.cardWinnerIndex).toBe(0);
    expect(r.bets.map((b) => b.outcome)).toEqual(['right', 'lost']);
    expect(r.players.map((p) => p.tokens)).toEqual([2, 1, 0]);
    expect(r.players[0]?.timeline).toHaveLength(4);
    expect(r.players[1]).toBe(players[1]);
  });

  it("current wrong, one right bettor: the card goes into the bettor's own sorted timeline, +1 token, stake kept", () => {
    const players = table();
    const r = setup(players, 0, [
      { playerIndex: 1, slotIndex: 2 },
      { playerIndex: 2, slotIndex: 1 },
    ]);
    expect(r.correct).toBe(false);
    expect(r.cardWinnerIndex).toBe(2);
    expect(r.bets).toEqual([
      { playerIndex: 1, slotIndex: 2, outcome: 'lost' },
      { playerIndex: 2, slotIndex: 1, outcome: 'won' },
    ]);
    // Cat held 2005: the 2000 card goes first, by year, not at the slot she bet on.
    expect(years(r.players[2])).toEqual([2000, 2005]);
    expect(r.players[2]?.timeline[0]).toBe(r.card);
    expect(r.players.map((p) => p.tokens)).toEqual([1, 0, 2, 1]);
    // The current player keeps what they had.
    expect(r.players[0]).toBe(players[0]);
  });

  it('two right bettors: the earlier bet wins the card, the later one keeps their token', () => {
    const players = [player('Ann', [1990, 2000, 2010]), player('Ben', [1980]), player('Cat', [2005]), player('Dan', [1970])];
    // Cat bet first (slot 2), then Ben (slot 1), then Dan (slot 3, wrong); Ann picked 0 (wrong).
    const r = setup(players, 0, [
      { playerIndex: 2, slotIndex: 2 },
      { playerIndex: 1, slotIndex: 1 },
      { playerIndex: 3, slotIndex: 3 },
    ]);
    expect(r.cardWinnerIndex).toBe(2);
    expect(r.bets.map((b) => b.outcome)).toEqual(['won', 'right', 'lost']);
    expect(r.players.map((p) => p.tokens)).toEqual([1, 1, 2, 0]);
    expect(r.players[1]?.timeline).toHaveLength(1);
    expect(r.players[2]?.timeline).toHaveLength(2);
  });

  it('nobody right: the card is out, every bettor loses their token, no timeline changes', () => {
    // Ann holds 1990, 2010, 2020: only slot 1 is right.
    const players = [player('Ann', [1990, 2010, 2020]), player('Ben', [1980]), player('Cat', [2005]), player('Dan', [1970])];
    const r = setup(players, 0, [
      { playerIndex: 1, slotIndex: 2 },
      { playerIndex: 3, slotIndex: 3 },
    ]);
    expect(r.correct).toBe(false);
    expect(r.cardWinnerIndex).toBeNull();
    expect(r.bets).toEqual([
      { playerIndex: 1, slotIndex: 2, outcome: 'lost' },
      { playerIndex: 3, slotIndex: 3, outcome: 'lost' },
    ]);
    expect(r.players.map((p) => p.timeline.length)).toEqual([3, 1, 1, 1]);
    expect(r.players.map((p) => p.tokens)).toEqual([1, 0, 1, 0]);
  });

  it('current wrong and no bets: nothing changes', () => {
    const players = table();
    const r = setup(players, 2, []);
    expect(r.correct).toBe(false);
    expect(r.cardWinnerIndex).toBeNull();
    r.players.forEach((p, i) => expect(p).toBe(players[i]));
  });

  it('checks every spot against the timeline before the card is added', () => {
    // Ann picks 1 (right). After adding 2000, slot 2 would sit between 2000 and
    // 2010 and look right, but against the timeline as it was it is wrong.
    const r = setup(table(), 1, [{ playerIndex: 1, slotIndex: 2 }]);
    expect(r.bets).toEqual([{ playerIndex: 1, slotIndex: 2, outcome: 'lost' }]);
    expect(r.players[1]?.tokens).toBe(0);
  });

  it('caps tokens at 5 for the current player and for a winning bettor', () => {
    const current = setup([player('Ann', [1990, 2010], 5), player('Ben', [1980], 1)], 1, []);
    expect(current.players[0]?.tokens).toBe(5);
    expect(current.players[0]?.timeline).toHaveLength(3);

    const bettor = setup([player('Ann', [1990, 2010], 1), player('Ben', [1980], 5)], 0, [{ playerIndex: 1, slotIndex: 1 }]);
    expect(bettor.cardWinnerIndex).toBe(1);
    expect(bettor.players[1]?.tokens).toBe(5);
    expect(bettor.players[1]?.timeline).toHaveLength(2);
  });

  it('never takes a token below 0', () => {
    const r = setup([player('Ann', [1990, 2010]), player('Ben', [1980], 0)], 1, [{ playerIndex: 1, slotIndex: 0 }]);
    expect(r.players[1]?.tokens).toBe(0);
  });

  it('accepted ("We accept it"): every bet is refunded and no bettor gets the card', () => {
    const players = table();
    const bets = [
      { playerIndex: 1, slotIndex: 2 },
      { playerIndex: 2, slotIndex: 1 },
    ];
    const wrong = setup(players, 0, bets, { accepted: true });
    expect(wrong.cardWinnerIndex).toBeNull();
    expect(wrong.bets.map((b) => b.outcome)).toEqual(['refunded', 'refunded']);
    expect(wrong.players.map((p) => p.tokens)).toEqual([1, 1, 1, 1]);
    expect(wrong.players.map((p) => p.timeline.length)).toEqual([2, 1, 1, 1]);

    const right = setup(players, 1, [{ playerIndex: 1, slotIndex: 0 }], { accepted: true });
    expect(right.cardWinnerIndex).toBe(0);
    expect(right.bets).toEqual([{ playerIndex: 1, slotIndex: 0, outcome: 'refunded' }]);
    expect(right.players.map((p) => p.tokens)).toEqual([2, 1, 1, 1]);
    expect(right.players[0]?.timeline).toHaveLength(3);
  });

  it('with the switch off, no token ever changes', () => {
    const players = table();
    const right = setup(players, 1, [], { tokensAndBets: false });
    expect(right.cardWinnerIndex).toBe(0);
    expect(right.players[0]?.timeline).toHaveLength(3);
    expect(right.players.map((p) => p.tokens)).toEqual([1, 1, 1, 1]);

    const lost = setup(players, 1, [{ playerIndex: 1, slotIndex: 0 }], { tokensAndBets: false });
    expect(lost.players.map((p) => p.tokens)).toEqual([1, 1, 1, 1]);
  });

  it('settles the turn of a player who is not first in the seat order', () => {
    const players = [player('Ann', [1980]), player('Ben', [1990, 2010]), player('Cat', [2005])];
    const r = settleTurn({
      players,
      current: 1,
      song: song(2000),
      pickedSlot: 2,
      bets: [
        { playerIndex: 0, slotIndex: 1 },
        { playerIndex: 2, slotIndex: 0 },
      ],
      tokensAndBets: true,
    });
    expect(r.correct).toBe(false);
    expect(r.cardWinnerIndex).toBe(0);
    expect(r.players.map((p) => p.tokens)).toEqual([2, 1, 0]);
    expect(r.players.map((p) => p.timeline.length)).toEqual([2, 2, 1]);
  });

  it('does not mutate its input', () => {
    const players = table();
    const snapshot = JSON.parse(JSON.stringify(players)) as Player[];
    const bets = [{ playerIndex: 2, slotIndex: 1 }];
    setup(players, 0, bets);
    expect(players).toEqual(snapshot);
    expect(bets).toEqual([{ playerIndex: 2, slotIndex: 1 }]);
  });
});
