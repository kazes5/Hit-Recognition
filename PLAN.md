# Hitster — Song Timeline Game: Plan

A party game for one shared phone (web app), based on the Hitster board game. The app plays 30 seconds of a well-known song. The current player places it on their timeline of songs, then reveals the artist, year and title to see whether they placed it correctly.

---

## 1. How the game works

1. **Setup:** enter the player names (1–10 players, 2 or more recommended) and choose the target score (default: 10 cards).
2. **Starting card:** each player gets one random song card, already revealed. It starts their timeline.
3. **A turn:**
   1. The app plays a 30-second clip of a new random song. Artist, year and title stay hidden.
   2. The player picks the slot on their timeline where the song belongs (before, between or after their cards).
   3. The player taps **Reveal** to show the artist, year and title on the card.
   4. **Correct placement:** the card is added to the player's timeline. **Wrong placement:** the card is discarded.
   5. Play passes to the next player.
4. **Score:** the number of cards on a player's timeline.
5. **Winner:** the first player to reach the target score. Players can also end the game early, and the most cards wins.

**Tokens, naming and bets** (a "Tokens & bets" switch in Setup, on by default; full rules in [docs/TOKENS_AND_BETS.md](docs/TOKENS_AND_BETS.md)):
- **Tokens:** every player starts with 1 token, up to 5. A player earns +1 only on their own turn, for a right spot **and** a right artist or title. A card alone gives no token.
- **Naming:** after picking a spot, the current player can type the artist and the title, then taps **Lock in** (or **Reveal** when nobody can bet). If both are right, the card is revealed at once and nobody can bet.
- **Betting:** otherwise the other players may bet, first come, first served. A bettor must first correctly name a part the current player did not get right (the artist or the title when both are open). A bet costs 1 token and goes on a free spot of the current player's timeline. Each player gets one try per turn.
- **Outcome:** the current player right: they get the card, and +1 token if they named the artist or the title right. The current player wrong: no token for them; the earliest right bet wins the card into the bettor's own timeline, with the bet token back. Wrong bets lose their token. After Reveal, "We accept it" can accept the current player's rejected names and cancel the bets.
- **Skip:** before Lock in, a player can pay 3 tokens to skip the song and get a new one.
- **Winner:** every player is checked after each turn, because a bettor can reach the target on someone else's turn. When the game is ended early and players are tied on cards, more tokens wins.

**Rules for picking songs**
- A song is never played twice in the same game.
- At most 2 songs by the same artist in one game. The app first picks artists not seen yet, then artists seen once. A 3rd song by the same artist comes only when nothing else is left.
- Songs with the same year as a card already on the timeline count as correct on either side of it.

---

## 2. The song card

The card copies the physical card, with these elements:

| Position | Content |
|---|---|
| Top | Artist (e.g. *James Brown* / *אייל גולן*) |
| Center, large | Release year (e.g. **1965**) |
| Bottom, italic | Song title (e.g. *I Got You (I Feel Good)* / *מי שמאמין*) |
| Bottom left / right, small | Deck code (`IL01`) / card number (`227`) |

- The card color depends on the decade: soft gradients of blue, mint, pink and so on.
- **Hidden state:** the card is dark, shows a neon "?" and a playing/equalizer animation, and has no text.
- Hebrew text is shown right-to-left and English text left-to-right, on the same card.

---

## 3. Visual design (based on the box cover)

- **Background:** near-black (`#1a1d1f`) with a slight texture.
- **Neon accents:** hot pink (`#ff2fb3`) for the logo and headings, cyan (`#7fd8ff`) for outlined buttons and frames, with a glow effect.
- **Logo:** "HITSTER / היטסטר" in a thin neon outline font.
- **Play screen:** a large speaker graphic in the center that pulses while the clip plays.
- **Timeline:** horizontal and scrollable, with cards sorted by year. Empty slots between cards light up in cyan so the player can choose where the song goes.
- **Language:** Hebrew (RTL) and English, switchable in Settings.

---

## 4. Music source

| Option | What it needs | Notes |
|---|---|---|
| **Apple Music previews (MVP)** | Nothing: free iTunes Search API | Official 30-second previews, including Israeli songs. No login needed. |
| **Spotify** | User login (OAuth) + **Premium** account | Spotify's SDK plays the full track. The app starts at a random point and stops after 30 seconds. Spotify no longer gives new apps 30-second preview links, so Premium is required. |
| **Apple Music (full)** | MusicKit + Apple Music subscription | Same approach as Spotify: play the track, stop after 30 seconds. |

