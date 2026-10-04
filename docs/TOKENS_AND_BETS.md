# Tokens, naming and bets: plan

**Status:** step 1 (checking names on the server) is done; steps 2–5 are not started. The owner has answered all rule questions (section 2). This is step 9.6 in [PLAN.md](../PLAN.md).

This plan adds four things to the game:
- every player has **tokens**;
- the current player can also **name the artist and the song title**;
- the other players can **bet a token** on where the song belongs on the current player's timeline, if they can name the artist or the title;
- a player can **skip a song for 3 tokens**.

It was written from four research reports: the game logic, the screens, how to check typed answers, and the official HITSTER token rules.

---

## 1. The new rules, as the app will play them

1. **Tokens.** Every player starts with **1 token**. A player gets **+1 token for every card they win**, up to **5**. A token earned while holding 5 is lost. The starting card gives no token.
2. **Naming (optional).** On their turn, after picking a spot on the timeline, the current player can also type the **artist** and the **song title**. The app checks both without showing the answer. Naming never gives a token.
3. **Bets.** Bets are only allowed if the current player did **not** name both the artist and the title correctly.
   - **First come, first served.** Any other player with at least 1 token may try to bet. Whoever takes the phone first goes first.
   - **To bet, a player must name the artist or the title correctly** (at least one of the two). If they name neither, they cannot bet this turn and lose nothing.
   - A bet costs **1 token** and goes on a spot of the **current player's** timeline. The spot must be different from the current player's spot and from every earlier bet.
   - Each player gets **one try per turn**.
4. **Reveal and outcome.**
   - **Current player placed it right:** they get the card and +1 token. Every bettor on a wrong spot loses their token. A bettor on another spot that is also right (same year) keeps their token.
   - **Current player placed it wrong, and a bettor is on a right spot:** the **earliest** such bettor gets the card. It goes into **their own** timeline, sorted by year. They get their bet token back and +1 token for the card. Wrong bettors lose their token. A later bettor who was also right keeps their token.
   - **Nobody is right:** the card is discarded, and every bettor loses their token. Nothing is taken from anyone's timeline.
   - **The current player named both correctly but placed it wrong:** the card is discarded. No bets were allowed.
5. **Skip a song.** Before locking in, the current player can pay **3 tokens** to skip the song. A new song plays and the turn goes on.
6. **Winner.** The first player to reach the target score wins, as today. A bettor can now reach it on someone else's turn, so the app checks **all** players after each turn.
   - **When the game is ended early,** the most cards wins. If players are tied on cards, **the one with more tokens wins**. If they are still tied, they share the win.

---

## 2. Owner decisions

All 13 questions were answered by the owner on 2026-10-04.

| # | Question | Decision |
|---|---|---|
| D1 | How many tokens for winning a card? | **+1 per card.** A bettor who wins the card also gets back the token they bet. |
| D2 | Does naming give a token? | **No.** For the current player, naming both correctly stops the bets. For a bettor, naming one of the two gives the right to bet. |
| D3 | Does a bettor who wins the card keep the token they bet? | **Yes**, and they also get +1 for the card. |
| D4 | Must a bettor name the artist and title? | **Yes, the artist or the title, to be allowed to bet.** After that, only the spot decides who wins the card. |
| D5 | Can bets share a spot? | **No.** Each bet must be on a different spot from the current player's spot and from every earlier bet. |
| D6 | Two bettors on right spots (possible when two songs share a year). | **First come, first served:** the earlier bet wins the card. The other bettor keeps their token. |
| D7 | The current player is right, and a bettor is on another spot that is also right. | The current player gets the card. The bettor keeps their token. |
| D8 | "Lose the token and the card." | A wrong bettor loses the token and does not get the card. Nothing is taken from their timeline. |
| D9 | The current player names both correctly but places the card wrong. | The card is discarded, and no bets are allowed. |
| D10 | Who decides whether a name is correct? | **The app**, with tolerant matching. After Reveal, the players can tap **"We accept it"** for the current player's names (§4.4). |
| D11 | Can tokens and bets be turned off? | **Yes**, with a switch in Setup. It is on by default. |
| D12 | Other token uses. | **Skip a song for 3 tokens.** There is no buying cards with tokens. |
| D13 | Game ended early, tied on cards. | **Tokens decide.** If tokens are tied too, the win is shared. |

