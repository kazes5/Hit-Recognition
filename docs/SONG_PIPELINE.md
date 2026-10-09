# Song pipeline: execution plan

**Goal:** grow the song list from 667 to about 1,800 songs (Hebrew from 267 to about 700, English from 400 to about 1,100), quickly and with correct years, using a repeatable, mostly automatic process. The Hebrew target is an estimate; it is confirmed after the first extractor run (task 3.2).

**Audience:** the development team (3 developers) and the integration engineer who will build and run it.

**Status:** Phase 0 done (2026-10-09). Work happens on branch `song-pipeline`. Built so far: the source test (`poc/source-test.mjs`, workflow `song-source-test.yml`, run by hand from the Actions tab).

---

## 1. Owner decisions (2026-10-09)

| # | Decision |
|---|---|
| D1 | **No genre selection in the game.** No genre filter in Setup, no themed decks. |
| D2 | **No per-performer limit in the song list.** The limit of **2 songs per performer in one game** stays. |
| D3 | **Genre is never shown to players.** It is internal data, used only to balance and report on the catalog. |
| D4 | **Genres:** pop, rock, light rock, classic rock (existing), plus **classic Hebrew, army bands, hip-hop & rap, soul & R&B, disco & dance**. |
| D5 | **No Mizrahi and no Jewish/Hasidic songs are added.** These are not genres, and new batches leave such songs out. Songs of these styles already in the catalog stay, labelled pop. |
| D6 | **Spotify and Apple Music login are dropped** (milestone 8). Apple's free 30-second previews stay the only audio source. |
| D7 | **Only the top 20 per year** of each annual hit parade or year-end chart are candidates. |
| D9 | **Every song gets a difficulty** (1 easy, 2 medium, 3 hard). New songs: calculated from how famous the song is and its chart place (task 3.9). **The 667 songs already in the catalog are all easy (1).** |
| D10 | **Players choose the difficulty in Settings:** Easy / Medium / Hard (task 1.6). |
| D8 | **Year fixes are automatic when all three trusted sources agree** (Wikipedia, Wikidata, MusicBrainz). Each fix is listed in the PR report. |

---

## 2. Evidence: the source test

Run on GitHub Actions, 2026-10-09, branch `musicbrainz-poc`, script `poc/source-test.mjs`. It checked 60 songs whose years were already verified by hand (30 Hebrew, 30 English, spread over all decades).

| Source | Hebrew: found | Hebrew: year exact | English: found | English: year exact |
|---|---|---|---|---|
| Wikidata (publication date, P577) | 26/30 | 96% (100% within ±1) | 28/30 | 86% |
| Wikipedia infobox | 19/30 | 100% | 30/30 | 93% |
| MusicBrainz (artist first, then earliest recording) | 28/30 | 79% | 29/30 | 69% |
| Apple store date | 27/30 | 78% | 30/30 | 83% |
| **Apple preview exists** | **27/30** | | **30/30** | |

**Year rule tested:** accept a year only when at least two of Wikipedia, Wikidata and MusicBrainz give exactly that year; otherwise flag it for a person.

| | Accepted automatically | Correct among accepted | Flagged for a person |
|---|---|---|---|
| Hebrew | 27/30 | 26/27 | 3 |
| English | 28/30 | 26/28 | 2 |

**Lessons:**
- **Wrong years explained:** of the 3 accepted-but-wrong years, 2 came from bugs in the test (it read the "recorded" field and a re-release). The third is the known Hebrew trap: *ערב של שושנים* was first recorded in 1957, but the famous version is from 1958.
- **Store dates can't be trusted:** Apple, Deezer and Spotify all give the date of the edition they sell (remasters, compilations).
- **Hebrew Wikipedia:** the test only read a year from 19 of 30 Hebrew pages, because it didn't know all the Hebrew infobox field names.
- **Rejected sources:**
  - Spotify, because new apps lose previews and the popularity data (2024–2026).
  - Deezer, not needed since Apple covers previews.
  - Discogs, because it needs a token.
