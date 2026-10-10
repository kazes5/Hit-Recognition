export type Language = 'he' | 'en';

/** Song as returned by the API (docs/CONTRACTS.md §4). Genre and difficulty stay on the server. */
export interface Song {
  id: number;
  artist: string;
  title: string;
  year: number;
  language: Language;
}

export type SongLanguageSetting = 'he' | 'en' | 'both';

/** Settings choice; sent to the server as `maxDifficulty` 1 / 2 / 3. */
export type DifficultySetting = 'easy' | 'medium' | 'hard';

export interface Player {
  name: string;
  /** Cards sorted by year ascending (stable for equal years). */
  timeline: Song[];
  /** 0…MAX_TOKENS. Only used when the game has tokens and bets on. */
  tokens: number;
}

/** `betting`: the current player locked in; other players may try to bet before Reveal. */
export type Phase = 'setup' | 'dealing' | 'turn' | 'betting' | 'result' | 'winner';

/** The current player's typed names and how the server judged them. */
export interface NameGuess {
  artist: string;
  title: string;
  artistCorrect: boolean;
  titleCorrect: boolean;
}

/** A bet on a slot of the CURRENT player's timeline. Bets are kept in the order they were placed. */
export interface Bet {
  playerIndex: number;
  slotIndex: number;
}

/** won: got the card · right: a right spot, but the card went to someone else · lost: wrong spot · refunded: "We accept it". */
export type BetOutcome = 'won' | 'right' | 'lost' | 'refunded';

export interface SettledBet extends Bet {
  outcome: BetOutcome;
}

/** The player holding the phone in the betting round. `allowed` is null until their names are checked. */
export interface ActiveBettor {
  playerIndex: number;
  allowed: boolean | null;
}

export interface TurnResult {
  song: Song;
  slotIndex: number;
  correct: boolean;
  /** The fields below exist only in games with tokens and bets on. */
  guess?: NameGuess | null;
  bets?: SettledBet[];
  /** Who got the card: the current player, a bettor, or null (discarded). */
  cardWinnerIndex?: number | null;
  /** "We accept it" was tapped: the bets were cancelled. */
  accepted?: boolean;
  /** Players before the turn was settled, to settle it again after "We accept it". */
  playersBefore?: Player[];
}

export interface GameState {
  phase: Phase;
  players: Player[];
  targetScore: number;
  currentPlayerIndex: number;
  /** Number of players who already received their starting card. */
  dealtCount: number;
  /** Song currently being guessed (hidden until reveal). */
  currentSong: Song | null;
  currentPreviewUrl: string | null;
  selectedSlot: number | null;
  lastResult: TurnResult | null;
  /** Every song id that appeared in this game (dealt, played or skipped). */
  usedIds: number[];
  /** Every artist that appeared in this game (unique, original casing). */
  usedArtists: string[];
  endedEarly: boolean;
  /** Tokens, naming and bets (docs/TOKENS_AND_BETS.md). Off: the game plays as before. */
  tokensAndBets: boolean;
  /** The current player's guess for this turn, once locked in. */
  guess: NameGuess | null;
  /** This turn's bets, in the order they were placed. */
  bets: Bet[];
  /** Players who already tried to bet this turn (one try each). */
  triedThisTurn: number[];
  activeBettor: ActiveBettor | null;
}

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 10;
export const MIN_TARGET = 3;
export const MAX_TARGET = 30;
export const DEFAULT_TARGET = 10;
export const START_TOKENS = 1;
export const MAX_TOKENS = 5;
/** Price of skipping a song. */
export const SKIP_COST = 3;
export const CLIP_SECONDS = 30;
export const DECK_CODE = 'IL01';