**Compared with the official HITSTER rules:**
- **Starting tokens:** the official game starts with 2 tokens, not 1.
- **How tokens are earned:** officially, by naming the song. Here, by winning a card.
- **Who may challenge:** officially, anyone, even when the current player named the song. Here, a player who names the artist or the title, and only when the current player did not name both.
- **Skipping a song:** costs 1 token officially, 3 tokens here.
- **Buying a card:** the official game sells a card for 3 tokens. Here, tokens cannot buy cards.

---

## 3. How a turn works on one phone

The game is still played on one shared phone. The steps marked **new** are added.

1. **Play.** The clip plays, and the card stays hidden. *(as today)*
2. **Pick a spot** on your timeline. *(as today)*
3. **Skip (new, optional).** With 3 or more tokens, a small **"Skip song · 3"** button sits next to Replay. Tapping it asks "Skip this song for 3 tokens?" first.
   - After a skip, a new song plays and the chosen spot is cleared.
   - A skip is only possible before Lock in.
4. **Name it (new, optional).** A small button, **"Name artist + title"**, opens two text fields.
   - Skipping it costs no taps.
   - The button only shows when someone could bet, that is, when another player has a token.
5. **Lock in (new).** This replaces **Reveal** whenever someone could bet.
   - The app checks the names.
   - **If both are right, or nobody can bet,** the card is revealed straight away. If both were right, a note says "Named it! No bets allowed".
   - **Otherwise** the screen says **"Bets are open!"**. It never says which name was wrong.
6. **Betting round (new), first come, first served.**
   1. **Who's betting?** The screen shows the current player's timeline and a button for each player who may still try. That means at least 1 token, no try yet this turn, and a free spot left.
      - Whoever grabs the phone first taps their own name.
      - Players with 0 tokens, or who already tried, are shown greyed out with the reason.
   2. **Name it.** The bettor types the artist, the title, or both, and taps **Check**.
      - The app answers only **"You can bet!"** or **"Not this time"**. It never says which part was right.
      - The fields are cleared after Check, so the next player cannot read them.
   3. **Bet.** If allowed, the bettor picks a free spot and taps **"Bet 1 token"**.
      - Taken spots show the player's initial: pink for the current player's pick, gold for a bet.
      - **Cancel** backs out at no cost, but that player's try is used.
   4. **Next.** The screen goes back to "Who's betting?".
   5. **End of the round.** It ends when someone taps **Reveal**, when nobody is left who may try, or when no free spot is left.
7. **Reveal.** The results are shown on the result screen. *(see §6)*
8. **Next.** If any player reached the target, the Winner screen comes next.

**Taps per turn:**
- **Nobody bets:** Play, spot, Lock in, Reveal, Next. That is 5 taps; today it takes 4.
- **Nobody can bet:** stays at 4.
- **Each bettor:** name, Check, spot, Bet (4 taps), plus typing.

---

## 4. Checking the artist and title

### 4.1 Where the check runs: a new server endpoint

```
POST /api/songs/:id/guess   { "artist"?: string, "title"?: string }
→ 200 { "artistCorrect": boolean, "titleCorrect": boolean }
→ 404 SONG_NOT_FOUND   → 400 INVALID_REQUEST (body is not an object, a field is not a string, or a field is longer than 200 characters)
```

- **Two kinds of check use the same endpoint:**
  - **The current player:** both parts must be right to stop the bets.
  - **A bettor:** one right part is enough to bet.
- **The answer never appears in the response:** no artist, title, year or "did you mean".
- **It is stateless,** like `/preview` and `/cover`: the song is looked up by its id.
- **A missing or empty field counts as wrong** for that field. It is not an error.
- **A request is sent only when someone types a name and taps Lock in or Check.** If it fails, the screen shows an error with *Try again*.
  - **The current player** can also *Continue without naming*, and then bets are open.
  - **A bettor** can *Cancel*, and then their try is not used up.
- **Before Reveal, the screen says only:**
  - "no bets" or "bets open", for the current player;
  - "You can bet!" or "Not this time", for a bettor.

  Which part was right (✓/✗ for artist and title) is shown after Reveal, and only for the current player.

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

- **Another song's exact name is not a typo.** A guess that is exactly another artist or title in the catalog is never accepted as a typo of this song's name. Typing "Believe" means Cher's song, not a slip for "Believer". Checking every pair of songs in the catalog found three such near-misses, and this rule removes all of them.