- **Possible errors in the current catalog:** the sources point to an earlier album release for *The Look* (Roxette, 1988 vs 1989), *This Love* (Maroon 5, 2002 vs 2004) and *נגמר* (Idan Amedi, 2012 vs 2013).

---

## 3. Improvements over the first implementation

Rounds 9.1 (2026-10-03 to 2026-10-05) added songs by research agents, fact-checking agents and a merge script kept in a temporary folder.

| Area | First implementation | New process | Gain |
|---|---|---|---|
| Where candidates come from | Researchers' memory, then a web search per song | **Published hit lists**: annual Hebrew hit parades (Reshet Gimel 1969–, Galgalatz 1995–), Israel Song Festival, Eurovision and Kdam Eurovision, army-band lists, Billboard Year-End 1955–2025 | Candidates come in with chart year and rank; "is it famous?" is answered by the chart, not by opinion |
| Year check | Two web searches per song (researcher plus fact-checker), 100% manual | **Automatic 2-of-3 rule** (Wikipedia, Wikidata, MusicBrainz) | About 90% of songs need no manual check (source test) |
| Old Hebrew songs | Same as everything else | **Always checked by a person** before 1970 | Catches the "first recording vs famous recording" trap |
| Previews | Unknown until live; songs without one are silently skipped in games | **Apple preview checked before adding**; the track id is stored (`itunesTrackId`) | No dead songs; the game plays the right recording |
| Duplicates and limits | Ad-hoc script in a temporary folder, lost when the session ends | **Merge tool in the repo**, with tests | Repeatable, reviewable |
| Per-performer limit | At most 10 songs per performer in the list | **No limit in the list**; 2 per game kept | Big performers (Arik Einstein, Shlomo Artzi, the Beatles) can be fully covered |
| Genres | 4 genres; 78% of Hebrew songs were "pop" | **9 genres**, set mostly per performer, internal only | Lets us measure and balance the catalog |
| Batch size | About 90 songs per round, stopped by usage limits | **About 300 songs per batch**; network work runs in GitHub Actions and can be restarted | 3 times larger batches, fewer lost runs |
| Network access | The development sandbox can't reach any music data source | **All lookups run on GitHub's runners** | No environment changes needed |
| Traceability | Sources in temporary files | **Report per batch** (sources, flags, decisions) kept with the PR | Every year can be traced back |
| Existing catalog | Never re-checked | **The same check runs on the current 667 songs** | Finds old mistakes (3 candidates already) |

---

## 4. Team and roles

| Role | Owns |
|---|---|
| **Integration engineer (IE)** | GitHub Actions workflows; source adapters (Wikipedia/MediaWiki API, Wikidata, MusicBrainz, iTunes); rate limits, retries and caching; batch reports; keeping runs restartable |
| **Developer A – catalog and server** | Song schema, validation, genres, removing the list limit, public API change, server tests |
| **Developer B – pipeline logic** | Candidate extraction from hit lists, normalisation and duplicate matching, year rule, genre assignment, merge tool |
| **Developer C – quality and test** | Test fixtures, regression of the game (2-per-game rule, song picking with a big catalog), end-to-end tests, performance |
| **Research team (agents)** | Resolving flagged songs, labelling unknown performers' genres, owner-facing review lists |
| **Owner** | Approves decisions, reviews and merges each batch PR |

---

## 5. Phases

Estimates are in working days for one person. "Done when" is the acceptance test for each task.

### Phase 0 – Preparation (0.5 day, IE + owner) ✅ Done 2026-10-09
- **0.1** PR #10 (drop milestone 8) stays open and unmerged (owner). This work starts from `main` without it. Both change the Settings screen (PR #10 removes the music-source row, task 1.6 adds Difficulty), so whichever merges second needs a small conflict fix.
- **0.2** Branch `song-pipeline` created from `main` (1b12abd). The source test and this plan were moved over from `musicbrainz-poc`. The workflow is now `song-source-test.yml` and runs only by hand (`workflow_dispatch`). The first MusicBrainz-only test script was removed (the source test replaces it).
- **0.3** All questions answered (section 9).
- **Done when:** the branch exists and the questions are answered. ✅

