# Hitster — QA Test Plan

Owner: QA engineer. Sources: [PLAN.md](../PLAN.md), [CONTRACTS.md](CONTRACTS.md), reference photos (box cover, 4 cards).

## 1. Scope

In scope (MVP): pass-and-play web app on one phone (390x844 primary, also 360x740 / 430x932), English + Hebrew UI, `server/` API (`/api/health`, `/api/songs/stats`, `/api/songs/next`, `/api/songs/:id/preview`, `/api/songs/:id/guess`, `/api/mock-audio`), the curated `server/data/songs.json`, game rules in `web/src/game/`, tokens, naming and bets (`docs/TOKENS_AND_BETS.md`), save/resume, error handling.

Out of scope: Spotify / Apple Music login (dropped), online multiplayer, Railway infra (covered by DevOps), load testing.

Environments: Chromium (Playwright, mobile viewport, `PREVIEW_PROVIDER=mock`) for automation; real iOS Safari + Android Chrome for audio/autoplay checks before release.

## 2. Risk areas

| # | Risk | Why it matters | How we test |
|---|---|---|---|
| R1 | **Placement correctness** with equal years, first/last slot, single-card timeline | Core rule; `prevYear <= year <= nextYear`, missing neighbour unbounded. Off-by-one on slot index is easy. | Unit tests in `web/src/game/`; manual TC-10..TC-14 using known-year songs |
| R2 | **No song repeats** within a game (incl. starting cards, discarded cards, songs skipped due to null preview) | Explicit rule | API: loop `/api/songs/next` with growing `excludeIds` until 404; UI: track `data-song-id` over a long game |
| R3 | **Max 2 songs per artist per game**; a 3rd only when nothing else is left (soft fallback); `excludeArtists` has one entry per dealt song, case-insensitive | Explicit rule | API with `excludeArtists` `[A, A]` (never returns A while others exist), `[A]` (other artists excluded: returns A), `[A, A]` with others excluded (200 via fallback); different casing |
| R4 | **Hidden info leaking before reveal**: DOM text, `alt`, `aria-label`, `title` attributes, `document.title`, `data-*` attributes, CSS `content`, localStorage readable via devtools is acceptable-ish, `<audio>` src. Network-visible fields (JSON response) are **acceptable**. | Defeats the game | Before Reveal: dump `document.body.innerText`, all attribute values, `document.title`; search for artist/title/year of the current song |
| R5 | **Audio does not start on mobile** (autoplay policy) | iOS Safari blocks `play()` without a user gesture; first clip after a network await is often blocked | Play must be triggered directly in the tap handler; test on real iPhone; `btn-play` always available as a manual fallback |
| R6 | **30-second cutoff**; replay restarts; audio stops on Reveal / Next / leaving screen | Rule + annoyance | Real previews are ~30 s; check timer stop, no overlapping audio after Next |
| R7 | **Null preview / audio error** → silently fetch another song, id still marked used | Rule; risk of infinite loop or repeated song | Stub preview to `null` / 404 audio (Playwright route) |
| R8 | **RTL layout / mixed-direction card text** | Hebrew artist on English UI and vice versa; timeline must stay LTR chronological | Switch languages; card text uses `dir="auto"` or per-language `dir`; titles with parentheses/numbers (e.g. "I Got You (I Feel Good)", "מ-100") render correctly |
| R9 | **Persistence / resume** | Reload mid-turn must not reveal, lose, or duplicate cards; must not re-roll song (cheating vector) | Reload at each step (before play, slot selected, after reveal, winner) |
| R10 | **Server unreachable** | Must show `error-banner`, not a blank screen or stuck spinner; recover when server is back | Kill server mid-game; 404 `NO_SONGS_LEFT` case |
| R11 | **Data quality** of `songs.json` | Wrong original year = "correct" players marked wrong | Manual review of years, duplicates, spelling, balance, max 10 songs/artist (was 3) |
| R12 | Setup validation | Duplicate/empty names, target range 3–20 | TC-01..TC-05 |
| R13 | **Tokens and bets settle wrongly**: wrong card winner, tokens off by one, a bettor winning the game on someone else's turn not noticed | New rules, many paths | Unit tests (`tokens.test.ts`, `reducer.test.ts`), `e2e/tests/betting.spec.ts`, TC-31..TC-46 |
| R14 | **Names give the answer away**: the screen says which part was right before Reveal, a bettor's typing is still on screen for the next one, or a request is sent while typing | Fairness | TC-36, TC-38, TC-40; network tab: one `/guess` call per Lock in / Check, none without text |
| R15 | **Keyboard on phones** covers the fields or the footer button | iOS and Android handle the on-screen keyboard differently | TC-47..TC-50 on real phones |