**Title is correct** if the guess matches any one of:
- the full title;
- the title without the part in brackets;
- the text inside the brackets on its own, if it has at least three words ("I Feel Good" yes; "(Tell Me)" or "(I Just)" no);
- the title without a trailing `, Part 2`;
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
  - **Known gap:** four solo artists appear in the catalog only inside a duet, under a one-word name: סטטיק, סאבלימינל, אודיה and P!nk. Guessing that name alone is rejected until step 5 adds them as `artistKeys` or aliases.

**Do not reuse `artistMatches` as it is.** It accepts "and the" for *Kool & the Gang*, and it accepts made-up featured artists.

### 4.3 Aliases: other accepted names

Add two optional fields to the catalog-only part of each song. `toPublicSong` already leaves them out of what the browser receives.
- `artistAliases: string[]`: Latin spellings of Hebrew names ("Eyal Golan"), and short forms ("Pink").
- `titleAliases: string[]`: other known titles ("Nothing Compares to You").

songs.json has no aliases today. Typing a Hebrew artist in English letters will fail until they are added (step 5). Converting Latin letters to Hebrew automatically was looked at and dropped: it gets short names wrong.

### 4.4 "We accept it"

Fuzzy matching will sometimes reject a fair answer.

**For the current player:**
- **When the button shows:** on the result screen, only when the names were judged not both correct.
- **What it does:** the group taps **"We accept it"**, and the turn is settled again as if no bets had been placed:
  - the bet tokens go back;
  - a card won by a bettor is taken back out of their timeline.
- **Only in one direction.** A name that was accepted cannot be turned into a wrong one after Reveal, because the bets can no longer be placed fairly.

**For a bettor:** a rejected name cannot be overruled. The check happens before Reveal, and after Reveal it is too late to bet. Two things soften this:
- a bettor needs only one of the two parts;
- the aliases in step 5 add English spellings of Hebrew artists.

---

## 5. Game logic (`web/src/game/`)

### 5.1 Types

```ts
export const START_TOKENS = 1;
export const MAX_TOKENS = 5;
export const SKIP_COST = 3;

export interface Player { name: string; timeline: Song[]; tokens: number }
export type Phase = 'setup' | 'dealing' | 'turn' | 'betting' | 'result' | 'winner';

export interface NameGuess { artist: string; title: string; artistCorrect: boolean; titleCorrect: boolean }
/** A bet on a slot of the CURRENT player's timeline. `bets` keeps them in the order they were placed. */
export interface Bet { playerIndex: number; slotIndex: number }
export type BetOutcome = 'won' | 'right' | 'lost' | 'refunded';
/** The player holding the phone during the betting round. */
export interface ActiveBettor { playerIndex: number; allowed: boolean | null }  // null = names not checked yet

export interface TurnResult {
  song: Song; slotIndex: number; correct: boolean;
  guess?: NameGuess | null;
  bets?: (Bet & { outcome: BetOutcome })[];
  cardWinnerIndex?: number | null;
  accepted?: boolean;               // "We accept it" was tapped
  playersBefore?: Player[];         // used to settle the turn again after "We accept it"
}
// GameState gets: tokensAndBets: boolean; guess: NameGuess | null; bets: Bet[];
//                 triedThisTurn: number[]; activeBettor: ActiveBettor | null
```

- `turn` still covers playing, skipping, picking the spot and typing the names.
- `betting` is the new step between Lock in and Reveal.
- The new `TurnResult` fields are optional, so results saved by the current version still show.

### 5.2 Actions (`reducer.ts`)