### Phase 1 – Catalog and server changes (2 days, Dev A + Dev C)
- **1.1 Genres.**
  - Add `classic-hebrew`, `army-bands`, `hiphop`, `soul-rnb`, `disco-dance` to `GENRES` in `server/src/types.ts`, and update the error text in `server/src/catalog.ts`.
  - Update the genre lists in `web/src/game/types.ts`, `e2e/tests/helpers.ts`, `e2e/tests/api.spec.ts` and `docs/CONTRACTS.md`.
  - *Done when* the catalog loads with every new genre and the tests list all 9.
- **1.2 Genre stays internal (D3).**
  - Remove `genre` from the public song in `toPublicSong` (`server/src/types.ts`) and from the web `Song` type.
  - Update CONTRACTS §4 and the API end-to-end test.
  - *Done when* no API response and no screen contains a genre; all web and end-to-end tests pass.
- **1.3 No per-performer limit in the list (D2).**
  - Remove the "at most 10 songs per artist" test (`server/test/songs-data.test.ts`).
  - Update the merge rules, PLAN §9.4 and QA.
  - Keep `MAX_SONGS_PER_ARTIST_IN_GAME = 2` (`server/src/selection.ts`) and its tests.
  - *Done when* a test catalog with 25 songs by one performer passes validation, and a simulated game never deals that performer more than twice while other songs are left.
- **1.4 New optional song fields.**
  - Record provenance in a separate file, `pipeline/sources.json` (song id → year sources, chart, decision), so `songs.json` stays small. Only `itunesTrackId` (already supported) goes into `songs.json`.
  - *Done when* the schema and its tests are in place.
- **1.5 Performance with 2,000+ songs.**
  - Measure song picking and the catalog tests with a synthetic 3,000-song catalog.
  - **Measured (Phase 1):** picking a song takes about 1.7 ms with 3,000 songs; the server tests take 6–7 s today.
  - **To do before the catalog grows (Phase 3):** the alias test in `songs-data.test.ts` compares every pair of songs: about 4.5 s today, about 90 s at 3,000 songs. Index the name matching so it stays under 10 s. Until then it has a 30 s timeout.
  - **Request size:** about 22 bytes per dealt song, so the old 64 KB limit fit only about 2,900 songs. Raised to 256 KB (about 11,000) in Phase 1.
  - *Done when* picking a song stays under 20 ms and the server tests stay under 30 s.

- **1.6 Difficulty field and the Settings choice (D9, D10).** Dev A (server), Dev C (web and tests).
  - **Catalog:** add `difficulty` (1, 2 or 3) to the song schema and validation, and set all 667 current songs to 1.
  - **Server:** `POST /api/songs/next` takes an optional `maxDifficulty` (1–3, default 3). Easy = level 1 only, Medium = levels 1–2, Hard = all levels. The song's difficulty stays out of the public song, like genre (1.2).
  - **Too few songs:** if the filter leaves no unused song, the server falls back to the next level up rather than ending the game. (The song-language filter has no fallback: when a language runs out, the game ends with "no songs left", as before.)
  - **Settings screen:** a new "Difficulty" chip group (Easy / Medium / Hard; קל / בינוני / קשה), saved on the phone like the song-language choice. **Default: Easy**, so today's games play exactly as now.
  - **Docs:** CONTRACTS (API and test ids), DESIGN (Settings), QA (new checks).
  - *Done when:* server tests cover the filter and the fallback; a web test covers the setting and that it survives a reload; an end-to-end test shows that an Easy game only gets level-1 songs; the settings screenshots are updated.

### Phase 2 – Genre relabel of the current 667 songs (1.5 days, Dev B + research team)
- **2.1** Create `pipeline/artist-genres.json`: performer → default genre, for every performer in the catalog (about 490).
- **2.2** Create `pipeline/genre-overrides.json`: song id → genre, for songs that differ from their performer's default.
- **2.3** A script applies both files to `songs.json`. A second agent reviews the result, and the owner gets a change list (old → new genre).
- **Rules:**
  - Army bands outranks classic Hebrew.
  - Songs already in the catalog in Mizrahi or Jewish styles are pop (D5).
  - When unsure, the genre is pop.
