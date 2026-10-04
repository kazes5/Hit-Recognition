import { insertCard, isPlacementCorrect } from './rules';
import {
  MAX_TOKENS,
  SKIP_COST,
  type Bet,
  type GameState,
  type NameGuess,
  type Player,
  type SettledBet,
  type Song,
} from './types';

/** Tokens, naming and bets: pure rules (docs/TOKENS_AND_BETS.md §1). */

export function awardToken(tokens: number): number {
  return Math.min(MAX_TOKENS, tokens + 1);
}

export function spendTokens(tokens: number, count = 1): number {
  return Math.max(0, tokens - count);
}

/** The current player named both: no bets this turn. */
export function namesCorrect(guess: NameGuess | null): boolean {
  return !!guess && guess.artistCorrect && guess.titleCorrect;
}

/** The current player named the artist or the title: that earns them a token. */
export function namedAny(guess: NameGuess | null): boolean {
  return !!guess && (guess.artistCorrect || guess.titleCorrect);
}

/** What a bettor may still name: only the parts the current player did not get right. */
export interface OpenParts {
  artist: boolean;
  title: boolean;
}

export function openParts(guess: NameGuess | null): OpenParts {
  return { artist: !guess?.artistCorrect, title: !guess?.titleCorrect };
}

/**
 * A bettor must name a part the current player did not get right: the title
 * if the current player named the artist, the artist if they named the title,
 * either one if they named neither.
 */
export function earnsBet(artistCorrect: boolean, titleCorrect: boolean, guess: NameGuess | null = null): boolean {
  const open = openParts(guess);
  return (open.artist && artistCorrect) || (open.title && titleCorrect);
}

/** Slots of a timeline with `timelineLength` cards that nobody has taken yet. */
export function freeBetSlots(timelineLength: number, pickedSlot: number, bets: readonly Bet[]): number[] {
  const taken = new Set([pickedSlot, ...bets.map((b) => b.slotIndex)]);
  const free: number[] = [];
  for (let i = 0; i <= timelineLength; i++) if (!taken.has(i)) free.push(i);
  return free;
}

function currentFreeSlots(state: GameState): number[] {
  const current = state.players[state.currentPlayerIndex];
  if (!current || state.selectedSlot === null) return [];
  return freeBetSlots(current.timeline.length, state.selectedSlot, state.bets);
}

/** Why a player cannot try to bet right now, or null if they can. */
export type BetBlock = 'current' | 'noTokens' | 'tried' | 'noFreeSlots';

export function betBlock(state: GameState, playerIndex: number): BetBlock | null {
  const player = state.players[playerIndex];
  if (!player || playerIndex === state.currentPlayerIndex) return 'current';
  if (state.triedThisTurn.includes(playerIndex)) return 'tried';
  if (player.tokens < 1) return 'noTokens';
  if (currentFreeSlots(state).length === 0) return 'noFreeSlots';
  return null;
}

/** Players who may still try to bet this turn (switch on, bets open), in seat order. */
export function eligibleBettors(state: GameState): number[] {
  if (!state.tokensAndBets || namesCorrect(state.guess)) return [];
  return state.players.map((_, i) => i).filter((i) => betBlock(state, i) === null);
}

/**
 * Before Lock in: could anyone bet if the current player does not name both?
 * Also before a spot is picked: with no bets yet, every pick leaves the same number of free slots.
 */
export function anyoneCouldBet(state: GameState): boolean {
  return (
    eligibleBettors({ ...state, guess: null, bets: [], triedThisTurn: [], selectedSlot: state.selectedSlot ?? 0 })
      .length > 0
  );
}

export function canSkip(state: GameState): boolean {
  const player = state.players[state.currentPlayerIndex];
  return (
    state.tokensAndBets &&
    state.phase === 'turn' &&
    state.currentSong !== null &&
    !!player &&
    player.tokens >= SKIP_COST
  );
}

export interface TurnSettlement {
  players: Player[];
  correct: boolean;
  cardWinnerIndex: number | null;
  bets: SettledBet[];
  /** The current player earned a token for naming. */
  namedToken: boolean;
}

/**
 * Settles a revealed turn. Every spot is checked against the current player's
 * timeline before the card is added. The card goes to the current player if
 * their spot is right, else to the earliest bet on a right spot, else to nobody.
 * Tokens: the current player gets +1 for naming the artist or the title,
 * whatever the spot; winning a card gives no token (a winning bettor keeps the
 * bet token). A wrong bet loses its token; a right bet that did not get the
 * card keeps it. `accepted` ("We accept it") counts the typed names as right
 * and cancels every bet. Tokens only change with `tokensAndBets` on.
 */
export function settleTurn(input: {
  players: readonly Player[];
  current: number;
  song: Song;
  pickedSlot: number;
  bets: readonly Bet[];
  tokensAndBets: boolean;
  /** The current player's checked names, if they typed any. */
  guess?: NameGuess | null;
  accepted?: boolean;
}): TurnSettlement {
  const { players, current, song, pickedSlot, bets, tokensAndBets, guess = null, accepted = false } = input;
  const namedToken = tokensAndBets && !!guess && (accepted || namedAny(guess));
  const base = players[current]?.timeline ?? [];
  const correct = isPlacementCorrect(base, pickedSlot, song.year);
  const isRight = (bet: Bet) => isPlacementCorrect(base, bet.slotIndex, song.year);
  const firstRightBet = accepted ? undefined : bets.find(isRight);
  const cardWinnerIndex = correct ? current : (firstRightBet?.playerIndex ?? null);

  const settled: SettledBet[] = bets.map((bet) => {
    if (accepted) return { ...bet, outcome: 'refunded' };
    if (!isRight(bet)) return { ...bet, outcome: 'lost' };
    return { ...bet, outcome: bet.playerIndex === cardWinnerIndex ? 'won' : 'right' };
  });

  const next = players.map((player, i) => {
    let { timeline, tokens } = player;
    if (i === cardWinnerIndex) timeline = insertCard(timeline, song);
    if (i === current && namedToken) tokens = awardToken(tokens);
    if (tokensAndBets && settled.some((b) => b.playerIndex === i && b.outcome === 'lost')) {
      tokens = spendTokens(tokens);
    }
    return timeline === player.timeline && tokens === player.tokens ? player : { ...player, timeline, tokens };
  });

  return { players: next, correct, cardWinnerIndex, bets: settled, namedToken };
}
