# Team Contracts

Shared agreements so each role can work in parallel. **Do not change a contract without the lead's approval** — other roles code against it.

## 1. Repository layout & ownership

| Path | Owner | Notes |
|---|---|---|
| `server/` | Backend developer | Node 22 + TypeScript + Express, Vitest + Supertest |
| `server/data/songs.json` | Backend developer | Curated song catalog |
| `web/` | Frontend developer | Vite + React 18 + TypeScript, Vitest + Testing Library |
| `web/src/styles/` | UI designer | `theme.css` (tokens + shared classes, see §5) |
| `docs/DESIGN.md` | UI designer | Visual spec |
| `Dockerfile`, `.dockerignore`, `docker-compose.yml` | DevOps | Single production image |
| `railway.json`, `docs/DEPLOYMENT.md` | Railway integrator | |
| `e2e/` | Test automation engineer | Playwright (own `package.json`) |
| `docs/QA.md` | QA engineer | Test plan + bug reports |
| `package.json` (root), `PLAN.md`, `docs/CONTRACTS.md` | Lead | |

Each of `server/`, `web/`, `e2e/` is an **independent npm package** (own `package.json` + `package-lock.json`, `npm ci` inside that folder). No workspaces. Only touch files you own; if you need something from another area, note it in your final report.

## 2. Package scripts (required)