The app uses the free Apple previews. Connecting Spotify or Apple Music (milestone 8) was **dropped by the owner on 2026-10-05**; the rows above are kept as background.

**Song list:** the app uses its own curated list (`songs.json`) instead of release dates from Spotify or Apple. Their dates often belong to remasters or compilations, which would put songs in the wrong year.

```json
{ "id": 227, "artist": "James Brown", "title": "I Got You (I Feel Good)",
  "year": 1965, "language": "en", "genre": "pop" }
```

- **Today:** 667 songs (267 Hebrew, 400 English), from the 1950s to the 2020s (see section 9.1).
- Genres: pop, classic and light rock.
- Automatic tests check the list: no duplicate ids or songs, at most 10 songs per artist, and enough songs in each decade.
- Still to do: a script that checks every song has a working preview. It needs internet access to Apple, so it has to run outside this sandbox.

---

## 5. Tech stack

The app is a mobile-first web app hosted on Railway, opened in any phone browser.

- **Frontend (`web/`):** React + Vite (TypeScript). The game logic lives here as pure functions with unit tests.
- **Backend (`server/`):** Node + Express (TypeScript). It serves the song list, picks the next song without repeats, finds 30-second previews through the iTunes Search API (cached), and serves the built frontend.
- **Container:** one Docker image that runs the backend and serves the frontend.
- **Hosting:** Railway, deployed from the Dockerfile, with a health check on `/api/health`.
- **Tests:** unit tests with Vitest in `server/` and `web/`, and end-to-end tests with Playwright in `e2e/`.
- **Storage:** an unfinished game is saved in the browser so it can be resumed.

The interfaces between the parts are defined in [docs/CONTRACTS.md](docs/CONTRACTS.md).

## 6. Screens

1. **Home:** logo, *New Game*, *Settings*.
2. **Players:** add or remove names, choose the target score, and the "Tokens & bets" switch.
3. **Turn:** player name with card count and tokens, hidden card with the playing speaker, replay button (and "Skip · 3" with 3+ tokens), the player's timeline with slots to choose from, an optional "Name artist + title", and the **Reveal** button (**Lock in** when someone could bet).
4. **Betting** (after Lock in): "Bets are open!" with the current player's timeline (taken spots marked with initials: pink for the pick, gold for bets) and a "Who's betting?" list. A bettor taps their name, names the song, and gets "You can bet!" (pick a spot, "Bet 1 token") or "Not this time". *Reveal* ends the round.
5. **Result:** the revealed card plus ✅ "Correct!" or ❌ "Wrong, it was 2003", then *Next player*. With tokens on: who won the card and what each player won or lost, the current player's names with ✓/✗, and "We accept it".
6. **Scoreboard:** card counts and tokens for all players (available at any time).
7. **Winner:** the final timelines (with tokens) and a *Play again* button.
8. **Settings:** language, song languages (Hebrew / English / both).

---

## 7. Milestones and progress

| # | Milestone | Status |
|---|---|---|
| 1 | **Setup:** web + server projects, theme (colors and fonts), Hebrew/English text, RTL support | ✅ Done |
| 2 | **Song list:** 667 songs with years checked, at most 10 songs per artist | ✅ Done (section 9.1) |
| 3 | **Game logic:** players, turns, song picking without repeats, placement check, score, winner, with tests | ✅ Done |
| 4 | **UI:** all screens in section 6, the card, the timeline, the neon look from the box cover | ✅ Done |
| 5 | **Audio:** 30-second preview, replay, skip to another song if a preview fails | ✅ Done, but real previews are still untested (the build sandbox cannot reach Apple) |
| 6 | **Ship:** Docker image, Railway config, Playwright end-to-end tests | ✅ Done. Deployed to Railway and online |
| 7 | **Polish:** save and resume, fixes from QA, Hebrew logo fix | ✅ Done. Animations and testing on real phones still open |
| 8 | ~~**Phase 2:** Spotify and Apple Music login and playback~~ | ❌ Dropped by the owner (2026-10-05) |

**Tests today:** 321 server unit tests, 296 web unit tests, 125 Playwright end-to-end tests (phone and desktop sizes, including the 8 smoke tests from section 9.5). All pass.

