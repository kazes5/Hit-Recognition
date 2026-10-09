# Pipeline interfaces (Phase 3)

Agreed between the three Phase 3 work streams. Node 20, ESM, no dependencies, tests with `node:test`
(`cd pipeline && node --test`). The sandbox cannot reach any music host; network code is tested on
fixtures and run live from GitHub Actions.

## Candidate (output of the extractors, `pipeline/candidates/`)

```js
{
  source: 'reshet-gimel' | 'galgalatz' | 'israel-song-festival' | 'eurovision' | 'billboard',
  chartYear: 1987,        // the chart's (civil) year; for Hebrew-calendar charts, the year it ended in
  rank: 3,                // 1..20 (top 20 only, decision D7); festivals/Eurovision: placing, or 1 for the entry
  artist: 'יהודית רביץ',  // as written on the source page
  title: 'באה מאהבה',
  language: 'he' | 'en',
  page: 'https://he.wikipedia.org/wiki/…' // the list page it came from
}
```

`pipeline/candidates/index.mjs` exports `extract({ sources, fromYear, toYear, top = 20, getJson? }) → Promise<{ candidates, problems }>`;
`problems` lists pages or rows it could not parse (`{ page, reason }`).

## Logic (`pipeline/build/`), pure functions, no network

- `match.mjs` `matchCatalog(candidates, catalogSongs) → { fresh, existing, merged }`
  - `merged`: the same song from several charts or years becomes one candidate, with `bestRank`, `firstChartYear` and `charts: [{ source, chartYear, rank }]`.
  - `existing`: candidates already in the catalog, also under another spelling, as `{ candidate, songId }`.
  - `fresh`: the rest.
- `genre.mjs` `assignGenre(candidate, artistGenres) → { genre, excluded, flag }`, where `flag` is `'unknown-performer'` or null. Collaboration credits: excluded if any member is excluded.
- `difficulty.mjs` `computeDifficulty(newSongs) → Map<id, { difficulty: 1|2|3, score, fame, chart }>`.
  - Input per song: `{ id, language, bestRank?, pageViews?, deezerRank? }`.
  - The formula is SONG_PIPELINE task 3.9. Only new songs (id > 669) are scored; ids ≤ 669 are always 1.
- `catalog-io.mjs` `readCatalog()`, `writeCatalog(songs)`. Writes the exact `songs.json` format (one compact object per line).
- `merge.mjs` `addSongs(catalog, accepted) → catalog`. Assigns the next ids, keeps key order (`id, artist, title, year, language, genre, difficulty, …aliases, itunesTrackId`), and refuses duplicates.

## Orchestration (`pipeline/batch.mjs`, `pipeline/recheck.mjs`)

- **Batch:** `node pipeline/batch.mjs --request pipeline/batch-request.json --out .pipeline-out`.
- **Outputs:**
  - `batch.json`: accepted songs, catalog shape, ready for `merge.mjs`;
  - `flagged.csv`: songs that need a person;
  - `excluded.csv`;
  - `report.md`.
- **Year:** comes from `sources/year-rule.mjs` (with `chartYear` = `firstChartYear`).
- **Preview:** required from `sources/itunes.mjs`; the song's `itunesTrackId` is stored.
- **Fame:** `sources/pageviews.mjs` and `sources/deezer.mjs`.
- **Recheck:** `recheck.mjs` runs the year rule and the preview check on the existing catalog (task 3.8).
