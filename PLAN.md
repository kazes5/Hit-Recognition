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

**Rules for picking songs**
- A song is never played twice in the same game.
- The app avoids picking an artist who has already appeared in the game. It only repeats an artist when no other artist is left.
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

## 4. Music source (Spotify / Apple Music)

| Option | What it needs | Notes |
|---|---|---|
| **Apple Music previews (MVP)** | Nothing: free iTunes Search API | Official 30-second previews, including Israeli songs. No login needed. |
| **Spotify** | User login (OAuth) + **Premium** account | Spotify's SDK plays the full track. The app starts at a random point and stops after 30 seconds. Spotify no longer gives new apps 30-second preview links, so Premium is required. |
| **Apple Music (full)** | MusicKit + Apple Music subscription | Same approach as Spotify: play the track, stop after 30 seconds. |

The MVP ships with the free Apple previews. Connecting Spotify or Apple Music is added in phase 2, and the user picks one in Settings.

**Song list:** the app uses its own curated list (`songs.json`) instead of release dates from Spotify or Apple. Their dates often belong to remasters or compilations, which would put songs in the wrong year.

```json
{ "id": 227, "artist": "James Brown", "title": "I Got You (I Feel Good)",
  "year": 1965, "language": "en", "genre": "pop",
  "spotifyId": "...", "appleId": "..." }
```

- **Today:** 529 songs (163 Hebrew, 366 English), from the 1950s to the 2020s. Goal: about 670 (see section 9.1).
- Genres: pop, classic and light rock.
- Automatic tests check the list: no duplicate ids or songs, at most 3 songs per artist, and enough songs in each decade.
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
2. **Players:** add or remove names, choose the target score.
3. **Turn:** player name, hidden card with the playing speaker, replay button, the player's timeline with slots to choose from, **Reveal** button.
4. **Result:** the revealed card plus ✅ "Correct!" or ❌ "Wrong, it was 2003", then *Next player*.
5. **Scoreboard:** card counts for all players (available at any time).
6. **Winner:** the final timelines and a *Play again* button.
7. **Settings:** language, music source (Previews / Spotify / Apple Music), song languages (Hebrew / English / both).

---

## 7. Milestones and progress

| # | Milestone | Status |
|---|---|---|
| 1 | **Setup:** web + server projects, theme (colors and fonts), Hebrew/English text, RTL support | ✅ Done |
| 2 | **Song list:** 529 songs with years checked, no repeated artists | ✅ Done. More songs still planned (section 9.1) |
| 3 | **Game logic:** players, turns, song picking without repeats, placement check, score, winner, with tests | ✅ Done |
| 4 | **UI:** all screens in section 6, the card, the timeline, the neon look from the box cover | ✅ Done |
| 5 | **Audio:** 30-second preview, replay, skip to another song if a preview fails | ✅ Done, but real previews are still untested (the build sandbox cannot reach Apple) |
| 6 | **Ship:** Docker image, Railway config, Playwright end-to-end tests | ✅ Done. Deployed to Railway and online |
| 7 | **Polish:** save and resume, fixes from QA, Hebrew logo fix | ✅ Done. Animations and testing on real phones still open |
| 8 | **Phase 2:** Spotify and Apple Music login and playback | ⬜ Not started |

**Tests today:** 131 server unit tests, 116 web unit tests, 82 Playwright end-to-end tests (phone and desktop sizes). All pass.

**Open checks:**
- Play a song on the live Railway site on a phone. This confirms the real 30-second previews, and that audio starts on an iPhone.
- Confirm the Hebrew logo reads correctly in iPhone Safari (fixed, but only tested in Chrome).
- Spot-check song years. Most were written from memory; the newest Hebrew songs were checked by web search.

**Note:** a demo with mock data was built and then removed at the owner's request. It is in git history (commits `57aabcb` and `c4e55f3`).

---

## 8. Out of scope (for now)

- Online multiplayer across several phones.
- Tokens for challenging or stealing cards (from the original game).
- Guessing the artist or title for bonus points.

---

## 9. Next steps (planned, not started)

### 9.1 More songs (+300) 🟡 Partly done: +162 of +300

- **Goal:** grow the list from 367 to about 670 songs.
- **Done:** 529 songs now (+162: 100 English, 62 Hebrew). Every year was checked by web search; songs with an unclear year, a doubtful credit, or low fame were left out.
- **Still short:** about 140 songs. Second research run: 13 Hebrew songs added (1960s: 3, 1990s: 4, 2010s: 6). Hebrew research is slow without Wikipedia, mako or Shironet, because only web search results are reachable from the sandbox, so use a session where those pages open. There are still no Hebrew songs from the 1950s and only 11 from the 1960s.
- **To finish:** raise the search limit (the `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` setting) and rerun the research, mainly for Hebrew songs from the 1950s–60s, the 1990s and the 2010s–20s.
- **Rules stay the same:**
  - Very well-known pop, classic and light-rock songs only.
  - The year is the original release year and is checked against a source before adding.
  - At most 3 songs per artist.
- **Done when:** about 670 songs, the catalog test passes, and the end-to-end tests still pass.

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

### Suggested order

1. Finish 9.1 (the remaining ~150 songs, mostly Hebrew). 9.2 and 9.3 are done.
2. Then milestone 8, Spotify and Apple Music.