## 3. Manual test cases

| ID | Area | Steps | Expected |
|---|---|---|---|
| TC-01 | Setup | Home → New Game. Try Start with 0 players. | `btn-start-game` disabled. |
| TC-02 | Setup | Add "Dana", then "dana " / "Dana", then empty / whitespace name. | Duplicate (trim, case-insensitive recommended) and empty names rejected; list shows one `player-item`. |
| TC-03 | Setup | Add 10 players, try an 11th. | 11th rejected / add disabled. |
| TC-04 | Setup | Set target 2, 21, 'abc', 10. | Clamped/rejected outside 3–20; default 10. |
| TC-05 | Setup | Remove a player with `btn-remove-player`. | Removed; order of others preserved. |
| TC-06 | Start | Start a 2-player game. | Each player has exactly 1 revealed starting card; all ids distinct; artists distinct. |
| TC-07 | Turn / hidden | On turn screen before Reveal inspect DOM text, `alt`, `aria-label`, `title`, `document.title`, `data-*`. | No artist / title / year of current song anywhere (network JSON acceptable). Hidden card dark with neon "?" + equalizer. |
| TC-08 | Audio | Tap `btn-play`. | Audio starts (gesture), speaker gets `speaker--playing`, stops at ≤30 s; replay restarts from start. No autoplay before tap. |
| TC-09 | Turn | Press Reveal without slot. | `btn-reveal` disabled. |
| TC-10 | Placement | Timeline [1980]; song 1975; pick slot 0. | Correct; card inserted before 1980. |
| TC-11 | Placement | Timeline [1980]; song 1975; pick slot 1. | Wrong; `result-wrong` shows "Wrong, it was 1975"; card discarded. |
| TC-12 | Placement equal year | Timeline [1980]; song 1980; pick slot 0, then (new game) slot 1. | Both correct. |
| TC-13 | Placement between | Timeline [1970, 1990]; song 1990 in slot 1; song 1970 in slot 1; song 1991 in slot 1. | Correct, correct, wrong. |
| TC-14 | Placement ends | Song older than all cards → slot 0 correct, slot n wrong; newer than all → slot n correct. | As stated. |
| TC-15 | Score | After correct reveal, open scoreboard. | `score-row[data-score]` = timeline length for every player. |
| TC-16 | Turn order | Press Next. | Next player in order; wraps around; audio from previous turn stopped. |
| TC-17 | Winner | Reach target. | Pressing Next shows `screen-winner` with `winner-name`; final timelines shown; Play again resets game. |
| TC-18 | No repeat | Play a long game (≥40 turns) with mock provider; record `data-song-id` of every card seen (incl. discarded). | No id appears twice. Artist repeats only after artists exhausted. |
| TC-19 | Null preview | Route `/api/songs/*/preview` → `{previewUrl:null}` for first call. | App silently moves to another song; skipped id never appears later. |
| TC-20 | Audio error | Route audio URL → 404. | Same as TC-19, no error banner loop. |
| TC-21 | Language | Settings → Hebrew. | `<html dir="rtl" lang="he">`; all UI strings Hebrew; timeline still LTR chronological; persisted in `hitster.lang` across reload. |
| TC-22 | Mixed direction | Hebrew song card in English UI; English card in Hebrew UI. | Hebrew text right-to-left, English left-to-right; parentheses/punctuation not flipped. |
| TC-23 | Song language | Settings → songs Hebrew only; play. | Only `language: "he"` songs (incl. starting cards). Persisted in `hitster.songLanguages`. |
| TC-24 | Resume | Reload: (a) before slot, (b) slot selected, (c) after reveal, (d) on winner screen. | Game resumes at same player and same song; no free re-roll, no lost/duplicated card, hidden stays hidden. |
| TC-25 | Server down | Stop server mid-game, press Next / Play. | `error-banner` visible with clear message; app not blank; recovers after server restarts. |
| TC-26 | No songs left | Song languages = he with tiny pool, or exhaust via API. | `error-banner` "no songs left"; game can still be ended (most cards wins). |
| TC-27 | End early | End game from scoreboard/menu. | Winner = most cards (tie handled sensibly). |
| TC-28 | Card look | Compare revealed card with reference photo. | Artist top, big bold year center, italic title bottom, deck code bottom-left small, number bottom-right small; decade gradient colours. |
| TC-29 | Mobile layout | 360/390/430 widths, portrait. | No horizontal page scroll (only timeline scrolls); touch targets ≥44px; long titles wrap, not cut. |
| TC-30 | API | `POST /api/songs/next` with bad body (`excludeIds:"x"`). | 400 `INVALID_REQUEST`. Unknown id preview → 404 `SONG_NOT_FOUND`. `/api/health` → `{status:"ok"}`. |

