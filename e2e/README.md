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
| `api.spec.ts` | health, stats shape, `next` exclusion / artist preference / languages / 400s, mock preview, mock audio WAV, 404s, SPA fallback |
| `setup.spec.ts` | home → setup, add/remove players, empty/duplicate/11th player rejected, target score |
| `gameplay.spec.ts` | deterministic games via `page.route` song queue: hidden card leaks nothing, reveal gating, correct/wrong, rotation, scoreboard `data-score`, winner, equal-year rule, null preview → auto-skip |
| `no-repeat.spec.ts` | real server: no song repeats, at most 2 songs per artist, `excludeIds` grow and `excludeArtists` holds one entry per dealt song |
| `i18n.spec.ts` | Hebrew RTL (`<html dir="rtl" lang="he">`), timeline stays `dir="ltr"`, persistence, song-language setting |
| `resume.spec.ts` | reload mid-game → `btn-resume` restores state |
| `responsive.spec.ts` | no horizontal scroll, buttons ≥ 44px (mobile), full-page screenshots → `screenshots/` |

Screenshots in `screenshots/` are regenerated on every run and committed for design review.
