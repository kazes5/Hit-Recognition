# Tokens, naming and bets: plan

**Status:** planned, not started. This is step 9.4 in [PLAN.md](../PLAN.md).

This plan adds three things to the game:
- every player has **tokens**;
- the current player can also **name the artist and the song title**;
- the other players can **bet a token** on where the song belongs on the current player's timeline.

It was written from four research reports: the game logic, the screens, how to check typed answers, and the official HITSTER token rules.

---

## 1. The new rules, as the app will play them

1. **Tokens.** Every player starts with **1 token**. A player gets **+1 token for every card they win**, up to **5**. A token earned while holding 5 is lost. The starting card gives no token.
2. **Naming (optional).** On their turn, after picking a spot on the timeline, the player can also type the **artist** and the **song title**. The app checks both without showing the answer.
3. **Bets.** Bets are only allowed if the current player did **not** name both the artist and the title correctly.
   - Each other player who has at least 1 token may bet **1 token** on a spot of the **current player's** timeline.
   - The spot must be different from the current player's spot and from every other bet. Each player can place one bet per turn.
4. **Reveal and outcome.**
   - **Current player placed it right:** they get the card and +1 token. Every bettor on a wrong spot loses their token.
   - **Current player placed it wrong, and a bettor is on a right spot:** that bettor gets the card. It goes into **their own** timeline, sorted by year. They keep their token and get +1 token for the card. Wrong bettors lose their token.
   - **Nobody is right:** the card is discarded, and every bettor loses their token.
5. **Winner.** The first player to reach the target score wins, as today. A bettor can now reach it on someone else's turn, so the app checks **all** players after each turn.

---

## 2. Decisions for the owner

Some parts of the requested rules can be read in more than one way. The plan uses the **default** below for each one; any of them is a small change.

| # | Question | Default in this plan | Other choice |
|---|---|---|---|
| D1 | Rule 4 says the current player gets "the card and an additional token". Is that the same token as rule 1 (+1 per card), or a second one? | The same token: **+1 per card** in total. | +2 when the current player wins the card. |
| D2 | Does naming both correctly earn a token by itself? | **No.** It only blocks bets. | +1 token, even with a wrong placement (this is the official rule). |
| D3 | Does a bettor who wins the card keep the token they bet? | **Yes**, and they also get +1 for the card. | The bet token is spent, and the +1 for the card replaces it. |
| D4 | Must a bettor also name the artist and title to win the card? (the part in brackets in rule 3) | **No**, the spot alone decides. | The bettor must also type both names correctly (like the official PRO mode). |
| D5 | "Should be different than the other": different from what? | Different from the current player's spot **and** from the other bets. | |
| D6 | Two bettors on right spots. This can happen because a song with the same year as a timeline card is right on either side of it. | The first bettor in seat order after the current player wins the card. The other keeps their token. | |
| D7 | The current player is right, and a bettor is on another spot that is also right (same year). | The current player gets the card. That bettor's bet was **not wrong**, so they keep their token. | The bettor loses the token (the official rule). |
| D8 | "A wrong bet will cause him to lose the token and the card." | The bettor loses the token and does not get the card. Nothing is taken from their timeline. | |
| D9 | The current player names both correctly but places the card wrong. | The card is discarded, and no bets are allowed. | |
| D10 | Who decides whether a name is correct? | The app, using typed text with tolerant matching. After Reveal, the players can tap **"We accept it"** to overrule a rejected answer. This cancels all bets of that turn and returns the bet tokens. | Honour system: show the names first, then let the players judge. This gives the bettors the answer before they bet. |
| D11 | Can the feature be turned off? | Yes. Setup gets a **"Tokens & bets"** switch, **on** by default, and the last choice is remembered. Games saved before this change finish with it off. | The switch is off by default. |
| D12 | Can tokens be used for anything else? (The official game lets you skip a song for 1 token, or buy a card for 3 tokens.) | **No**, not for now. | Add the skip and buy options later. |
| D13 | When the game is ended early and players are tied on cards, do tokens break the tie? | **No.** The tie stays shared, as today. | The player with more tokens wins. |

**Compared with the official HITSTER rules:** the official game starts with 2 tokens, not 1. It gives a token for naming the artist and title, not for winning a card. It lets players challenge even when the current player named the song. A spent token goes back in the box, even after a successful steal. The house rules above are kept as the owner asked, and the defaults borrow from the official rules only where the requested rules say nothing.