## 3b. Manual checklist: tokens, naming and bets

Rules: `docs/TOKENS_AND_BETS.md`. Automated: `e2e/tests/betting.spec.ts`. Use 3 players (Ann, Bob, Carol) unless a case says otherwise. Tokens are in the header chip (◉) and the scoreboard's Tokens column.

| ID | Area | Steps | Expected |
|---|---|---|---|
| TC-31 | Setup | Open Setup. Turn "Tokens & bets" off, go back, open Setup again, reload. | On by default. Off is remembered. With it off, the turn has Reveal, no ◉, no naming, no skip. |
| TC-32 | Tokens | Start a game. (a) Place a card right without naming. (b) Place a card wrong, with the artist named right. (c) Place cards right with the artist or the title named right until you have 5, then once more. | Start at 1. (a) "+1 card", no token. (b) No token. (c) "+1 card · +1 token" each time; at 5, "+1 card (tokens full)"; the meter shows "Max". |
| TC-33 | Lock in | Pick no spot. Open "Name artist + title". | Lock in stays disabled, with "Pick a spot on the timeline first". |
| TC-34 | Naming both | Name both right (try other case, no apostrophes, a small typo), Lock in. | The card is revealed at once. "Named it! No bets allowed." Names shown with ✓ ✓. |
| TC-35 | Named, wrong spot | Name both right, pick a wrong spot. | Card discarded, no bets, no tokens move (a token needs the right spot too). |
| TC-36 | Bets open | Name one part wrong (or nothing), Lock in. | "Bets are open!". With nothing right: "To bet, name the artist or the title." With the artist right: "Ann named the artist. To bet, name the title." (and the other way round). The answer is nowhere on screen. |
| TC-37 | Bettor allowed | Ann named nothing right. Bob taps his name, types only the artist right, Check. | "You can bet!". Free spots light up; Ann's spot shows a pink "A" and cannot be picked. |
| TC-37b | Only the open part | Ann named the artist right, the title wrong. Bob taps his name. | "Bob, name the title", one field only ("Only this part is still open"). The right title lets him bet; the artist cannot be used. |
| TC-38 | Fields cleared | After Bob's Check, Carol taps her name. | Carol's fields are empty. Bob's typing is gone. |
| TC-39 | Bettor denied | Carol names neither right. | "Not this time. Pass the phone on." Her token is kept. Her button shows "tried". |
| TC-40 | Cancel | A bettor taps Cancel before Check; another taps Cancel after Check. | Before Check: the try is kept. After Check: the try is used. No request without typed text. |
| TC-41 | Any order, earlier wins | Two songs share a year so two spots are right. Carol bets first, then Bob, both right; Ann wrong. | Carol wins the card (into her own timeline, sorted, gold outline, "Added to Carol's timeline"), "+1 card", her bet token back (no +1). Bob: "Correct bet, but Carol bet first", keeps his token. |
| TC-42 | Wrong bet | Ann right with the title named right, Bob bets wrong. | Ann "+1 card · +1 token". Bob −1 token. |
| TC-43 | Nobody right | Ann wrong, every bet wrong. | "Nobody got it. The card is out." Each bettor −1. |
| TC-44 | We accept it | Ann types names that are fair but rejected; bets are placed; Reveal. Tap "We accept it". | Bet tokens come back; a card won by a bettor is taken back; Ann's spot alone decides the card, and she gets +1 token only if her spot was right. The button is gone afterwards. |
| TC-45a | Naming with nobody to bet | 1-player game (or nobody else has a token). Pick the right spot, open "Name artist + title", type the artist right, Reveal. | Reveal checks the name ("Checking…"), no betting round; "+1 card · +1 token". |
| TC-45 | Skip | With 3+ tokens, pick a spot, tap "Skip · 3". Tap "Keep listening"; then Skip again and confirm. | Keep listening costs nothing. Skip: −3 tokens, a new song, the spot is cleared. No skip button with 2 tokens or during betting. |
| TC-46 | Winner / resume | (a) Bob reaches the target by a won bet on Ann's turn. (b) Reload during betting, with a bettor mid-naming. (c) End the game early with players tied on cards. | (a) Next says "See the winner", Bob wins. (b) Same round, same bets; the unchecked bettor's try is unused. (c) More tokens wins ("Tied on cards; more tokens wins."); still tied, shared win. |

