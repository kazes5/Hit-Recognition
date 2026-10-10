# Code Review Conclusions and Browser QA Plan

## Review approach

The review was split across four independent passes:

| Reviewer | Scope |
|---|---|
| Frontend | Game state and UI, persistence, API integration, internationalization, accessibility and responsive behavior |
| Backend | API contracts, validation, song selection and error handling |
| Pipeline | Candidate orchestration, lookup/cache paths, recovery and pipeline tests |
| Browser QA | Existing Playwright coverage, browser-test gaps and real-device checks |

The passes reviewed implementation and existing tests; they did not modify application code or run a fresh full test suite. Candidate findings were checked against source and tests before inclusion.

## Conclusions

### Overall

No high-confidence, release-blocking correctness defect was confirmed in the reviewed application paths. The frontend, API and browser suites have substantial coverage, especially for game rules, persistence, song selection, betting and API contracts. The review identified a small number of follow-ups, mainly around browser-level failure behavior, real-device verification and keeping the QA record current.

### Confirmed observations

1. **Playback is not required before revealing.** In `/home/runner/work/Hit-Recognition/Hit-Recognition/web/src/screens/GameScreen.tsx:112`, `canReveal` depends on being in the turn phase and having a selected slot, not on `hasPlayed`. This may be intentional, but it conflicts with the usual “listen, then place” flow. Decide whether this is allowed and document or enforce that decision. The older note in `/home/runner/work/Hit-Recognition/Hit-Recognition/docs/QA.md:239-240` also identifies it as a product decision.
2. **Some important UI failure paths have unit/API coverage but no matching end-to-end flow.** Unit tests cover server-unavailable and no-songs-left banners (`/home/runner/work/Hit-Recognition/Hit-Recognition/web/src/screens/GameScreen.test.tsx`); API tests cover catalog exhaustion (`/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/tests/api.spec.ts`). Add browser tests that exercise those failures through the game UI and verify recovery/end-game actions.
3. **The 30-second cutoff is tested at the audio-hook level, not in a real browser session.** `/home/runner/work/Hit-Recognition/Hit-Recognition/web/src/audio/useAudioPlayer.test.ts` covers the cutoff and the current implementation arms its timer on `playing` and suspends it on `waiting` (`/home/runner/work/Hit-Recognition/Hit-Recognition/web/src/audio/useAudioPlayer.ts:72-91`). A browser media test would verify the hook integrates correctly with browser playback; real-device playback remains a separate check.
4. **The QA bug register needs reconciliation with current code.** `/home/runner/work/Hit-Recognition/Hit-Recognition/docs/QA.md:181-255` contains dated findings and outcomes. Some historical findings have changed in the implementation—for example, the current audio cutoff behavior differs from the old Bug 8 description, and the scoreboard now isolates names with `<bdi>` (`/home/runner/work/Hit-Recognition/Hit-Recognition/web/src/components/Scoreboard.tsx:76`). Re-test and close or update old entries rather than treating the entire list as current.
5. **Production-dependent and physical-device behavior remains outside deterministic Chromium coverage.** The existing Playwright configuration uses mobile and desktop Chromium (`/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/playwright.config.ts:31-53`); iOS Safari audio/keyboard behavior and assistive-technology announcements need manual device checks.

### Existing strengths

- Deterministic browser tests cover setup, core placement and turn flow, hidden-answer behavior, no-repeat rules, token and betting scenarios, resumption, localization, difficulty, cover loading and responsive screenshots (`/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/tests/`).
- API contract tests verify public song fields, validation errors, difficulty fallback, preview/cover endpoints and catalog exhaustion (`/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/tests/api.spec.ts`).
- Request bodies are bounded at 256 KB and oversized requests have a test (`/home/runner/work/Hit-Recognition/Hit-Recognition/server/src/app.ts:55-57`, `/home/runner/work/Hit-Recognition/Hit-Recognition/server/test/app.test.ts:91-97`).
- The app has separate automated unit and browser test commands. The browser package documents `npm test`, `npm run test:mobile`, `npm run test:desktop` and `npm run smoke` (`/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/package.json:7-13`).

## Prioritized Playwright and browser QA plan

Build on the existing `/home/runner/work/Hit-Recognition/Hit-Recognition/e2e` package. Prefer deterministic `page.route` responses and the existing helpers in `/home/runner/work/Hit-Recognition/Hit-Recognition/e2e/tests/helpers.ts`; keep the normal suite isolated from production data and services.

### P1 — Exercise game-level recovery in Chromium

Add focused browser scenarios, in both desktop and mobile projects where practical:

- **Transient song-service failure:** fail a `/api/songs/next` request while a game is in progress; verify the error banner, retry action, preserved game state and successful continuation after the route recovers.
- **Catalog exhaustion:** return `404 NO_SONGS_LEFT` during a game; verify the user-facing message and that “End game” reaches the expected winner/result screen.
- **Guess request failure:** fail or delay `/api/songs/:id/guess`; verify the player is not left in an indefinite checking state and can recover or continue without revealing the answer.
- **Playback integration:** use a controlled browser media fixture to verify the 30-second limit begins after playback starts, buffering does not consume the clip, replay starts from the beginning, and playback stops on Reveal/Next. Retain the existing unit test as the fast deterministic check.

### P2 — Cover selected interaction boundaries

- Exercise early end with a tie on cards and tokens, including the shared-win tie, through the browser. The rules already have unit coverage; this checks the full game-to-winner UI.
- Add a keyboard-only pass through Setup, Turn, the scoreboard and a betting round. Check visible focus, dialog dismissal, usable button names, and announcements for changes in betting status.
- Keep a small viewport regression check for both English and Hebrew betting/result states (including 360×640), covering horizontal overflow and minimum touch-target dimensions.

### P3 — Manual real-device checks

Use `/home/runner/work/Hit-Recognition/Hit-Recognition/docs/QA.md:93-104` as the checklist source and record current outcomes:

- iOS Safari: first-tap audio playback, replay, playback stop behavior, virtual keyboard visibility of the focused input and primary action, and no input zoom.
- Android Chrome: the same keyboard/focus flows and Hebrew/English input direction.
- VoiceOver and TalkBack: announce screen changes, bettor eligibility/results and taken timeline slots with meaningful labels.
- Production smoke: run the existing read-only smoke suite against the deployed base URL; do not drain the song catalog or mutate production state.

## Completion criteria

- Browser tests assert user-visible outcomes and state preservation, not implementation details.
- Network failures and recovery are deterministic and do not depend on real Apple/iTunes responses.
- Mobile and desktop Playwright projects pass with the new cases; existing unit tests remain unchanged and passing.
- Manual device checks are recorded separately from Chromium results.
- The dated bug list in `/home/runner/work/Hit-Recognition/Hit-Recognition/docs/QA.md` is re-triaged against current code.