---

## 3. How a turn works on one phone

The game is still played on one shared phone. The steps marked **new** are added.

1. **Play.** The clip plays, and the card stays hidden. *(as today)*
2. **Pick a spot** on your timeline. *(as today)*
3. **Name it (new, optional).** A small button, **"Name artist + title"**, opens two text fields.
   - Skipping it costs no taps.
   - The button only shows when someone could bet, that is, when another player has a token.
4. **Lock in (new).** This replaces **Reveal** whenever someone could bet.
   - The app checks the names.
   - **If both are right, or nobody can bet**, the card is revealed straight away, with the note "Named it! No bets allowed".
   - **Otherwise** the screen says **"Bets are open!"**. It never says which name was wrong.
5. **Betting round (new).** The phone goes around the table in seat order, starting after the current player.
   - A banner says **"Bob, your bet"** and shows Bob's tokens.
   - The timeline shown is the **current player's**. Their spot is marked with a pink disc and their initial. Spots already bet on are marked with gold discs and the bettor's initial. A legend under the timeline names each player, so the meaning never depends on colour alone.
   - Bob picks a free spot and taps **"Bet 1 token"**, or taps **"Pass"**. A **"No more bets"** button ends the round early.
   - Players with 0 tokens are skipped with a short note. When no free spot is left, the round ends.
   - If everybody passes, the card is revealed straight away.
6. **Reveal.** The results are shown on the result screen. *(see §6)*
7. **Next.** If any player reached the target, the Winner screen comes next.

**Taps per turn:** a 2-player turn where nobody bets takes 5 taps: Play, spot, Lock in, Pass, Next. Today it takes 4. A turn where nobody can bet stays at 4.

---

## 4. Checking the artist and title

### 4.1 Where the check runs: a new server endpoint

```
POST /api/songs/:id/guess   { "artist"?: string, "title"?: string }
→ 200 { "artistCorrect": boolean, "titleCorrect": boolean }
→ 404 SONG_NOT_FOUND   → 400 INVALID_REQUEST (body is not an object, a field is not a string, or a field is longer than 200 characters)
```

- **The answer never appears in the response:** no artist, title, year or "did you mean".
- **It is stateless,** like `/preview` and `/cover`: the song is looked up by its id.
- **A missing or empty field counts as wrong** for that field. It is not an error.
- **The request is sent only when the player taps Lock in after typing a name.** If the request fails, the screen shows an error with *Try again* and *Continue without naming*. Continuing means bets are open.
- **Before Reveal,** the screen shows only "no bets" or "bets open". Which part was right (✓/✗ for artist and title) is shown after Reveal.

**Why a server endpoint and not a check in the browser:**
- The text matcher already lives in the server (`server/src/preview/matching.ts`), and `web/` cannot import from `server/`.
- The other accepted names (the aliases in §4.3) can stay in the catalog and out of the public song data.
- It is the first step if the answer is ever hidden from the browser.

**Known gap:** today the browser already holds the artist, title and year before Reveal, both in the `/songs/next` response and in the saved game in localStorage. Anyone who opens the developer tools can see them. This plan does not change that.

### 4.2 Matching rules

Move `normalizeText`, `normalizeArtist`, `normalizeTitleCore` and `HEBREW_AND` from `server/src/preview/matching.ts` into a new `server/src/text.ts`. `matching.ts` re-exports them, so its tests do not change. Add `normalizeGuess` on top of them.

**Before comparing,** both the typed text and the catalog text are cleaned up:
- **Already handled today:** case, accents and Hebrew vowel marks (niqqud) are ignored, and `&` / `and` / `ו` count as the same.
- **New: apostrophes.** Apostrophes and the Hebrew geresh/gershayim (`' ’ ׳ ״ "`) are removed, not turned into spaces. So `ד'אור` reads as `דאור`.
- **New: Hebrew final letters.** They count as the normal letter: ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ.
- **New: standalone "n".** `n` on its own counts as `and`, as in "Guns N' Roses".
- **New: leading words.** A leading `the` is removed. For artists, a leading `להקת` ("the band") is removed too.
- **New: part numbers.** A title ending in `, Part 2` or `Pt. 2` is matched without it.