**Real phones** (the keyboard and Safari cannot be checked in Chromium):

| ID | Device | Steps | Expected |
|---|---|---|---|
| TC-47 | iPhone Safari | Tap a name field. | No zoom (16px inputs). No autocorrect, no suggestions, no capital letter forced. |
| TC-48 | iPhone Safari | Open the naming fields, keyboard up. Then the bettor's fields. | The field being typed in stays visible; the page can scroll to the footer button (Lock in / Check); nothing is hidden for good under the keyboard. After the keyboard closes, no gap is left at the bottom. |
| TC-49 | Android Chrome | Same as TC-48. | The footer stays above the keyboard (`interactive-widget=resizes-content`). |
| TC-50 | Both, Hebrew | Type Hebrew in an English UI and English in the Hebrew UI. | Text runs the right way in the field (`dir="auto"`). |
| TC-51 | Both | Play the clip, Lock in, play again from the betting screen (Replay in the gold box). | Audio plays from a tap; it stops on Reveal and on Next. |
| TC-52 | Small phone (360×640), Hebrew | Go through every betting screen with long names. | No sideways page scroll; long names end with "…"; buttons at least 44px. |
| TC-53 | Screen reader (VoiceOver / TalkBack) | Go through a betting round. | The bettor change and "You can bet!" / "Not this time" are announced; taken spots are read as "Ann's pick" / "Bob's bet". |

## 4. Acceptance checklist (mapped to PLAN.md)

| PLAN ref | Requirement | Covered by |
|---|---|---|
| §1.1 | 2–10 players (contract 1–10), target default 10 | TC-01..05 |
| §1.2 | Each player starts with one revealed card | TC-06 |
| §1.3.1 | 30 s clip, info hidden | TC-07, TC-08, R4 |
| §1.3.2–3 | Pick slot, Reveal | TC-09..14 |
| §1.3.4 | Correct keeps, wrong discards | TC-10, TC-11 |
| §1.3.5 | Play passes on | TC-16 |
| §1.4–5 | Score = cards; first to target wins; end early | TC-15, TC-17, TC-27 |
| §1 rules | No song twice; avoid repeated artists; equal year correct both sides | TC-18, TC-12, R2, R3 |
| §2 | Card layout, decade colours, hidden state, mixed direction | TC-28, TC-07, TC-22 |
| §3 | Near-black bg, pink/cyan neon, logo HITSTER/היטסטר, pulsing speaker, cyan slots, HE/EN | Exploratory + screenshots |
| §4 | Curated list, original years, ~300 songs, ~half HE/EN, 1950s–2020s, genres | Data review (R11) |
| §5 | Health check, save/resume, Vitest + Playwright | TC-24, TC-30, lint/test runs |
| §6 | Screens Home/Players/Turn/Result/Scoreboard/Winner/Settings | Full exploratory game |
| §7.5 | Skip song if preview fails | TC-19, TC-20 |
| §9.6 | Tokens, naming, bets, skip, "We accept it" | TC-31..TC-53, `betting.spec.ts` |

---

## 5. Test Report (2026-10-02, build from working tree, `PREVIEW_PROVIDER=mock`)

### 5.1 Package checks

| Package | `npm run lint` | `npm test` |
|---|---|---|
| server/ | PASS (tsc --noEmit) | PASS: 3 files, 40 tests |
| web/ | PASS (tsc --noEmit) | PASS: 10 files, 109 tests |

### 5.2 API checks (curl / node against `server/dist/index.js`)