**server/**
- `npm run build` → compiles to `server/dist/`; entry `server/dist/index.js`
- `npm start` → `node dist/index.js`
- `npm run dev` → watch mode on port 3000
- `npm test` → unit tests (Vitest, non-watch)
- `npm run lint` → `tsc --noEmit` (at minimum)

**web/**
- `npm run build` → static files in `web/dist/`
- `npm run dev` → Vite dev server on port 5173, proxying `/api` → `http://localhost:3000`
- `npm test` → unit tests (Vitest, non-watch)
- `npm run lint` → `tsc --noEmit` (at minimum)

## 3. Server runtime

Environment variables:

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port (Railway injects it) |
| `STATIC_DIR` | `../web/dist` relative to `server/` | Built frontend to serve; SPA fallback to `index.html` for non-`/api` GETs |
| `PREVIEW_PROVIDER` | `itunes` | `itunes` = resolve real 30s previews via iTunes Search API; `mock` = always return the built-in mock audio (used by tests / offline) |
| `ITUNES_COUNTRY` | `IL` | Storefront for iTunes lookups |

Production: one process serves both the API and the static frontend on `PORT`.

## 4. Data model & API

```ts
type Language = 'he' | 'en';
type Genre = 'pop' | 'rock' | 'light-rock' | 'classic-rock';

interface Song {
  id: number;          // unique, also the printed card number
  artist: string;      // as printed on the card (Hebrew script for Hebrew artists)
  title: string;
  year: number;        // ORIGINAL release year (not remaster / compilation)
  language: Language;
  genre: Genre;
}
```

**Catalog-only fields** (`server/data/songs.json`, internal; never sent to clients, `toPublicSong` strips them):

| Field | Type | Meaning |
|---|---|---|
| `artistKeys` | `string[]` (non-empty) | Every contributing artist, for the "prefer unused artists" rule (e.g. a featured artist not named in `artist`). |
| `artistAliases` | `string[]` (non-empty) | Other names a guess may use for the artist: a Latin spelling of a Hebrew name (`"Eyal Golan"`), a short form (`"Pink"`). Used only by `POST /api/songs/:id/guess`. |
| `titleAliases` | `string[]` (non-empty) | Other titles a guess may use (`"Nothing Compares to You"`). Used only by `POST /api/songs/:id/guess`. |
| `itunesTrackId` | positive integer | Pins the exact iTunes track. The preview/cover lookup then uses `https://itunes.apple.com/lookup?id=<id>&country=<ITUNES_COUNTRY>&entity=song` and takes that track's preview and artwork without any name matching. If the lookup returns no preview, the normal search is used. Use it for songs whose name search keeps failing (e.g. the "no match" warning below). |

To find an id: run `curl 'https://itunes.apple.com/search?term=<artist+title>&entity=song&country=IL&lang=he_il'` (URL-encode the term) and copy `trackId` of the right result; or open the song in Apple Music / iTunes on the web, where the track id is the `i=` query parameter of the song link (`…/album/…/1440833098?i=1440833100` → `1440833100`). Check it with the lookup URL above for the same country: it must return a `previewUrl`.

**Preview matching** (iTunes provider): the search term is `"<artist> <title>"`. Hebrew songs (`language: "he"`) are searched first with `lang=he_il` and, if nothing matches, once more without `lang`; English songs never send `lang`. A result must match artist and title (ignoring case, diacritics/niqqud, punctuation, `&` / `and` / Hebrew `ו` connectors). Hebrew songs only also accept transliterated results (one field matches and the other has no Hebrew letters, or all results come from one artistId and are fully Latin). When iTunes returns results but none matches, the server logs `[preview] no match for song <id> "<artist> – <title>": <first 3 results>`.

All endpoints return JSON. Errors: `{ "error": "<CODE>", "message": "..." }`.

| Method & path | Request | Response |
|---|---|---|
| `GET /api/health` | – | `200 { "status": "ok" }` |
| `GET /api/songs/stats` | – | `200 { "total": n, "byLanguage": { "he": n, "en": n }, "byDecade": { "1960": n, ... } }` |
| `POST /api/songs/next` | `{ "excludeIds": number[], "excludeArtists": string[], "languages": Language[] }` (all optional; `languages` default both) | `200 { "song": Song }` — random song not in `excludeIds`, **preferring** artists not in `excludeArtists`. Each `excludeArtists` entry is one dealt song (duplicates are meaningful, case-insensitive) and counts once for every contributor of its credit. A performer appears at most 2 times per game: songs with no dealt contributor come first, then those under the cap of 2, then (soft fallback) any remaining song. `404 { "error": "NO_SONGS_LEFT" }` if nothing remains. `400 { "error": "INVALID_REQUEST" }` on bad body. |
| `GET /api/songs/:id/preview` | – | `200 { "previewUrl": string \| null }` — 30-second audio URL. `null` if no preview could be found. `404 { "error": "SONG_NOT_FOUND" }` for unknown id. Results cached in memory. With `PREVIEW_PROVIDER=mock` always returns `"/api/mock-audio"`. |
| `GET /api/songs/:id/cover` | – | `200 { "coverUrl": string \| null }` — HTTPS URL of the song's cover picture (Apple artwork, upscaled to 300x300). `null` if none was found. `404 { "error": "SONG_NOT_FOUND" }` for unknown id. It reuses the same cached iTunes lookup as the preview (one search per song, never two). Only `https://*.mzstatic.com/` URLs are accepted; anything else becomes `null`. With `PREVIEW_PROVIDER=mock` always returns `"/api/mock-cover"`. **The preview endpoint's response does not change and never contains the cover.** |
| `POST /api/songs/:id/guess` | `{ "artist"?: string, "title"?: string }` (each at most 200 characters; a missing or blank field is a wrong guess for that field, not an error; an empty body is allowed) | `200 { "artistCorrect": boolean, "titleCorrect": boolean }` — checks a typed guess with tolerant matching (see §8). **The response never contains the song's artist, title, year or aliases** ("did you mean" is never offered). Stateless; the same id can be checked again. `404 { "error": "SONG_NOT_FOUND" }` for an unknown or non-numeric id. `400 { "error": "INVALID_REQUEST" }` if the body is not a JSON object, a field is not a string, or a field is too long. |
| `GET /api/mock-cover` | – | A small valid cover-like image (`image/svg+xml`, square). Always available. |
| `GET /api/mock-audio` | – | A short valid audio file (e.g. generated silent WAV, ~2 s), `Content-Type: audio/wav`. Always available. |

## 5. Design tokens & shared classes (`web/src/styles/theme.css`)

The UI designer owns this file. The frontend developer imports it once in `main.tsx` and uses these names. The designer may add more; these must exist.

CSS custom properties: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-neon-pink`, `--color-neon-cyan`, `--color-success`, `--color-error`, `--color-token` (gold, `#ffd166`: spending tokens), `--font-display`, `--font-body`, `--radius-card`, `--space-1` … `--space-6`.

Classes:
- Layout: `.app-shell`, `.screen`, `.screen__header`, `.screen__body`, `.screen__footer`
- Text: `.neon-title` (pink neon outline glow), `.neon-frame` (cyan glowing rounded frame)
- Buttons: `.btn`, `.btn--primary` (filled pink), `.btn--outline` (cyan outline), `.btn--ghost`, `.btn--icon`; disabled state via `[disabled]`
- Card: `.song-card`, `.song-card__artist`, `.song-card__year`, `.song-card__title`, `.song-card__deck`, `.song-card__number`, `.song-card--hidden`, `.song-card--small` (timeline size), and decade color modifiers `.song-card--d1950` `.song-card--d1960` … `.song-card--d2020`
- Timeline: `.timeline` (horizontal scroll), `.timeline-slot`, `.timeline-slot--selected`
- Speaker: `.speaker`, `.speaker--playing` (pulse animation)
- Feedback: `.result--correct`, `.result--wrong`
- Forms: `.input`, `.field`, `.chip`, `.chip--active`

## 6. Frontend behaviour & `data-testid` contract (used by e2e)

Single-page app, no router required (screen state in a store). Pass-and-play on one device. Language: Hebrew (RTL, `<html dir="rtl" lang="he">`) or English (LTR); **default English**; persisted in `localStorage` key `hitster.lang`. The timeline is always chronological left→right (`dir="ltr"` on `.timeline`) in both languages.

Game rules (implemented as pure functions in `web/src/game/`, unit-tested):
- 1–10 players, names unique & non-empty; target score 3–30, default 10.
- Start: each player receives one revealed song (via `/api/songs/next` with all ids used so far excluded and one `excludeArtists` entry per dealt song).
- Turn: fetch next song (excluding all ids used in the game and one `excludeArtists` entry per dealt song; the server allows at most 2 songs per performer per game, a 3rd only when nothing else is left), play its preview, player selects a slot, presses Reveal.
- Slot index `i` (0…n) = insert before the player's i-th card (cards sorted by year ascending); `n` = after the last card.
- Correct iff `prevYear <= song.year <= nextYear` (missing neighbour = unbounded). Correct → card added; wrong → card discarded.
- Score = number of cards in the timeline. When a player reaches the target after a reveal, pressing Next shows the winner screen.
- If preview is `null` or audio fails to load, the app silently fetches another song (that song id is still marked used).
- Clip plays max 30 s; audio starts only on a user tap (mobile autoplay rules).

Tokens, naming and bets (full rules: `docs/TOKENS_AND_BETS.md`). A **"Tokens & bets"** switch in Setup turns them on or off. It is on by default and remembered in `localStorage` key `hitster.tokensAndBets` (`"on"` / `"off"`). With it off, the game is exactly the rules above.
- **Tokens.** Every player starts with 1, up to 5; a token earned at 5 is lost. The only way to earn one: on your own turn, place the card on the right spot **and** name the artist or the title right (+1, also when both are right). A card alone, the starting card and a won bet give no token.
- **Naming.** After picking a spot, the current player may type the artist and the title. It is offered on every turn with the switch on, also when nobody can bet. The footer button is **Lock in** instead of Reveal whenever another player has a token (someone could bet). If both names are right, or nobody can bet, the card is revealed at once (when nobody can bet, Reveal checks the typed names first). Otherwise the betting round opens.
- **Betting.** First come, first served: any other player with a token, no try yet this turn, and a free spot left taps their name. They must name a part the current player did **not** get right (both open: the artist or the title, one right is enough; one open: only that part is asked) to bet; if not, they lose nothing. One try per turn; it is used once the names are checked (Cancel before Check keeps it). A bet costs 1 token and goes on a free spot of the current player's timeline: not the current player's spot, not an earlier bet. The round ends when someone taps Reveal. When nobody is left who may try, the screen says "All bets are in!" and waits for Reveal.
- **Settling.** Every spot is checked against the current player's timeline before the card is added. The current player right: they get the card, and +1 token if they also named the artist or the title right; a bettor on another right spot keeps their token. The current player wrong: no token for them, whatever they named; the earliest right bet wins the card into **the bettor's own** timeline (sorted by year) and gets the bet token back (no +1). Wrong bets lose their token. Nobody right: the card is out.
- **"We accept it".** On the result screen, when the current player's typed names were rejected and there were bets, the group can accept them: the turn is settled again as if no bets were placed and the names were right (bet tokens back, a won card taken back, +1 token for the current player only if their spot was right).
- **Skipping.** Before Lock in, a player with 3+ tokens can pay 3 to skip the song. The song is marked used, a new one plays, and the chosen spot is cleared.
- **Winner.** After each turn **every** player is checked against the target (a bettor can reach it on someone else's turn). When the game is ended early, the most cards wins; tied on cards, more tokens wins; still tied, they share the win.
- A saved game resumes in the middle of the betting round with the same bets and tries. A bettor whose names were not checked yet goes back to "Who's betting?" with the try unused.

`data-testid`s:

| Screen | testids |
|---|---|
| Home | `screen-home`, `btn-new-game`, `btn-settings` |
| Setup | `screen-setup`, `input-player-name`, `btn-add-player`, `player-item` (one per player, text = name), `btn-remove-player` (inside each `player-item`), `input-target-score`, `btn-start-game` (disabled until ≥1 player) |
| Turn | `screen-turn`, `current-player-name`, `hidden-card`, `btn-play` (starts / replays clip), `speaker`, `timeline`, `timeline-card` (each card, with `data-year`, `data-song-id`), `timeline-slot` (each slot, with `data-index`), `btn-reveal` (disabled until a slot is selected), `btn-scoreboard` |
| Result (same screen after reveal) | `revealed-card`, `card-artist`, `card-year`, `card-title`, `card-number`, `result-correct` or `result-wrong`, `btn-next` |
| Scoreboard (overlay) | `scoreboard`, `score-row` (each, with `data-player` and `data-score`), `btn-close-scoreboard` |
| Winner | `screen-winner`, `winner-name`, `btn-play-again` |
| Settings | `screen-settings`, `btn-lang-he`, `btn-lang-en`, `btn-songs-he`, `btn-songs-en`, `btn-songs-both`, `btn-back` |
| Errors | `error-banner` (e.g. server unreachable / no songs left), `btn-retry`, `btn-error-end-game` |
| Setup: tokens | `toggle-tokens-bets` (`role="switch"`, `aria-checked`) |
| Turn: tokens | `current-player-tokens` (header chip, with `data-tokens`), `token-meter` (each meter, with `data-tokens`) |
| Turn: skip | `btn-skip-song` (only with ≥ 3 tokens, before Lock in), `skip-confirm` (the sheet), `btn-confirm-skip`, `btn-keep-listening` |
| Turn: naming | `btn-name-it` (with `aria-expanded`), `input-guess-artist`, `input-guess-title`, `btn-lock-in` (disabled until a slot is selected; replaces `btn-reveal` when someone could bet), `btn-guess-retry` and `btn-continue-without-naming` (when the check fails) |
| Betting | `bet-panel` (the betting screen body), `bet-legend` (with `li[data-marker="pick"/"bet"/"mine"/"free"]`), `btn-bettor` (one per other player, with `data-player` = index; `aria-disabled="true"` when they cannot try), `bet-needs` (what a bettor must name: either part, or only the one still open), `btn-check-guess`, `bet-allowed`, `bet-denied`, `btn-bet-ok`, `btn-place-bet`, `btn-cancel-bet`, `bet-announce` (live region), `btn-reveal` (ends the round); on the timeline `data-owner` (player index) and, on taken slots, `data-marker` (`pick` / `bet`) and `data-initials` |
| Result: tokens | `turn-outcome`, `outcome-row` (with `data-outcome` = `won` / `right` / `lost` / `refunded` and `data-player` = indices), `result-named`, `result-stolen`, `guess-artist-result` and `guess-title-result` (with `data-correct`), `btn-accept-guess` |
| Scoreboard / Winner: tokens | `data-tokens` on `score-row` (switch on only), `won-on-tokens` (Winner, when tokens broke a tie) |
| Added during build | `btn-resume` (Home, only with a saved game), `screen-dealing` (while starting cards are dealt), `btn-end-game` (in scoreboard), `btn-home` (Winner), `btn-back` (also on Setup), `final-timeline` / `final-timeline-card` (Winner) |

Song-language setting persisted in `localStorage` key `hitster.songLanguages` (`"he"`, `"en"`, `"both"`; default `both`).

## 7. Cover picture on reveal

- The frontend calls `GET /api/songs/:id/cover` **only after the player presses Reveal** (when the result is shown). Never before: no request, no `<img>`, no preloading while the card is hidden.
- The cover is not stored in `localStorage`. If a saved game is resumed on the result screen, the cover is fetched again.
- Markup on the result screen, next to the revealed card: `<figure class="cover" data-testid="cover-wrap"><img class="cover__img" data-testid="cover-image" src=... alt="..." referrerpolicy="no-referrer"></figure>`.
- If `coverUrl` is `null`, the request fails, or the image fails to load, **no `cover-wrap` / `cover-image` element is rendered** (no broken-image icon, no empty gap). The result screen then looks exactly as before.
- No cover on the hidden card, the timeline cards, the scoreboard or the winner screen.
- The UI designer owns the `.cover` / `.cover__img` styles (`web/src/styles/theme.css`).

## 8. Artist/title guess

Server side (`server/src/guess.ts`), used by `POST /api/songs/:id/guess`. The game rules that use it are in `docs/TOKENS_AND_BETS.md`.

**Cleaning up before comparing** (both the guess and the catalog text):
- Case, accents and Hebrew vowel marks are ignored. `&`, `and` and Hebrew `ו` count as the same.
- Apostrophes and Hebrew geresh/gershayim are removed: `ד'אור` = `דאור`, `תש"ח` = `תשח`.
- Hebrew final letters count as the normal letter: `ך ם ן ף ץ` = `כ מ נ פ צ`.
- A standalone `n` counts as `and` ("Guns N' Roses"). A leading `the` is ignored, and for artists a leading `להקת` too.
- Spaces are ignored when comparing, so `acdc` = `AC/DC`.

**Typos** are allowed by the length of the expected text (spaces removed): up to 4 letters → none, up to 8 → 1, up to 14 → 2, up to 20 → 3, longer → 4. Swapping two neighbouring letters counts as one typo. A guess that is **exactly another artist or title in the catalog** is never accepted as a typo: "Believe" is not a typo of "Believer".

**Title is right** if the guess matches the full title, the title without its brackets, a bracketed part of at least three words (`"I Feel Good"` for *I Got You (I Feel Good)*), the title without a trailing `, Part 2`, or a `titleAliases` entry. Part of a title never counts.

**Artist is right** if the guess matches:
- the whole credit or an `artistAliases` entry; or
- the same contributors in any order (`"קושניר ודטנר"`); or
- only contributors that count on their own. Those are credited names of at least two words ("Bradley Cooper") and catalog `artistKeys` entries ("Bruno Mars"). One-word parts of a band name ("Earth", "חלב") never count alone, and any wrong extra name makes the guess wrong.

**Frontend rules:**
- Call the endpoint only when a player typed something and confirmed (Lock in or Check). Never while typing, and never with a datalist or suggestions.
- Before Reveal, show only what the rules need: "no bets" / "bets open" for the current player, "You can bet!" / "Not this time" for a bettor. Never which field was right.