**Comparing:**
- **Spaces are ignored,** so `acdc` matches `AC/DC`.
- **Typos are allowed,** depending on the length of the expected text. Swapping two neighbouring letters counts as one typo.

  | Expected length | Typos allowed |
  |---|---|
  | up to 4 characters | 0 |
  | up to 8 | 1 |
  | up to 14 | 2 |
  | up to 20 | 3 |
  | longer | 4 |

**Title is correct** if the guess matches any one of:
- the full title;
- the title without the part in brackets;
- the text inside the brackets on its own ("I Feel Good");
- a `titleAliases` entry.

A part of the title does **not** count: "Wake Me Up" alone is wrong.

**Artist is correct** if any one of these is true:
- The guess matches the full credit, with the names in any order.
- The guess matches an `artistAliases` entry.
- Every name in the guess matches one of the song's credited artists.
  - The guess is split on `& , + and ו feat ft featuring with x vs עם`.
  - A credited artist only counts on its own if it has at least two words after a leading "the" is removed, or if it is listed in the catalog's `artistKeys`.
  - This stops "Earth" from matching *Earth, Wind & Fire*, or "חלב" from matching *חלב ודבש*.
  - If any name in the guess is wrong, the artist is wrong.

**Do not reuse `artistMatches` as it is.** It accepts "and the" for *Kool & the Gang*, and it accepts made-up featured artists.

### 4.3 Aliases: other accepted names

Add two optional fields to the catalog-only part of each song. `toPublicSong` already leaves them out of what the browser receives.
- `artistAliases: string[]`: Latin spellings of Hebrew names ("Eyal Golan"), and short forms ("Pink").
- `titleAliases: string[]`: other known titles ("Nothing Compares to You").

songs.json has no aliases today. Typing a Hebrew artist in English letters will fail until they are added (step 5). Converting Latin letters to Hebrew automatically was looked at and dropped: it gets short names wrong.

### 4.4 "We accept it"

Fuzzy matching will sometimes reject a fair answer. The fix:
- **When the button shows:** on the result screen, only when the names were judged not both correct.
- **What it does:** the group taps **"We accept it"**. The turn is then settled again as if no bets had been placed:
  - the bet tokens go back;
  - a card won by a bettor is taken back out of their timeline.
- **Only in one direction.** A name that was accepted cannot be turned into a wrong one after Reveal, because the bets can no longer be placed fairly.

---

## 5. Game logic (`web/src/game/`)

### 5.1 Types

```ts
export const START_TOKENS = 1;
export const MAX_TOKENS = 5;

export interface Player { name: string; timeline: Song[]; tokens: number }
export type Phase = 'setup' | 'dealing' | 'turn' | 'betting' | 'result' | 'winner';

export interface NameGuess { artist: string; title: string; artistCorrect: boolean; titleCorrect: boolean }
/** A bet on a slot of the CURRENT player's timeline. */
export interface Bet { playerIndex: number; slotIndex: number }
export type BetOutcome = 'won' | 'right' | 'lost' | 'refunded';

export interface TurnResult {
  song: Song; slotIndex: number; correct: boolean;
  guess?: NameGuess | null;
  bets?: (Bet & { outcome: BetOutcome })[];
  cardWinnerIndex?: number | null;
  accepted?: boolean;               // "We accept it" was tapped
  playersBefore?: Player[];         // used to settle the turn again after "We accept it"
}
// GameState gets: tokensAndBets: boolean; guess: NameGuess | null; bets: Bet[]; bettorIndex: number | null
```

- `turn` still covers playing, picking the spot and typing the names.
- `betting` is the new step between Lock in and Reveal.
- The new `TurnResult` fields are optional, so results saved by the current version still show.

### 5.2 Actions (`reducer.ts`)