- **2.4 Excluded performers.** The same file marks performers whose songs are Mizrahi or Jewish/Hasidic with `"exclude": true`. The pipeline uses this to leave their songs out of new batches (D5). The owner reviews this list once.
- **Done when** every song has one of the 9 genres, the owner has approved the change list, and the tests pass.

### Phase 3 – The pipeline (6–8 days, IE + Dev B, Dev C for tests)
All network work runs in GitHub Actions (`workflow_dispatch` with inputs). The code lives in `pipeline/`, a Node package with its own tests, and uses no secrets.

- **3.1 Source adapters (IE).** One module per source, each with retries, `User-Agent`, rate limits and an on-disk cache stored with `actions/cache`, so a restarted run doesn't repeat requests.
  - **Wikipedia (he, en):** MediaWiki API (search, page wikitext, `wikibase_item`). Infobox year parser that knows the Hebrew field names and ignores "recorded" and re-release fields (the source-test bugs).
  - **Wikidata:** earliest P577 of the song item, via `Special:EntityData`.
  - **MusicBrainz:** artist MBID (Hebrew name and English aliases), then the earliest `first-release-date` among that artist's recordings. Skip live, remix, demo and karaoke versions. 1 request per second, retry on 503.
  - **iTunes:** preview check and `trackId`; `country=IL` for Hebrew songs, `US` for English. About 20 requests per minute, retry on 429. The store date is used only as an upper bound.
  - *Done when* each adapter has unit tests on recorded responses (fixtures), and the 60-song source test, re-run through the adapters, scores at least as well as in section 2.
- **3.2 Candidate extractors (Dev B, IE for fetching).**
  - **Hebrew annual hit parades:** the Reshet Gimel and Galgalatz pages on Hebrew Wikipedia, **top 20 per year only** (D7). Output: song, performer, chart year, rank.
  - **Israel Song Festival, Eurovision and Kdam Eurovision, army-band lists:** event year and song.
  - **Billboard Year-End Hot 100 (English Wikipedia),** 1955–2025, **top 20 per year only** (D7).
  - *Done when* each extractor has fixture tests, and one full run lists all its candidates with no parsing errors in the report. That run sets the final targets: the expected maximum is about 1,700 Hebrew chart slots (Reshet Gimel 1969–2025 and Galgalatz 1995–2025, top 20 each, before repeats are removed) and 1,420 English slots (71 years × 20).
- **3.3 Matching and duplicates (Dev B).**
  - Move the merge logic from round 9.1 into `pipeline/merge.mjs`.
  - It matches spellings (Hebrew niqqud, punctuation, "ו"/"&" in credits, aliases) against the catalog and within the batch, and enforces the 2-per-game data needs (`artistKeys` for collaborations).
  - *Done when* tests cover the duplicate cases from round 9.1 (e.g. "Hound dog" vs "Hound Dog", Odeya's *בן אדם* vs Yardena Arazi's *בן אדם*, which are different songs).
- **3.4 Year rule (Dev B).**
  - Accept when two of the three trusted sources give exactly the same year.
  - The year must be no later than the chart year and at most 2 years before it.
  - Always flag: Hebrew songs before 1970, sources that disagree, Apple-only years, and missing years.
  - *Done when* it reproduces the source-test results and has unit tests for each flag reason.
- **3.5 Genre and exclusion (Dev B).**
  - Use `artist-genres.json` and the overrides; a performer that isn't in the map is flagged for labelling.
  - Leave out songs by performers marked `exclude` (D5); a new performer whose style may be Mizrahi or Jewish/Hasidic is flagged for a person, not added.
  - The report counts the songs left out, by reason.
  - Event hints are used: army-band list → `army-bands`; Israel Song Festival before 1980 → `classic-hebrew`, unless the performer's genre says otherwise.