- `/api/health` returns `{status:"ok"}`. `/api/songs/stats` returns 310 total, he 44, en 266.
- Bad body returns 400 `INVALID_REQUEST`, malformed JSON returns 400, unknown preview id returns 404 `SONG_NOT_FOUND`, mock preview returns `/api/mock-audio` (audio/wav).
- Note: the figures in this section predate the 2-per-artist game cap and the 10-per-artist catalog cap.
- Exhaustion loop with growing `excludeIds`/`excludeArtists`: 310 distinct songs, then 404 `NO_SONGS_LEFT`. No duplicates. The first repeated artist came at draw 257, which is exactly after all 256 distinct artist strings were used. PASS.

### 5.3 Exploratory UI (Playwright, Chromium, 390x844, mobile + touch)

| Check | Result |
|---|---|
| Setup validation (0 players, duplicate `dana`/`DANA`, blank, target 2/21/empty, more than 10 players) | PASS |
| Full 2-player game to a win, English (target 3) | PASS. Winner correct, scoreboard `data-score` correct, Play again prefills names |
| Full 2-player game to a win, Hebrew UI | PASS. `<html dir="rtl" lang="he">`, Hebrew strings, timeline stays LTR |
| Placement correct/wrong paths, revealed card matches the API song (artist/year/title/number) | PASS |
| Hidden-info leak before Reveal (body text outside timeline, all attributes incl. aria-label/alt/title/data-*, `document.title`) | PASS: nothing leaks in the DOM. The current song does sit in `localStorage["hitster.game"].currentSong` (same exposure as the network response, so acceptable; noted for information) |
| Play tap starts `speaker--playing` | PASS |
| Resume after reload on the result screen and mid-turn (slot selected) | PASS. Same song (no re-roll), slot preserved |
| Null preview, then silent skip | PASS |
| Audio 404, then a new song is fetched with no banner (user taps Play again) | PASS |
| Song-language filter `he` | PASS (only Hebrew songs, starting cards included) |
| Server killed mid-game, then Next | PASS. `error-banner` "Can't reach the server…" with Try again / End game now; Try again recovers after restart and the banner clears |
| Horizontal page overflow on all screens | PASS (none) |
| Card look vs reference photo | PASS overall: artist top, large bold year, italic title, `IL01` bottom-left, number bottom-right, decade pastel gradients, dark hidden card with neon "?" and equalizer. Mixed direction (Hebrew card in English UI) renders correctly |

Limitations: Google Fonts (Rubik / Tilt Neon) could not load in the sandbox because of a proxy certificate, so screenshots use fallback fonts. With mock audio (2 s) the 30-second cutoff could not be observed end-to-end; it was code-reviewed instead. Real-phone autoplay (iOS Safari) is still to be tested manually (TC-08).

### 5.4 Song data review (`server/data/songs.json`, 310 songs)

- **Release years:** no year that I am confident is wrong. Debatable (original single vs. wide release), consider aligning with the official Hitster cards:
  - #132 The Killers "Mr. Brightside": 2003 (UK limited single). Wide release and most references say **2004**.
  - #200 ELO "Mr. Blue Sky": 1977 (album) / 1978 (single). Fine as is.
  - #229 GN'R "Sweet Child o' Mine": 1987 (album) / 1988 (single). Fine as is.
  - #186 Deep Purple "Smoke on the Water": 1972 (album) / 1973 (single). Fine as is.