| Action | What it does |
|---|---|
| `START_GAME { names, targetScore, tokensAndBets }` | Every player starts with `START_TOKENS`. `DEAL_CARD` gives no token. |
| `SKIP_SONG` | Only in `turn`, with the switch on and at least `SKIP_COST` tokens. Takes 3 tokens, marks the song as used, and clears the song and the spot, so `GameProvider` fetches a new one. |
| `GUESS_JUDGED { guess }` | The current player's check. Only in `turn`, with a song and a spot chosen. Stores the guess, then either reveals at once (`resolveTurn`) or moves to `betting`. In `betting`, `SELECT_SLOT` and `SKIP_SONG` are ignored. |
| `LOCK_IN` | The same as `GUESS_JUDGED` with no names typed. |
| `BETTOR_START { playerIndex }` | Only in `betting`, with no active bettor, and if `canTryToBet` is true. Sets `activeBettor`. |
| `BETTOR_JUDGED { artistCorrect, titleCorrect }` | Sets `allowed` to `artistCorrect \|\| titleCorrect` and adds the player to `triedThisTurn`. The typed text is not stored. |
| `PLACE_BET { slotIndex }` | Only for an allowed active bettor, on a free spot. Adds the bet at the end of `bets` (so the order is the order of play) and clears `activeBettor`. |
| `BETTOR_DONE` | Clears `activeBettor`: after "Not this time", or on Cancel. The try stays used. |
| `REVEAL` | From `turn` when nobody can bet (as today), or from `betting` when no bettor is active. Calls `resolveTurn`. |
| `ACCEPT_GUESS` | Only in `result`. Settles the turn again from `playersBefore`, with the bets cancelled. |
| `SONG_FAILED` | Now also accepted in `betting`. Goes back to `turn` with the guess, bets and tries cleared. No tokens change, because tokens only move when the turn is settled. |
| `NEXT` | Checks **every** player for the target score (today it checks only the current player, `reducer.ts:133`). Clears the guess, bets and tries. |
| `END_GAME` | From `betting` it just drops the bets. The winner is chosen with `rankPlayers`. |

### 5.3 Pure rule functions (`rules.ts`, or a new `tokens.ts`)

```ts
awardToken(t: number): number            // Math.min(MAX_TOKENS, t + 1)
spendToken(t: number, n = 1): number     // Math.max(0, t - n)
namesCorrect(g: NameGuess | null): boolean      // both right: no bets
earnsBet(artistCorrect: boolean, titleCorrect: boolean): boolean   // either right: may bet
freeBetSlots(timelineLength: number, pickedSlot: number, bets: readonly Bet[]): number[]
canTryToBet(state: GameState, playerIndex: number): boolean   // switch on, bets open, not the current player, tokens >= 1, not tried yet, a free spot exists
anyoneCanBet(state: GameState): boolean
canSkip(state: GameState): boolean       // switch on, phase turn, tokens >= SKIP_COST
resolveTurn(input): { players: Player[]; result: TurnResult }
anyReachedTarget(players: readonly Player[], target: number): boolean
rankPlayers(players: readonly Player[]): Player[][]  // by cards, then tokens; equal players share a rank
```

**How `resolveTurn` settles a turn:**
1. Every spot is checked against the current player's timeline **before** the new card is added: the current player's spot and each bet.
2. The card goes to the current player if their spot is right. If not, it goes to the **earliest bet** (by order of play) whose spot is right. If nobody is right, it goes to nobody.
3. The card winner gets the card inserted in their own timeline with `insertCard`, sorted by year (not at the spot they bet on), and `awardToken`. A winning bettor's bet token is not taken.
4. A bettor on a wrong spot gets `spendToken`. A bettor on a right spot who did not get the card keeps their token (outcome `right`).

**Winner when the game is ended early:** `findWinners` (`rules.ts:71`) uses `rankPlayers`: the most cards, then the most tokens. Players equal on both share the win. The Winner screen ranks the timelines the same way.

### 5.4 Saved games

- `persistence.ts` goes to `VERSION = 2`, and `betting` is added to `RESUMABLE`.
- A version 1 save is **migrated**, not thrown away. It gets:
  - `tokens: 1` for every player;
  - `tokensAndBets: false`;
  - `guess: null`, `bets: []`, `triedThisTurn: []` and `activeBettor: null`.

  An old game therefore finishes under the old rules.
- `looksLikeState` also checks `tokens`, `bets`, `triedThisTurn` and `tokensAndBets`.
- A save from an unknown version is still ignored.
- A game reloaded in the middle of the betting round resumes with the same bets and tries. An active bettor whose names were not checked yet goes back to "Who's betting?", and their try is not used.

---

## 6. Screens

