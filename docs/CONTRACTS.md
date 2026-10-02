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

All endpoints return JSON. Errors: `{ "error": "<CODE>", "message": "..." }`.

| Method & path | Request | Response |
|---|---|---|
| `GET /api/health` | – | `200 { "status": "ok" }` |
| `GET /api/songs/stats` | – | `200 { "total": n, "byLanguage": { "he": n, "en": n }, "byDecade": { "1960": n, ... } }` |
| `POST /api/songs/next` | `{ "excludeIds": number[], "excludeArtists": string[], "languages": Language[] }` (all optional; `languages` default both) | `200 { "song": Song }` — random song not in `excludeIds`, **preferring** artists not in `excludeArtists` (case-insensitive); falls back to a repeated artist only if no other song is left. `404 { "error": "NO_SONGS_LEFT" }` if nothing remains. `400 { "error": "INVALID_REQUEST" }` on bad body. |
| `GET /api/songs/:id/preview` | – | `200 { "previewUrl": string \| null }` — 30-second audio URL. `null` if no preview could be found. `404 { "error": "SONG_NOT_FOUND" }` for unknown id. Results cached in memory. With `PREVIEW_PROVIDER=mock` always returns `"/api/mock-audio"`. |
| `GET /api/mock-audio` | – | A short valid audio file (e.g. generated silent WAV, ~2 s), `Content-Type: audio/wav`. Always available. |

## 5. Design tokens & shared classes (`web/src/styles/theme.css`)

The UI designer owns this file. The frontend developer imports it once in `main.tsx` and uses these names. The designer may add more; these must exist.

CSS custom properties: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-neon-pink`, `--color-neon-cyan`, `--color-success`, `--color-error`, `--font-display`, `--font-body`, `--radius-card`, `--space-1` … `--space-6`.

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
- Start: each player receives one revealed song (via `/api/songs/next` with all ids/artists used so far excluded).
- Turn: fetch next song (excluding all ids used in the game and preferring unused artists), play its preview, player selects a slot, presses Reveal.
- Slot index `i` (0…n) = insert before the player's i-th card (cards sorted by year ascending); `n` = after the last card.
- Correct iff `prevYear <= song.year <= nextYear` (missing neighbour = unbounded). Correct → card added; wrong → card discarded.
- Score = number of cards in the timeline. When a player reaches the target after a reveal, pressing Next shows the winner screen.
- If preview is `null` or audio fails to load, the app silently fetches another song (that song id is still marked used).
- Clip plays max 30 s; audio starts only on a user tap (mobile autoplay rules).

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
| Added during build | `btn-resume` (Home, only with a saved game), `screen-dealing` (while starting cards are dealt), `btn-end-game` (in scoreboard), `btn-home` (Winner), `btn-back` (also on Setup), `final-timeline` / `final-timeline-card` (Winner) |

Song-language setting persisted in `localStorage` key `hitster.songLanguages` (`"he"`, `"en"`, `"both"`; default `both`).