| Action | What it does |
|---|---|
| `START_GAME { names, targetScore, tokensAndBets }` | Every player starts with `START_TOKENS`. `DEAL_CARD` gives no token. |
| `GUESS_JUDGED { guess }` | Allowed only in `turn`, with a song and a spot chosen. Stores the guess, then either reveals at once (`resolveTurn`) or moves to `betting` with the first bettor in seat order. Once the phase is `betting`, `SELECT_SLOT` is ignored. |
| `LOCK_IN` | The same as `GUESS_JUDGED` with no names typed. |
| `PLACE_BET { slotIndex }` | Allowed for the current bettor if `canBet` is true and the spot is free. Moves on to the next eligible bettor, or ends the round. |
| `PASS_BET` / `END_BETTING` | Moves to the next bettor, or ends the round. If the round ends with no bets, the card is revealed at once. |
| `REVEAL` | From `turn` when nobody can bet (as today), or from `betting` when the round is over. Calls `resolveTurn`. |
| `ACCEPT_GUESS` | Only in `result`. Settles the turn again from `playersBefore`, with the bets cancelled. |
| `SONG_FAILED` | Now also accepted in `betting`. Goes back to `turn` with the guess and bets cleared. No tokens change, because tokens only move when the turn is settled. |
| `NEXT` | Checks **every** player for the target score (today it checks only the current player, `reducer.ts:133`). Clears the guess and bets. |
| `END_GAME` | From `betting` it just drops the bets. |

### 5.3 Pure rule functions (`rules.ts`, or a new `tokens.ts`)

```ts
awardToken(t: number): number            // Math.min(MAX_TOKENS, t + 1)
spendToken(t: number): number            // Math.max(0, t - 1)
namesCorrect(g: NameGuess | null): boolean
bettingOrder(current: number, count: number): number[]   // seat order, starting after the current player
freeBetSlots(timelineLength: number, pickedSlot: number, bets: readonly Bet[]): number[]
canBet(state: GameState, playerIndex: number): boolean   // switch on, bets open, not the current player, tokens >= 1, a free spot exists
anyoneCanBet(state: GameState): boolean
resolveTurn(input): { players: Player[]; result: TurnResult }
anyReachedTarget(players: readonly Player[], target: number): boolean
```

**How `resolveTurn` settles a turn:**
1. Every spot is checked against the current player's timeline **before** the new card is added: the current player's spot and each bet.
2. The card goes to the current player if their spot is right. If not, it goes to the first bettor in seat order whose spot is right. If nobody is right, it goes to nobody.
3. The card winner gets the card inserted in their own timeline with `insertCard`, sorted by year (not at the spot they bet on), and `awardToken`.
4. A bettor on a wrong spot gets `spendToken`. A bettor on a right spot who did not get the card keeps their token (outcome `right`).

### 5.4 Saved games

- `persistence.ts` goes to `VERSION = 2`, and `betting` is added to `RESUMABLE`.
- A version 1 save is **migrated**, not thrown away: every player gets `tokens: 1`, `tokensAndBets: false`, `guess: null` and `bets: []`. An old game therefore finishes under the old rules.
- `looksLikeState` also checks `tokens`, `bets` and `tokensAndBets`.
- A save from an unknown version is still ignored.
- A game reloaded in the middle of the betting round resumes with the same bettor and the same bets.

---

## 6. Screens