**Mockups:** the [UI design canvas](https://claude.ai/artifact/4FzDZZfJcLzt3MD3NQ8Ujz) has 12 phone screens: the turn flow, every result, the scoreboard, setup, a Hebrew (RTL) betting screen and a sheet of the new parts. It is private to the owner until shared. It shows the first-come, first-served betting round (who's betting, a bettor names the song, pick a spot, all bets in), "Not this time", and the skip button with its confirmation.

**Design decisions (approved by the owner):**
- **The bet button is gold, not pink.** "Bet 1 token" uses the token gold (`--color-token`) with dark text and a token icon, so spending a token looks different from the main pink action. Every other main action (Lock in, Check, Reveal, Next player) stays pink.
- **Taken spots show the player's initial.** During betting, a taken spot shows a disc with the player's initial: pink for the current player's pick, gold for a bet. Full names would not fit on small phones. If two players share an initial, the disc shows two letters. A legend under the timeline gives the full names.

### 6.1 Showing tokens
- **Token icon.** A small gold disc with a "♪" and a glow, in a new colour token `--color-token: #ffd166`.
- **Token meter.** Shows 5 pips, filled for each token held. Screen readers hear "3 of 5 tokens". With 5 tokens it shows "Max".
- **Where tokens appear:**

  | Place | What is shown |
  |---|---|
  | Turn header | ◉ 3, next to the card count |
  | "Who's betting?" list | a meter beside each name |
  | Scoreboard | a new Tokens column (Player / Tokens / Cards) |
  | Winner screen | a meter beside each score |

### 6.2 Turn screen: skip
- **The button.** "Skip song · 3", with the token icon, as a small outline button next to Replay. It shows only when the current player has 3 or more tokens and the switch is on.
- **The confirmation.** A sheet asks "Skip this song for 3 tokens?", with **Skip** and **Keep listening**.

### 6.3 Betting screens
1. **Who's betting?**
   - A gold panel says "Bets are open!" and "Think Ann is wrong? Grab the phone and tap your name."
   - Below it, the current player's timeline with the taken spots marked.
   - Then a list of player buttons, each with a token meter. Players who cannot try are greyed out, with the reason: "no tokens" or "tried".
   - Footer: **Reveal**.
2. **Name it.**
   - The heading says "Bob, name the artist or the title", with two fields.
   - Footer: **Cancel** and **Check**.
3. **The answer.**
   - **Allowed:** "You can bet!". The timeline's free spots light up. Footer: **Cancel** and **Bet 1 token** (gold).
   - **Not allowed:** "Not this time. Pass the phone on." with **OK**.

### 6.4 Result screen
The current line, "Correct!" or "Wrong, it was 2003", stays. Below it, up to 3 short rows describe what happened:

| What happened | What is shown |
|---|---|
| Right, named both | "Named it! No bets allowed." · Ann: +1 card · +1 token |
| Right, with bets | Ann: +1 card · +1 token · "−1 token: Bob, Carol" |
| Wrong, a bettor right | "Bob wins the card!" · Bob: +1 card · +1 token · "−1 token: Carol" |
| Two bettors right | as above, plus "Correct bet, but Bob bet first" for the later bettor (who keeps their token) |
| Wrong, nobody right | "Nobody got it. The card is out." · "−1 token: …" |
| Token cap | "+1 card (tokens full)" |

- **The current player's typed names** are shown after Reveal, with ✓/✗ for each. Bettors' names are not shown.
- **"We accept it"** shows when the current player's names were rejected (see §4.4).
- **When a bettor wins the card,** the timeline on the result screen switches to the bettor's timeline, shows "Added to Bob's timeline", and the new card gets a gold outline.

### 6.5 Setup and Winner
- **Setup.** A **"Tokens & bets"** switch, on by default and remembered on the phone. The text under it explains the rules in one line (`tokenRule`). In a 1-player game the switch has no effect.
- **Winner.** When the game was ended early and tokens broke a tie on cards, a line under the title says so (`wonOnTokens`).

### 6.6 Phones, Hebrew and accessibility

**Text fields**
- `dir="auto"`, so Hebrew and English both type correctly.
- 16px font, so iPhone does not zoom in.
- Autocorrect, autocomplete and spellcheck are off.
- Visible labels.
- No list of suggestions, because it would give away the answer.
- A bettor's fields are cleared after Check.

**Keyboard**
- The fields sit below the timeline, so the spot is picked before the keyboard opens.
- `interactive-widget=resizes-content` is added to the viewport tag in `web/index.html`, so the footer stays above the Android keyboard.

**Small phones (360×640)**
- During betting, the speaker area shrinks.
- The "Who's betting?" list scrolls inside its box when there are many players.
- The losers are grouped into one row.
- Names that are too long are cut with "…".
- The page never scrolls sideways; only the timeline scrolls.

**Names inside text**
- A new `tNode()` helper places player names inside `<bdi>`, so English names in Hebrew sentences (and the other way round) show in the right order.
- "+1" and "−1" are wrapped in `dir="ltr"`.

**Accessibility**
- Taken spots use `aria-disabled`, so screen readers still reach them.
- The change of bettor and the "You can bet!" / "Not this time" answer are announced with `aria-live`.
- All buttons are at least 44px.

### 6.7 New text (English | Hebrew)

| Key | English | עברית |
|---|---|---|
| tokens | Tokens | אסימונים |
| tokensCount | {count} of {max} tokens | {count} מתוך {max} אסימונים |
| tokensMax | Max | מקסימום |
| tokensAndBets | Tokens & bets | אסימונים והימורים |
| tokenRule | Start with 1 token, +1 for every card (max {max}). Skip a song for 3 tokens. | מתחילים עם אסימון אחד, ועוד אחד על כל קלף (עד {max}). דילוג על שיר עולה 3 אסימונים. |
| skipSong | Skip song | דילוג על השיר |
| skipConfirm | Skip this song for 3 tokens? | לדלג על השיר תמורת 3 אסימונים? |
| skipYes | Skip | לדלג |
| keepListening | Keep listening | להמשיך להאזין |
| nameItToggle | Name artist + title | לנחש מבצע ושם שיר |
| nameItLegend | Name both to block bets (optional) | ניחוש של שניהם חוסם הימורים (לא חובה) |
| guessArtist | Artist | מבצע |
| guessArtistPlaceholder | Who sings it? | מי שר? |
| guessTitle | Song title | שם השיר |
| guessTitlePlaceholder | What's it called? | איך קוראים לשיר? |
| lockIn | Lock in | נועלים תשובה |
| pickSlotFirst | Pick a spot on the timeline first | קודם בוחרים מקום בציר הזמן |
| guessFailed | Couldn't check the names. | לא הצלחנו לבדוק את הניחוש. |
| tryAgain | Try again | לנסות שוב |
| continueWithoutNaming | Continue without naming | להמשיך בלי ניחוש |
| bettingOpen | Bets are open! | ההימורים פתוחים! |
| betHint | Think {player} is wrong? Grab the phone and tap your name. | חושבים ש-{player} טועה? קחו את הטלפון והקישו על השם שלכם. |
| betNeedsName | To bet, name the artist or the title. | כדי להמר צריך לנחש את המבצע או את שם השיר. |
| bettorNameIt | {name}, name the artist or the title | {name}, נחשו את המבצע או את שם השיר |
| checkGuess | Check | בדיקה |
| canBet | You can bet! | אפשר להמר! |
| cannotBet | Not this time. Pass the phone on. | לא הפעם. העבירו את הטלפון הלאה. |
| ok | OK | אישור |
| cancel | Cancel | ביטול |
| placeBet | Bet 1 token | להמר באסימון |
| reasonNoTokens | no tokens | אין אסימונים |
| reasonTried | tried | ניסיון נוצל |
| noFreeSlots | No free spots left | לא נשארו מקומות פנויים |
| slotPickOf | {slot}: {name}'s pick | {slot}: הבחירה של {name} |
| slotBetOf | {slot}: {name}'s bet | {slot}: ההימור של {name} |
| namedBlocked | Named it! No bets allowed. | ניחוש מדויק! אין הימורים. |
| guessWas | Guess: {artist} / {title} | הניחוש: {artist} / {title} |
| acceptGuess | We accept it | מקבלים את התשובה |
| outcomeCardToken | +1 card · +1 token | ‎+1 קלף · ‎+1 אסימון |
| outcomeCardOnly | +1 card (tokens full) | ‎+1 קלף (האסימונים מלאים) |
| outcomeLostToken | −1 token: {names} | ‎−1 אסימון: {names} |
| outcomeKeptToken | Correct bet, but {name} bet first | הימור נכון, אבל {name} הקדימו |
| stolenBy | {name} wins the card! | הקלף עובר ל-{name}! |
| landedIn | Added to {name}'s timeline | נוסף לציר הזמן של {name} |
| cardDiscarded | Nobody got it. The card is out. | אף אחד לא צדק. הקלף יוצא מהמשחק. |
| wonOnTokens | Tied on cards; more tokens wins. | שוויון בקלפים, האסימונים הכריעו. |
| colPlayer / colCards | Player / Cards | שחקן / קלפים |

---

## 7. Contract changes (`docs/CONTRACTS.md`, needs the lead's approval)

- **§4:**
  - Add the `/api/songs/:id/guess` row.
  - Add `artistAliases` and `titleAliases` to the catalog-only fields.
- **§6:**
  - New rules: tokens, betting, skipping, the winner check over all players, and the token tie-break when the game is ended early.
  - New test ids:
    - Setup: `toggle-tokens-bets`
    - Skip: `btn-skip-song`, `btn-confirm-skip`
    - Naming: `btn-name-it`, `input-guess-artist`, `input-guess-title`, `btn-lock-in`
    - Betting: `bet-panel`, `bet-legend`, `btn-bettor` (with `data-player`), `btn-check-guess`, `bet-allowed`, `bet-denied`, `btn-place-bet`, `btn-cancel-bet`
    - Tokens: `current-player-tokens`, `token-meter`, `data-tokens` on `score-row`
    - Result: `result-named`, `result-stolen`, `outcome-row`, `btn-accept-guess`, `guess-artist-result`, `guess-title-result`
- **New §8, "Artist/title guess":**
  - Naming is optional for the current player and needed for a bettor.
  - Each player is checked at most once per turn, before Reveal.
  - Before Reveal the screen only says whether bets are open, or whether that bettor may bet.
  - No guess request is sent unless someone typed something.

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
| 134 | title "Believe" | ✗ (that is song 181's title) |
| 526 | artist "שלומי שבת" | ✗ (a different singer from שלומי שבן) |
| any | empty guess | ✗, not an error |

Other server tests:
- `app.test.ts`:
  - 200 with exactly the two keys, and no leak of the answer.
  - 404 for an unknown or bad id.
  - 400 for a bad body or a field that is too long.
- `catalog.test.ts`: aliases are checked.
- `songs-data.test.ts`:
  - every song's own artist and title are judged correct;
  - a sample of other songs' artists and titles are judged wrong.

### Web (Vitest)

**`rules.test.ts`**
- Token cap and floor; `spendToken` by 3.
- `namesCorrect` needs both; `earnsBet` needs one.
- `freeBetSlots` and `canTryToBet`, one test for each condition.
- `canSkip`.
- `resolveTurn`, one test per outcome in §6.4, plus:
  - bets checked against the timeline before the card is added;
  - two right bettors, where the earlier bet wins;
  - a winning bettor keeps the bet token and gets +1;
  - tokens never below 0.
- `anyReachedTarget`.
- `rankPlayers`: cards first, then tokens, then a shared rank.

**`reducer.test.ts`**
- Start tokens; the switch on and off.
- `SKIP_SONG`:
  - takes 3 tokens and marks the song as used;
  - is refused with 2 tokens, in `betting`, or with the switch off.
- Lock in with and without names.
- Spot locked during betting.
- Bettor flow:
  - any eligible player can start, in any order;
  - names checked: allowed with one right part, denied with none;
  - a denied or cancelled bettor cannot start again this turn;
  - a bet on a taken spot is refused.
- A bettor reaching the target leads to the Winner screen.
- A song failing during betting.
- Ending the game during betting.
- Ending early with a tie on cards: tokens decide.
- `ACCEPT_GUESS` undoes a stolen card.

**`persistence.test.ts`**
- A version 2 round trip, including a game in `betting` with an active bettor.
- A version 1 save is migrated.
- A version 99 save is ignored.

**Screens**
- `GameScreen.test.tsx`: each turn path, including the skip with its confirmation, and each betting screen.
- `components.test.tsx`: Timeline markers, `TokenMeter`, Scoreboard with three columns.
- `WinnerScreen`: the `wonOnTokens` line.
- Hebrew `<bdi>` rendering.

**Tests that will break and need updating**
- `GameScreen.test.tsx`: the reveal, correct and wrong placement, next turn, and "See the winner" tests, plus the cover reveal helper. The other player now has a token, so the button reads Lock in.
- `components.test.tsx`: the Scoreboard row now has 3 cells, not 2.
- `App.test.tsx`: the play-again and Resume paths.
- Every test fixture that builds a `Player` without `tokens`. They fail type-checking; add a `player()` helper to `test/fixtures.ts`.

### End to end (Playwright)

**`helpers.ts`**
- `placeAndReveal` gets a `bets` option.
- New helpers: `lockIn`, `startBettor`, `checkBettorName`, `placeBet`, `skipSong`, `readTokens`.
- The helper mocks `**/api/songs/*/guess`, because the e2e songs are fake.

**`api.spec.ts`**
- An exact guess returns ✓ for both.
- A wrong guess returns ✗ for both.
- The 404 and 400 cases.
- The response has only the two keys.

**New `betting.spec.ts`**
- Tokens start at 1, go up by 1 per card, and stop at 5.
- Naming both correctly, with case and punctuation changes, blocks betting.
- A bettor who names only the artist may bet; one who names neither may not and keeps their token.
- Bettors can go in any order, and the earlier right bet wins the card.
- A won bet puts the card in the bettor's timeline, and the bettor ends with +1 token.
- Wrong bets lose a token.
- Taken spots cannot be picked.
- The answer stays hidden during betting, and a bettor's fields are empty for the next bettor.
- Skipping a song costs 3 tokens and plays a new song.
- A reload in the middle of betting resumes the same round.
- "We accept it" returns the bet tokens.
- Hebrew at 360×640 has no sideways scroll.

**Specs that break:** `gameplay.spec.ts` (full game, and the reveal-disabled test), `responsive.spec.ts`, and the specs that use the helper (cover, resume, no-repeat).

**`responsive.spec.ts`:** add screenshots of naming, "Who's betting?", a bettor's naming, a won bet and the skip confirmation.

---

## 9. Steps

Each step is finished with all tests passing before the next one starts.

| # | Step | Main files | Done when |
|---|---|---|---|
| 1 ✅ | **Checking names on the server:** shared text cleanup, the matching rules, the `/guess` endpoint, and the empty alias fields | `server/src/text.ts`, `guess.ts`, `app.ts`, `types.ts`, `catalog.ts`, `docs/CONTRACTS.md` §4 and §8 | server tests and `api.spec.ts` pass, including the cases in §8 |
| 2 | **Game rules:** tokens, skipping, the bettor flow, settling a turn, the winner check for every player, the token tie-break, saved-game migration, the on/off switch in the state | `web/src/game/*`, `web/src/api/client.ts` (`checkGuess`), `web/src/test/fixtures.ts` | unit tests pass and the type check is clean |
| 3 | **Screens:** token meter, skip button and confirmation, naming fields, Lock in, the three betting screens, timeline markers, result rows, scoreboard, winner screen, setup switch, Hebrew and English text. The mockup canvas is updated first. | `GameScreen.tsx`, `Timeline.tsx`, `Scoreboard.tsx`, `WinnerScreen.tsx`, `SetupScreen.tsx`, new `TokenMeter`, `NameGuess`, `BetPanel`, `TurnOutcome`, `SkipSong`, `dictionaries.ts`, `I18nProvider.tsx`, `theme.css`, `index.html` | screen tests pass, and it works by hand at 360×640 in Hebrew and English |
| 4 | **End-to-end tests and docs** | `e2e/tests/*`, `PLAN.md` §1, §6 and §8, `docs/DESIGN.md`, `docs/QA.md`, `docs/CONTRACTS.md` §6 | all Playwright tests pass (phone and desktop) |
| 5 | **Fairness:** the "We accept it" button, and aliases for the best-known Hebrew artists (Latin spelling) and for famous alternative titles | `reducer.ts` (`ACCEPT_GUESS`), result screen, `server/data/songs.json` | its tests pass, and a sample of 20 artists typed in English letters is accepted |

**Risks**
- **Wrong judgements.** Tolerant matching will sometimes accept or reject the wrong answer.
  - The typo limits are kept tight.
  - "We accept it" covers the current player's fair answers that get rejected.
  - A rejected bettor cannot be overruled (§4.4).
- **The answer can be seen in the browser,** as today (§4.1).
- **Bettors hear each other.** On one phone, a later bettor may hear or see an earlier bettor's guess. The fields are cleared after Check, but players talking out loud is part of a party game.
- **Longer turns.** Each bettor now types a name. Players who don't want to bet simply don't tap their name, and Reveal ends the round at any time.
- **The song list runs out faster with skips.** Each skip uses a song. Step 9.1 (more songs) helps.
