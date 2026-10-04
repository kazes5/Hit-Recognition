# Hitster end-to-end tests (Playwright)

Independent npm package. Tests are written against `docs/CONTRACTS.md` §4 (API) and §6 (behaviour + `data-testid`s).

## Run

```bash
cd e2e
npm ci
npm run e2e:prepare   # npm ci + npm run build in ../server and ../web
npm test              # starts the production server on :3300 (PREVIEW_PROVIDER=mock) and runs all projects
npm run lint          # tsc --noEmit
```

- `npm run test:mobile` / `npm run test:desktop` — one project only.
- `npm run report` — open the HTML report (`e2e/playwright-report/`, gitignored).
- Against an already-running server or a deployment: `E2E_BASE_URL=https://… npm test` (the built-in web server is then skipped). The suite assumes `PREVIEW_PROVIDER=mock` for the preview API tests.

The web server command is
`cd ../server && PREVIEW_PROVIDER=mock PORT=3300 STATIC_DIR=../web/dist node dist/index.js`, waiting on `/api/health`;
so `server/dist/index.js` and `web/dist/index.html` must exist (`npm run e2e:prepare`).

Chromium comes from `PLAYWRIGHT_BROWSERS_PATH` (`@playwright/test` is pinned to 1.56.1 = chromium-1194). Elsewhere run `npx playwright install chromium` once.

## Projects

| Project | Device |
|---|---|
| `mobile-chromium` | Pixel 7 profile, 390×844, touch |
| `desktop-chromium` | Desktop Chrome, 1280×800 (also runs `api.spec.ts`) |

Chromium is launched with `--autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream`.

## Specs (`tests/`)

| Spec | What it covers |
|---|---|
| `api.spec.ts` | health, stats shape, `next` exclusion / artist preference / languages / 400s, mock preview, mock audio WAV, `guess` (two booleans only, 404/400), 404s, SPA fallback |
| `setup.spec.ts` | home → setup, add/remove players, empty/duplicate/11th player rejected, target score |
| `gameplay.spec.ts` | classic rules (the "Tokens & bets" switch turned off), deterministic games via `page.route` song queue: hidden card leaks nothing, reveal gating, correct/wrong, rotation, scoreboard `data-score`, winner, equal-year rule, null preview → auto-skip |
| `betting.spec.ts` | tokens, naming and bets (switch on): tokens 1 → +1 per card → max 5, naming both blocks bets (real `/guess`), bettor allowed/denied, any order + earlier right bet wins, won bet goes to the bettor's timeline, wrong bets lose a token, taken spots, answer not in the page, empty fields for the next bettor, skip for 3 tokens, reload mid-betting, "We accept it", Hebrew 360×640, no `/guess` call unless something was typed |
| `no-repeat.spec.ts` | real server: no song repeats, at most 2 songs per artist, `excludeIds` grow and `excludeArtists` holds one entry per dealt song |
| `i18n.spec.ts` | Hebrew RTL (`<html dir="rtl" lang="he">`), timeline stays `dir="ltr"`, persistence, song-language setting |
| `resume.spec.ts` | reload mid-game → `btn-resume` restores state (cards and tokens) |
| `responsive.spec.ts` | no horizontal scroll, buttons ≥ 44px (mobile), full-page screenshots → `screenshots/` (01–08 the main screens; 09–13 naming, who's betting, a bettor's naming, a won bet, the skip sheet) |

Screenshots in `screenshots/` are regenerated on every run and committed for design review.

`helpers.ts` plays a turn either way: `placeAndReveal` taps Reveal when nobody can bet, or Lock in (with optional `name` and `bets`) and then Reveal from the betting round. `startGame(..., { tokensAndBets: false })` turns the Setup switch off. `mockGuess` answers `/api/songs/:id/guess` for the fake songs.