**Mockups:** the [UI design canvas](https://claude.ai/artifact/4FzDZZfJcLzt3MD3NQ8Ujz) has 12 phone screens: the turn flow, every result, the scoreboard, setup, a Hebrew (RTL) betting screen and a sheet of the new parts. It is private to the owner until shared.

**Design decisions (approved by the owner):**
- **The bet button is gold, not pink.** "Bet 1 token" uses the token gold (`--color-token`) with dark text and a token icon, so spending a token looks different from the main pink action. Every other main action (Lock in, Reveal, Next player) stays pink.
- **Taken spots show the player's initial.** During betting, a taken spot shows a disc with the player's initial: pink for the current player's pick, gold for a bet. Full names would not fit on small phones. If two players share an initial, the disc shows two letters. A legend under the timeline gives the full names.

### 6.1 Showing tokens
- **Token icon.** A small gold disc with a "♪" and a glow, in a new colour token `--color-token: #ffd166`.
- **Token meter.** Shows 5 pips, filled for each token held. Screen readers hear "3 of 5 tokens". With 5 tokens it shows "Max".
- **Where tokens appear:**

  | Place | What is shown |
  |---|---|
  | Turn header | ◉ 3, next to the card count |
  | Betting banner | the full meter |
  | Scoreboard | a new Tokens column (Player / Tokens / Cards) |
  | Winner screen | a meter beside each score |

### 6.2 Result screen
The current line, "Correct!" or "Wrong, it was 2003", stays. Below it, up to 3 short rows describe what happened:

| What happened | What is shown |
|---|---|
| Right, named both | "Named it! No bets allowed." · Ann: +1 card · +1 token |
| Right, with bets | Ann: +1 card · +1 token · "−1 token: Bob, Carol" |
| Wrong, a bettor right | "Bob wins the card!" · Bob: +1 card · +1 token · "−1 token: Carol" |
| Two bettors right | as above, plus "Correct bet, but Bob bet first" for the other bettor (who keeps their token) |
| Wrong, nobody right | "Nobody got it. The card is out." · "−1 token: …" |
| Token cap | "+1 card (tokens full)" |

- **The typed names** are shown after Reveal, with ✓/✗ for each.
- **"We accept it"** shows when the names were rejected (see §4.4).
- **When a bettor wins the card,** the timeline on the result screen switches to the bettor's timeline, shows "Added to Bob's timeline", and the new card gets a gold outline.

### 6.3 Setup
A **"Tokens & bets"** switch, on by default and remembered on the phone. In a 1-player game the switch has no effect.

### 6.4 Phones, Hebrew and accessibility

**Text fields**
- `dir="auto"`, so Hebrew and English both type correctly.
- 16px font, so iPhone does not zoom in.
- Autocorrect, autocomplete and spellcheck are off.
- Visible labels.
- No list of suggestions, because it would give away the answer.

**Keyboard**
- The fields sit below the timeline, so the spot is picked before the keyboard opens.
- `interactive-widget=resizes-content` is added to the viewport tag in `web/index.html`, so the footer stays above the Android keyboard.

**Small phones (360×640)**
- During betting, the speaker area shrinks.
- The losers are grouped into one row.
- Names that are too long are cut with "…".
- The page never scrolls sideways; only the timeline scrolls.

**Names inside text**
- A new `tNode()` helper places player names inside `<bdi>`, so English names in Hebrew sentences (and the other way round) show in the right order.
- "+1" and "−1" are wrapped in `dir="ltr"`.

**Accessibility**
- Taken spots use `aria-disabled`, so screen readers still reach them.
- The change of bettor is announced with `aria-live`.
- All buttons are at least 44px.

### 6.5 New text (English | Hebrew)

| Key | English | עברית |
|---|---|---|
| tokens | Tokens | אסימונים |
| tokensCount | {count} of {max} tokens | {count} מתוך {max} אסימונים |
| tokensMax | Max | מקסימום |
| tokensAndBets | Tokens & bets | אסימונים והימורים |
| tokenRule | Start with 1 token, +1 for every card (max {max}). | מתחילים עם אסימון אחד, ועוד אחד על כל קלף (עד {max}). |
| nameItToggle | Name artist + title | לנחש מבצע ושם שיר |
| nameItLegend | Name both to block bets (optional) | ניחוש של שניהם חוסם הימורים (לא חובה) |
| guessArtist | Artist | מבצע |
| guessArtistPlaceholder | Who sings it? | מי שר? |
| guessTitle | Song title | שם השיר |
| guessTitlePlaceholder | What's it called? | איך קוראים לשיר? |
| lockIn | Lock in | נועלים תשובה |
| pickSlotFirst | Pick a spot on the timeline first | קודם בוחרים מקום בציר הזמן |
| guessFailed | Couldn't check the names. | לא הצלחנו לבדוק את הניחוש. |
| continueWithoutNaming | Continue without naming | להמשיך בלי ניחוש |
| bettingOpen | Bets are open! | ההימורים פתוחים! |
| betTurn | {name}, your bet | {name}, תורך להמר |
| betHint | Think {player} is wrong? Put 1 token on another spot. | חושבים ש-{player} טועה? שימו אסימון על מקום אחר. |
| placeBet | Bet 1 token | להמר באסימון |
| passBet | Pass | בלי הימור |
| endBetting | No more bets | אין עוד הימורים |
| noTokensToBet | {name} has no tokens | ל-{name} אין אסימונים |
| noFreeSlots | No free spots left | לא נשארו מקומות פנויים |
| slotPickOf | {slot}: {name}'s pick | {slot}: הבחירה של {name} |
| slotBetOf | {slot}: {name}'s bet | {slot}: ההימור של {name} |
| namedBlocked | Named it! No bets allowed. | ניחוש מדויק! אין הימורים. |
| guessWas | Guess: {artist} / {title} | הניחוש: {artist} / {title} |
| acceptGuess | We accept it | מקבלים את התשובה |
| outcomeCardToken | +1 card · +1 token | ‎+1 קלף · ‎+1 אסימון |
| outcomeCardOnly | +1 card (tokens full) | ‎+1 קלף (האסימונים מלאים) |
| outcomeLostToken | −1 token: {names} | ‎−1 אסימון: {names} |
| outcomeKeptToken | Correct bet, but {name} bet first | הימור נכון, אבל התור של {name} קדם |
| stolenBy | {name} wins the card! | הקלף עובר ל-{name}! |
| landedIn | Added to {name}'s timeline | נוסף לציר הזמן של {name} |
| cardDiscarded | Nobody got it. The card is out. | אף אחד לא צדק. הקלף יוצא מהמשחק. |
| colPlayer / colCards | Player / Cards | שחקן / קלפים |

---

## 7. Contract changes (`docs/CONTRACTS.md`, needs the lead's approval)

- **§4:**
  - Add the `/api/songs/:id/guess` row.
  - Add `artistAliases` and `titleAliases` to the catalog-only fields.
- **§6:**
  - New rules: tokens, betting, and the winner check over all players.
  - New test ids:
    - Setup: `toggle-tokens-bets`
    - Naming: `btn-name-it`, `input-guess-artist`, `input-guess-title`, `btn-lock-in`
    - Betting: `bet-panel`, `bet-legend`, `btn-place-bet`, `btn-pass-bet`, `btn-end-betting`
    - Tokens: `current-player-tokens`, `token-meter`, `data-tokens` on `score-row`
    - Result: `result-named`, `result-stolen`, `outcome-row`, `btn-accept-guess`, `guess-artist-result`, `guess-title-result`
- **New §8, "Artist/title guess":**
  - Naming is optional and checked once per turn, before Reveal.
  - Before Reveal the screen only says whether bets are open.
  - No guess request is sent unless the player typed something.

---

## 8. Tests

### Server (Vitest)

**New `guess.test.ts`.** These cases use real songs from songs.json:

| Song | Guess | Result |
|---|---|---|
| 101 | artist "beatels" | ✓ |
| 229 | artist "Guns and Roses" | ✓ |
| 84 | title "dont stop believing" | ✓ |
| 9 | title "I Feel Good" | ✓ |
| 9 | title "I Got You" | ✓ |
| 241 | artist "Kis" | ✗ (short names need an exact match) |
| 118 | artist "Earth" | ✗ |
| 387 | artist "Tones" | ✗ |
| 110 | artist "Bruno Mars" | ✓ (from `artistKeys`) |
| 266 | artist "דוד דאור" | ✓ |
| 260 | title "מי שמאמינ" (wrong final letter) | ✓ |
| 349 | title with niqqud | ✓ |
| 4 | artist "דטנר" | ✗ |
| 447 | artist "ליאור נרקיס עם שלומי שבת" | ✓ |
| 64 | title "אני ואתה" | ✗ (that is song 35's title) |
| any | empty guess | ✗, not an error |

Other server tests:
- `app.test.ts`:
  - 200 with exactly the two keys, and no leak of the answer.
  - 404 for an unknown or bad id.
  - 400 for a bad body or a field that is too long.
- `catalog.test.ts`: aliases are checked.
- `songs-data.test.ts`:
  - every song's own artist and title are judged correct;
  - a sample of other songs' artists are judged wrong.

### Web (Vitest)

**`rules.test.ts`**
- Token cap and floor.
- `freeBetSlots`, `canBet` (each condition), `bettingOrder` wrap-around.
- `resolveTurn`, one test per outcome in §6.2, plus:
  - bets checked against the timeline before the card is added;
  - two right bettors;
  - tokens never below 0.
- `anyReachedTarget`.

**`reducer.test.ts`**
- Start tokens; the switch on and off.
- Lock in with and without names.
- Spot locked during betting.
- Each rejected bet.
- Pass and No more bets.
- A bettor reaching the target leads to the Winner screen.
- A song failing during betting.
- Ending the game during betting.
- `ACCEPT_GUESS` undoes a stolen card.

**`persistence.test.ts`**
- A version 2 round trip, including a game in `betting`.
- A version 1 save is migrated.
- A version 99 save is ignored.

**Screens**
- `GameScreen.test.tsx`: each turn path.
- `components.test.tsx`: Timeline markers, `TokenMeter`, Scoreboard with three columns.
- Hebrew `<bdi>` rendering.

**Tests that will break and need updating**
- `GameScreen.test.tsx`: the reveal, correct and wrong placement, next turn, and "See the winner" tests, plus the cover reveal helper. The other player now has a token, so the button reads Lock in.
- `components.test.tsx`: the Scoreboard row now has 3 cells, not 2.
- `App.test.tsx`: the play-again and Resume paths.
- Every test fixture that builds a `Player` without `tokens`. They fail type-checking; add a `player()` helper to `test/fixtures.ts`.

### End to end (Playwright)

**`helpers.ts`**
- `placeAndReveal` gets a `bets` option.
- New helpers: `lockIn`, `placeBet`, `passBet`, `readTokens`.
- The helper mocks `**/api/songs/*/guess`, because the e2e songs are fake.

**`api.spec.ts`**
- An exact guess returns ✓ for both.
- A wrong guess returns ✗ for both.
- The 404 and 400 cases.
- The response has only the two keys.

**New `betting.spec.ts`**
- Tokens start at 1, go up by 1 per card, and stop at 5.
- Naming both correctly, with case and punctuation changes, blocks betting.
- A won bet puts the card in the bettor's timeline.
- Wrong bets lose a token.
- Taken spots cannot be picked.
- The answer stays hidden during betting.
- A reload in the middle of betting resumes the same round.
- "We accept it" returns the bet tokens.
- Hebrew at 360×640 has no sideways scroll.

**Specs that break:** `gameplay.spec.ts` (full game, and the reveal-disabled test), `responsive.spec.ts`, and the specs that use the helper (cover, resume, no-repeat).

**`responsive.spec.ts`:** add screenshots of naming, betting and a won bet.

---

## 9. Steps

Each step is finished with all tests passing before the next one starts.

| # | Step | Main files | Done when |
|---|---|---|---|
| 1 | **Checking names on the server:** shared text cleanup, the matching rules, the `/guess` endpoint, and the empty alias fields | `server/src/text.ts`, `guess.ts`, `app.ts`, `types.ts`, `catalog.ts`, `docs/CONTRACTS.md` §4 and §8 | server tests and `api.spec.ts` pass, including the cases in §8 |
| 2 | **Game rules:** tokens, bets, settling a turn, the winner check for every player, saved-game migration, the on/off switch in the state | `web/src/game/*`, `web/src/api/client.ts` (`checkGuess`), `web/src/test/fixtures.ts` | unit tests pass and the type check is clean |
| 3 | **Screens:** token meter, naming fields, Lock in, betting panel, timeline markers, result rows, scoreboard, winner screen, setup switch, Hebrew and English text | `GameScreen.tsx`, `Timeline.tsx`, `Scoreboard.tsx`, `WinnerScreen.tsx`, `SetupScreen.tsx`, new `TokenMeter`, `NameGuess`, `BetPanel`, `TurnOutcome`, `dictionaries.ts`, `I18nProvider.tsx`, `theme.css`, `index.html` | screen tests pass, and it works by hand at 360×640 in Hebrew and English |
| 4 | **End-to-end tests and docs** | `e2e/tests/*`, `PLAN.md` §1, §6 and §8, `docs/DESIGN.md`, `docs/QA.md`, `docs/CONTRACTS.md` §6 | all Playwright tests pass (phone and desktop) |
| 5 | **Fairness:** the "We accept it" button, and aliases for the best-known Hebrew artists (Latin spelling) and for famous alternative titles | `reducer.ts` (`ACCEPT_GUESS`), result screen, `server/data/songs.json` | its tests pass, and a sample of 20 artists typed in English letters is accepted |

**Risks**
- **Wrong judgements.** Tolerant matching will sometimes accept or reject the wrong answer. The typo limits are kept tight, and "We accept it" (step 5) covers fair answers that get rejected.
- **The answer can be seen in the browser,** as today (§4.1).
- **Longer turns.** Betting adds one or two taps per player. The "No more bets" button and skipping players with 0 tokens keep it short.
- **The song list runs out at the same rate as today.** A won bet uses the same song, not a new one.