**Open checks:**
- Play a song on the live Railway site on a phone. This confirms the real 30-second previews, and that audio starts on an iPhone.
- Confirm the Hebrew logo reads correctly in iPhone Safari (fixed, but only tested in Chrome).
- Spot-check song years. Most were written from memory; the newest Hebrew songs were checked by web search.

**Note:** a demo with mock data was built and then removed at the owner's request. It is in git history (commits `57aabcb` and `c4e55f3`).

---

## 8. Out of scope (for now)

- Online multiplayer across several phones.
- Using tokens to buy a card (from the original game).
- Spotify and Apple Music login and full-track playback (milestone 8, dropped). The game uses the free 30-second Apple previews.

Tokens, naming the artist and title, betting on another player's card, and skipping a song for 3 tokens are built (step 9.6).

---

## 9. Next steps

### 9.1 More songs (+300) ✅ Done: 367 → 667 songs

- **Goal:** grow the list from 367 to about 670 songs. **Now 667** (267 Hebrew, 400 English).
- **First rounds:** +209 (100 English, 109 Hebrew).
- **Last round (+91), done by a team:** four researchers, one per gap, then an independent fact-checker per list who confirmed every year with a separate search. Anything in doubt was dropped (7 songs: 3 with an unclear year or version, 2 not famous enough, 1 instrumental, 1 explicit rap track).
  - **English 1950s:** +18 (now 33), including the first song from 1950.
  - **English 2020–2025:** +16 (now 41).
  - **Hebrew 1950s–60s:** +15 (1950s: 0 → 2, 1960s: 11 → 24). Most famous 1950s Israeli songs were written or sung years before a record came out, so their release year cannot be confirmed; they were left out.
  - **Hebrew 1990s–2000s:** +27 (1990s: 22 → 35, 2000s: 28 → 42), 12 of them from 2003–2009.
  - **Hebrew 2010s–2025:** +15.