- **3.6 Fame and selection (Dev B).**
  - Only top-20 chart entries are candidates (D7); within a batch, higher-ranked songs go first.
  - Every batch keeps a balance of decades and languages; the report shows the counts.
- **3.7 Workflow and report (IE).**
  - Workflow `song-batch.yml`, with inputs: language, year range, source list and batch size (default 300).
  - Outputs (artifact):
    - `batch.json`: songs ready to merge;
    - `flagged.csv`: songs needing a person, with the reason and each source's year;
    - `report.md`: counts, flags and preview misses, also written to the job summary.
  - *Done when* a run for 1990–1999 Hebrew finishes in under 30 minutes, can be restarted without repeating requests (cache), and the report is readable by the owner.
- **3.9 Difficulty (Dev B, IE for the fame lookups).** Every song gets `difficulty` (1 easy, 2 medium, 3 hard) in `songs.json`; the inputs are kept in `pipeline/sources.json`.
  - **Existing songs:** the 667 songs in the catalog before this project (ids up to 669) are set to 1 (easy) once, in Phase 1, and are never recalculated (D9).
  - **New songs:** calculated as below, compared only with other new songs.
  - **Chart place:** the song's best rank in its year's chart (1–20), from the extractors (3.2).
  - **Fame today:** Wikipedia page views of the song's article over the last 12 months (Wikimedia pageviews API, free, no key; he.wikipedia for Hebrew songs, en.wikipedia for English songs), plus Deezer's popularity `rank` as a second signal.
  - **Formula:**
    - Each input becomes a percentile among the new songs **of the same language** (0 = least, 1 = most), so Hebrew songs are not all "hard" next to global English hits.
    - `fame` = the average of the page-view and Deezer percentiles, using whichever exists.
    - `chart` = (21 − best rank) / 20.
    - `score` = 0.6 × fame + 0.4 × chart. Fame weighs more because it shows whether people still know the song.
    - A song with only one input uses that input alone. A song with neither gets difficulty 2 and is listed in the report.
    - Difficulty is set by thirds of `score` among the new songs of each language: top third 1, middle 2, bottom 3.
  - **Recalculation:** percentiles depend on all new songs, so difficulty is recalculated for the new songs at the end of each batch. Changes are listed in the report.
  - **Before building:** add Wikipedia page views and a fixed Deezer search to the source test (`poc/source-test.mjs`), and check the 60 songs give a sensible spread (for example, *ירושלים של זהב* and *Wonderwall* come out easy).
  - *Done when:* every song has a difficulty, the new songs spread about a third per level in each language, and the owner agrees with a sample of 30 new songs (10 per level).
- **3.8 Re-check the existing catalog (IE + Dev B).
  - Run the year rule and the preview check on the current 667 songs.
  - **When all three trusted sources agree on a different year, the year is fixed automatically** (D8), and the fix is listed in the PR report (song, old year, new year, sources).
  - Exception: Hebrew songs from before 1970 are not fixed automatically (the first-recording trap of section 2); their disagreements go to a person.
  - Other disagreements (starting with the 3 found in section 2) and songs without a preview go to the research team, like flagged batch songs.
  - *Done when* the fixes are merged and the remaining list is resolved.

### Phase 4 – Batches (about 5 batches of 300, 1–2 days each, Dev B + research team + owner)
For each batch:
1. Run `song-batch.yml` for the next slice of years and languages.
2. The research team resolves `flagged.csv`. One agent checks each flagged song with web searches, a second confirms. Decisions are written to `pipeline/sources.json`.
3. Merge with `pipeline/merge.mjs`, then run all server, web and end-to-end tests.
4. Open one PR per batch, with `report.md` in the description and the full song list in a collapsed section.
5. The owner reviews and merges.

- **Order:**
  1. Hebrew 1969–1999 (parades);
  2. Hebrew 2000–2025;
  3. Hebrew festivals and army bands (1960s–70s);
  4. English 1955–1989;
  5. English 1990–2025.
- **Targets:** about 700 Hebrew and about 1,100 English songs in total, adjusted after the first extractor run (3.2).
- **Done when:** the catalog reaches the targets, every song has a preview, every year is accepted or human-checked, and all tests pass.