- **Duplicates:** none (ids 1–310 unique, no artist+title duplicates).
- Note: figures here predate the catalog cap change to 10 songs per artist.
- **Artists with more than 3 songs:** none. 13 artists have exactly 3.
- **Language balance:** **he 44 (14%) vs en 266 (86%)**, but PLAN §4 says "roughly half and half". With "both" selected a Hebrew song appears only about 1 turn in 7. In my Hebrew-UI game, every card was English.
- **Decade balance per language:** Hebrew has 0 songs in the 1950s and 2020s, 2 in the 1960s, 5 in the 1990s and 5 in the 2010s. With "songs: Hebrew only" the game has just 44 songs, and all 2020s years are missing.
- **Hebrew selection:** heavily weighted toward Eurovision entries (about 15 of 44). It is missing many of the biggest Israeli hits (e.g. עומר אדם, אביב גפן, אתניקס, משינה beyond one song, שלמה ארצי's biggest hits, נועה קירל in Hebrew, אושר כהן, סטטיק ובן אל beyond one song). Some entries are not widely known today (#45 Teapacks "Push the Button", #217 מוטי גלעדי ושרי צוריאל, #248 אבי טולדנו "הורה").
- **Spelling:** #4 "דתנר וקושניר" should be **"דטנר וקושניר"** (Natan Datner = נתן דטנר).
- **Artist-name variants defeat the no-repeat-artist rule:** #72 "יזהר כהן והאלפבתא" vs #13 "יזהר כהן"; #184 "Lady Gaga & Bradley Cooper" vs Lady Gaga (#103, #273); #226 "The Kid LAROI & Justin Bieber" vs #285 Justin Bieber.
- **Genre:** a few borderline but acceptable "pop" tags on dance, EDM or jazz hits (Eiffel 65, LMFAO, Avicii, Calvin Harris, Daft Punk, Louis Armstrong, Sinatra). No action needed unless the genre is strictly enforced.

### 5.5 Bug list

| # | Severity | Owner | Summary |
|---|---|---|---|
| 1 | Major | backend | Catalog is only 14% Hebrew (44/310), but PLAN §4 asks for about 50%. Hebrew has no 1950s or 2020s songs |
| 2 | Major | frontend + designer | At 390x844 the timeline is below the fold and hidden behind the sticky Reveal footer, so the player must scroll on every turn |
| 3 | Minor | frontend / designer | Scoreboard rows in RTL: a Latin player name sticks to the score ("1Avi"), and scores sit mid-table |
| 4 | Minor | designer | The `.flip-rtl` class has no CSS, so the back arrow points the wrong way in Hebrew |
| 5 | Minor | designer | A wrong result strikes through the year on the revealed card, which suggests the year itself is wrong |
| 6 | Minor | backend | Artist-name variants (duets / "& band") bypass the no-repeat-artist rule |
| 7 | Minor | backend | Misspelled Hebrew artist name: דתנר should be דטנר |
| 8 | Minor | frontend | The 30-second timer starts when Play is tapped, not when audio actually starts, so a slow load shortens the clip |
| 9 | Minor | frontend | Reveal can be pressed without ever playing the clip |
| 10 | Minor | backend | #132 "Mr. Brightside" year 2003 is debatable; most references and Hitster use 2004 |
| 11 | Minor | designer | Home header: the tagline frame is squeezed next to the logo instead of below it as on the box cover |

#### Bug 1 (Major, backend): Hebrew songs are badly under-represented
- Repro: `GET /api/songs/stats` returns `byLanguage: { he: 44, en: 266 }`. Play a Hebrew-UI game with songs = both: in my run, all 6 cards were English.
- Expected: roughly half Hebrew (PLAN §4: "roughly half Hebrew and half English, spread from the 1950s to the 2020s"), with each decade covered in both languages.
- Actual: 44 Hebrew songs. Hebrew per decade: 1960s 2, 1970s 13, 1980s 11, 1990s 5, 2000s 8, 2010s 5, 2020s 0. Hebrew-only mode is thin and very Eurovision-heavy.
- File: `server/data/songs.json`. Add about 100 famous Israeli hits, especially 1990s, 2010s and 2020s.

#### Bug 2 (Major, frontend + designer): Timeline hidden below the fold on the turn screen
- Repro: 390x844, start a game. On the turn screen, measured positions: hidden card 80–360 px, Play 602–650, timeline 753–897, sticky Reveal 784–832, document height 1001. Screenshot: `vp-turn.png` in the QA scratch dir.
- Expected: hidden card, Play, the timeline slots and Reveal are all visible without scrolling. Picking a slot is the main action.
- Actual: the timeline is cut off and overlapped by the sticky footer (`.screen__footer { position: sticky }`, `web/src/styles/theme.css:144`). Each turn needs a scroll to find the slots. With an error banner the page grows to about 1150 px.
- Suggestion: shrink the hidden card (for example `min(60vw, 32vh)`) and the speaker on the turn screen, or merge them (put the speaker inside or behind the hidden card). Keep the timeline directly above the footer.

#### Bug 3 (Minor, frontend/designer): Scoreboard alignment broken in RTL
- Repro: Hebrew UI, players "דנה" and "Avi". Open the scoreboard (`he-scoreboard.png`).
- Expected: name at the start (right) side, score at the end (left) side, same as for Hebrew names.
- Actual: "Avi" is left-aligned within its cell, so it touches the score ("1Avi"). Scores sit mid-table rather than at the edge. Cause: `<td dir="auto">` and `<td dir="ltr">` in `web/src/components/Scoreboard.tsx:56-57`, combined with `text-align: end` in `theme.css:755`, resolve start/end per cell direction.
- Fix: keep the `td`s in the table direction, put `dir="auto"` on an inner `<span>`, and set `td:first-child { text-align: start }`. The same applies to the Hebrew-name-in-English-UI case.

#### Bug 4 (Minor, designer): Back arrow not mirrored in RTL
- Repro: Hebrew UI, then Settings or New Game (`he-settings.png`).
- Expected: the back arrow at the right edge points right (→).
- Actual: "←" is not mirrored. `SetupScreen.tsx:53` and `SettingsScreen.tsx:19` use `className="flip-rtl"`, but there is no `.flip-rtl` rule in `web/src/styles/theme.css` or the built CSS.
- Fix: `[dir="rtl"] .flip-rtl { display:inline-block; transform: scaleX(-1); }`

#### Bug 5 (Minor, designer): Wrong result strikes through the correct year
- Repro: place a card wrongly and reveal it (`he-t1-result.png`).
- Expected: the card shows the true year clearly. The wrong placement is shown by the red outline and the message.
- Actual: `.song-card--wrong .song-card__year { text-decoration: line-through }` (`theme.css:393`) crosses out the real year, which reads as if the year itself is wrong.

#### Bug 6 (Minor, backend): Artist variants bypass avoid-repeat
- Repro: a game can deal #13 "יזהר כהן" and later #72 "יזהר כהן והאלפבתא". The same goes for Lady Gaga (#103/#273) with #184 "Lady Gaga & Bradley Cooper", and Justin Bieber (#285) with #226.
- Expected: these are treated as the same artist for the no-repeat preference.
- Note: this finding predates the in-game cap (max 2 per performer, one `excludeArtists` entry per dealt song).
- Fix options: an optional `artistKey`/`mainArtist` field in songs.json used by `normalizeArtistKey` (`server/src/selection.ts:13`), or change the printed name to the main artist. Note that `excludeArtists` is sent by the client using the displayed `artist` string.

#### Bug 7 (Minor, backend): Misspelled artist
- `server/data/songs.json` id 4: "דתנר וקושניר" should be "דטנר וקושניר".

#### Bug 8 (Minor, frontend): Clip cutoff timer starts before playback
- `web/src/audio/useAudioPlayer.ts:101`: `setTimeout(maxSeconds*1000)` is armed at tap time. On a slow mobile connection, buffering eats into the 30 s and the clip is cut short. It also cuts a replay short if the timer is not cleared on `waiting`.
- The `timeupdate` check at line 72 already enforces `currentTime >= 30`. Either arm the timer on the `playing` event, or rely on `timeupdate` and keep the timer only as a fallback of 30 s plus a margin.

#### Bug 9 (Minor, frontend): Reveal possible without hearing the song
- `web/src/screens/GameScreen.tsx:77`: `canReveal` does not require `hasPlayed`. A player can select a slot and reveal without playing, for example after accidentally scrolling past Play. Consider requiring at least one Play tap, or confirm first. This is a product decision; it is low priority.

#### Bug 10 (Minor, backend): Debatable year
- #132 The Killers "Mr. Brightside" is listed as 2003. It had a limited UK single in 2003 but was widely released and charted in 2004, which most references and the official Hitster card use. Consider 2004.

#### Bug 11 (Minor, designer): Home header layout differs from the box cover
- `en-home.png`: at 390 px the "Music party game" neon frame sits beside the logo and wraps to 3 lines. On the box it is a wide cyan frame below the logo. Stack them vertically.

### 5.6 Not reproduced / passed
- Placement rule, including equal years (unit tests `web/src/game/rules.test.ts:72,79,122`, plus UI paths).
- No song repeats over a full catalog exhaustion (API) and across UI games.
- No hidden-info leak in DOM, attributes or title.
- Error banner and recovery when the server is down.
- Resume without a re-roll.
- Null-preview and audio-error skip.