- **How years were chosen:** the year of first release (single, radio release or album, whichever came first), not the year the song charted. A few songs came out late in one year and were hits the next (e.g. Shai Gabso's "יום ועוד יומיים", Dec 2003); they use the release year.
- **Rules stay the same:**
  - Very well-known pop, classic and light-rock songs only.
  - The year is the original release year and is checked against a source before adding.
  - At most 10 songs per artist.
- **Checked:** the catalog test (including the alias checks) and the end-to-end tests pass.

### 9.2 Winner at up to 30 cards ✅ Done

- The host can now set the target score from 3 to 30 cards (it was 3 to 20). The default stays 10.
- Changed the limit in the game rules, the Setup screen labels (they follow the limit automatically), the contract and the tests.
- Checked: web unit tests (112) and the Setup end-to-end tests (20) pass. A full 30-card game was not played through.
- **Watch for:** a long game with many players can use up the song list, because wrong guesses use songs too. The app then shows "no songs left" with an *End game* button. Step 9.1 (more songs) fixes this.

### 9.3 Cover picture on reveal ✅ Done

- When the player taps **Reveal**, the result screen shows the song's cover next to the card. The cover comes from the same Apple (iTunes) lookup as the preview, so each song needs only one lookup.
- **No answer leak:** the cover is only requested after Reveal. It is not requested, loaded or shown before that.
- **When there is no cover** (none found, a failed request or an image that won't load), nothing is shown and the screen looks as before.
- **Where:** the result screen only; not on timeline cards, the scoreboard or the winner screen.
- **Checked:** unit tests (server 13 new, web 4 new) and 7 new Playwright tests for the cover, including "no request before Reveal" and "no scrolling on a small phone". A placeholder record image is used in tests.
- **Not checked:** real Apple covers. The sandbox cannot reach Apple, so the first real test is on the live site.

### 9.4 Songs per performer: 10 in the list, 2 per game ✅ Done

- **List:** at most 10 songs per performer in `songs.json` (was 3). Collaboration credits count for every singer in the credit.
- **Game:** at most 2 songs by the same performer in one game. The app sends one entry per dealt song, and the server counts them. It picks performers not dealt yet first, then those dealt once, and a 3rd song only when nothing else is left, so a game never gets stuck.
- **Checked:** 142 server and 120 web unit tests, and all 83 Playwright tests pass.
- **Known gap:** a game saved before this change lost its repeated entries, so a performer can reach 3 songs once in such a resumed game.

### 9.5 Smoke tests for the live site 🟡 Merged; the production run is skipped for now (owner, 2026-10-05)

- `e2e/tests/smoke.spec.ts`, run with `npm run smoke`. Read-only and light: API health and stats, home, settings and setup in both languages, and one real turn (preview found, audio responds, reveal, cover if shown). Screenshots go to the test report.
- **Checked:** 8 of 8 pass against a local server (again on 2026-10-05, with the 667-song catalog). They also run in the full suite.
- **Blocked (still, on 2026-10-05):** the sandbox's network policy blocks `hit-recognition-production.up.railway.app` (the proxy answers 403). The owner needs to add that domain under Allowed domains in the cloud environment's network settings. Then run `E2E_BASE_URL=https://hit-recognition-production.up.railway.app npm run smoke`.
- Running them on production would also close two open checks above: real previews and real covers, including the first check of the 91 songs added in 9.1. iPhone Safari still needs a real phone.

### 9.6 Tokens, naming and bets ✅ Done (all 5 steps)

The full plan is in [docs/TOKENS_AND_BETS.md](docs/TOKENS_AND_BETS.md). The owner answered all 13 rule questions on 2026-10-04.

**Rules**
- **Tokens:** every player starts with 1 token, up to 5. The only way to earn one: on your own turn, place the card on the right spot **and** name the artist or the title correctly (+1). A card alone gives no token.
- **Naming:** on their turn, a player can also type the artist and the song title. The app checks both without showing the answer. It is offered on every turn, also when nobody can bet.
- **Bets:** allowed only if the current player did not name both correctly.
  - **First come, first served:** whoever takes the phone first bets first.
  - **To bet,** a player must correctly name a part the current player did not get right: the artist or the title when both are open, otherwise only the open one.
  - A bet costs 1 token and goes on a free spot of the current player's timeline, different from every other spot taken.
  - **If the current player is wrong and a bettor is right,** the earliest right bettor wins the card. It goes into the bettor's own timeline. The bettor gets their bet token back (no extra token).
  - **A wrong bet** loses its token.
- **Skip:** the current player can skip a song for 3 tokens.
- **Winner:** the winner check covers every player. When the game is ended early and players are tied on cards, more tokens wins.

**How**
- **Checking names:** a new server endpoint, `POST /api/songs/:id/guess`, checks the typed names with tolerant Hebrew/English matching. It never returns the answer.
- **Betting:** a "Who's betting?" screen lists the players who may bet. Each one taps their name, names the song, then picks a spot.
- **On/off:** a "Tokens & bets" switch in Setup, on by default.
- **Saved games:** games saved before this change are migrated, not lost.
- **Mockups:** the [UI design canvas](https://claude.ai/artifact/4FzDZZfJcLzt3MD3NQ8Ujz), updated for the first-come, first-served betting round and the skip button.

**Steps:**
1. Check names on the server. ✅ Done: `POST /api/songs/:id/guess`, with 85 new server unit tests and 2 new end-to-end API tests.
2. Game rules. ✅ Done: tokens, bets, skips, winner check for every player, token tie-break, saved-game migration; 113 new web unit tests.
3. Screens. ✅ Done: token meter, skip, naming, Lock in, the betting screens, timeline markers, result rows, scoreboard, winner, setup switch, in Hebrew and English.
4. End-to-end tests and docs. ✅ Done: `e2e/tests/betting.spec.ts` (14 tests on each of phone and desktop), new screenshots of the betting screens, and the docs (CONTRACTS §6, DESIGN, QA). The older specs play with the switch on, except `gameplay.spec.ts`, which keeps testing the classic rules with it off.
5. A "We accept it" button and English spellings of Hebrew artist names. ✅ Done (209 songs with English spellings; 42 alternative titles).

**Rule update (2026-10-04, after PR #6):** the owner changed two rules. (1) A token is earned only for a right spot together with a right artist or title on your own turn; winning a card (or a bet) no longer gives one. (2) A bettor may only name the part the current player did not get right. Naming is now also offered when nobody can bet (Reveal checks the names). Tests: web 296, e2e 117 (betting.spec 14 on each project).

**Still to check by hand:** the keyboard over the footer and iPhone Safari on a real phone (docs/QA.md, TC-47 to TC-53).

### Suggested order

1. 9.6, tokens and bets: merged (PR #6), with the rule update (PR #7). Next: a real-phone check.
2. Later: allow the production domain and run the 9.5 smoke tests on the live site (skipped for now).

Milestone 8 (Spotify and Apple Music) is dropped.