### Phase 5 – Hardening and handover (1 day, Dev C + IE)
- A `README` for `pipeline/`: how to run a batch, read the report and resolve flags.
- Re-run the performance checks (1.5) at the final size.
- Update `PLAN.md` (new step 9.7), `docs/CONTRACTS.md` and `docs/QA.md`.
- Delete branch `musicbrainz-poc` (its contents moved to `song-pipeline` in Phase 0).

---

## 6. Schedule

| Phase | Effort | Can run in parallel with |
|---|---|---|
| 0 Preparation | 0.5 day | – |
| 1 Catalog and server (with the difficulty setting) | 3.5 days | 3.1 |
| 2 Genre relabel | 1.5 days | 3.1–3.3 |
| 3 Pipeline | 6–8 days | 1, 2 |
| 4 Batches (×5) | 5–10 days | – |
| 5 Hardening | 1 day | – |

**Total:** about 3–4 weeks of calendar time with the team working in parallel, most of it in phases 3 and 4. Top-20-only candidates (D7) make each batch smaller to check, so phase 4 may need 4 batches instead of 5.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Hebrew Wikipedia pages vary in layout (infobox fields, chart tables) | Fixture tests per page type; the report lists every page it couldn't parse |
| Song year vs famous recording year (older Hebrew songs) | Hebrew songs before 1970 are always checked by a person |
| Album vs single year (released late in one year, a hit the next) | The existing rule stays: first release (single, radio or album, whichever came first) |
| Rate limits (MusicBrainz 1 request per second, iTunes about 20 per minute) | Caching, batches of 300, runs that can be restarted |
| Free sources change or block GitHub runners | One adapter per source; the rule works with 2 of 3 sources; a failure shows in the report, not as silent data |
| Wikipedia and Wikidata aren't fully independent (Wikidata is often filled from Wikipedia) | MusicBrainz is the third voice; Hebrew pre-1970 is checked by people; the owner reviews the flag list |
| Wrong genre labels | Genre is internal only (D3), so a wrong label doesn't affect players; it's fixed through the overrides file |
| No per-performer limit in the list, so a few big performers dominate the catalog | The 2-per-game rule keeps games varied; the batch report shows the top performers |
| Excluding Mizrahi and Jewish/Hasidic songs leaves gaps in some Hebrew years (the parades of the 2010s–2020s are full of Mizrahi pop) | The report shows songs per year; the gap is filled from other Hebrew chart entries in the top 20, not by lowering the bar |
| Style boundaries are fuzzy (pop vs Mizrahi, e.g. Omer Adam, Static & Ben El) | One owner-reviewed performer list (2.4); doubtful new performers are flagged, never added automatically |
| An automatic year fix is wrong (all three sources repeat the same mistake) | Every fix is listed in the PR report for the owner; old Hebrew songs (before 1970) are never fixed automatically |

---

## 8. Done when (whole project)

- About 1,800 songs (about 700 Hebrew, about 1,100 English; final targets set after 3.2), each with a preview and a year that was either accepted by the rule or checked by a person.
- Every song has a difficulty (1–3): the original 667 are easy, new songs are calculated by task 3.9. Players can choose Easy / Medium / Hard in Settings.
- All 9 genres in use internally; no genre visible in the game or the API.
- No per-performer limit in the list; still at most 2 per performer per game.
- The pipeline runs from GitHub with one button, and its report is understandable to the owner.
- All server, web and end-to-end tests pass, and the performance targets of 1.5 are met.

---

## 9. Questions answered by the owner (2026-10-09)

- **Q1 – Mizrahi and Jewish/Hasidic songs:** not added (D5).
- **Q2 – Fame:** top 20 per year only (D7).
- **Q3 – Year fixes in the current catalog:** fixed automatically when all three trusted sources agree (D8).

- **Q4 – Difficulty:** every song gets a difficulty from fame and chart place (D9).

- **Q5 – Difficulty in the game:** a choice in Settings (D10). The existing songs are all easy (D9).

No open questions remain. The next step is Phase 0.
