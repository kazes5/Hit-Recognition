# Phase 2 genre relabel: independent review

Reviewed: worktree `agent-adc32b9394980230f`, commit c727844. I checked all 667 songs: every Hebrew song one at a time, and every English song with a focus on the new genres. I used 4 web searches.

## 3. Internal consistency (checked first, by script)

- `node pipeline/apply-genres.mjs --check`: 0 songs would change, and there are no errors. So no credit is missing, no genre id is invalid, and every override id exists.
- No override equals the performer's default genre (all 31 checked).
- No credit in `artist-genres.json` is unused (487 credits, all of them used in `songs.json`).
- Diff against the previous commit: only the `genre` field changed. No other field changed on any song, and the song count is the same.
- Every excluded credit (38) has the genre `pop`, and all 65 of their songs are `pop`, as D5 requires.
- The report's counts (92 changes, the transition table, and the before/after table) match the data.

Verdict on internals: **clean.**

## 1. Genre mistakes

### Clear mistakes (2)

| Id | Artist | Title | Current → suggested | Reason |
|---:|---|---|---|---|
| 253 | חוה אלברשטיין | לו יהי (1973) | light-rock → **classic-hebrew** | A Naomi Shemer song from the Yom Kippur War. It is one of the most canonical שירי ארץ ישראל of the 1970s and is not light rock. It fits the definition better than several songs that were moved (e.g. 624, 625). |
| 626 | יגאל בשן | עושה שלום (1969) | classic-hebrew → **pop** | It won the 1969 **Hasidic** Song Festival, and its text is a prayer. That makes it a Jewish/Hasidic-style song, which D5 says is labelled pop. The override goes the opposite way: the artist note itself says "1969 festival". If the owner prefers to treat the Hasidic Festival songs as classic Israeli songs, that is an explicit exception to D5 and should be written down. |

### Probable mistake (medium confidence)

| Id | Artist | Title | Current → suggested | Reason |
|---:|---|---|---|---|
| 412 | מתי כספי ושוקולד מנטה מסטיק | נח (1974) | light-rock → classic-hebrew | Israel Song Festival 1974 (Taharlev / Caspi). It is a playful festival song with a children's-song feel, not light rock. The pipeline's own event rule (Israel Song Festival before 1980 → classic-hebrew) would label it classic-hebrew. |

### Consistency notes (not clear mistakes; keeping them as they are is defensible)

- **Nu-disco is split.** 73 Daft Punk *Get Lucky* and 88 Kylie *Can't Get You Out of My Head* are disco-dance, but Dua Lipa's 205 *Don't Start Now*, 237 *Levitating* and 491 *Dance the Night* stay pop ("core pop artist"). Kylie is just as much a core pop artist. Pick one rule: either the disco-pop songs move to disco-dance, or the rule "core pop artists stay pop" is written down.
- 583 The Penguins *Earth Angel* (1954): doo-wop / R&B, so soul-rnb would fit better. Pop is acceptable under "when unsure, keep".
- 515 יגאל בשן *קפה אצל ברטה* (1974) and 65 אילנית *אי שם* (1973) stay pop. Pop is acceptable (one is a chanson, the other a Eurovision entry).
- Army bands: all 7 are correct. 358 שרה'לה שרון ולהקת שירו is correctly not an army band.
- Hip-hop: all 13 are correct. The pop overrides for 569 מוקי, 139 OutKast and 402 Post Malone are reasonable.
- Classic-hebrew: the other 19 are correct.
- Soul-rnb and disco-dance (English): all 23 + 26 moves are correct.

## 2. Exclusions

### The exclusion list in general
The clear Mizrahi exclusions are right: Zohar Argov, Eyal Golan, Sarit Hadad, Moshe/Kobi Peretz, Zehava Ben, Haim Moshe, Lior Narkis, Shlomi Shabat, Amir Benayoun, Itay Levi, Eden Ben Zaken, Peer Tasi, Dudu Aharon, Osher Cohen, Bar Tzabari, Raviv Kaner, Yasmin Moallem, Maya Buskila, Yoav Yitzhak, Idan Refael Haviv, and Rotem Cohen. Shuli Rand and Ishay Ribo are Jewish/religious, and both are correct.

I found no mainstream pop or rock performer excluded by mistake, and no obvious Mizrahi performer missed outright.

### Disagreements and refinements
1. **חנן בן ארי** is excluded as plain "Jewish-pop (D5)" without the *borderline* tag. Disagree with how it is presented. His hits (*החיים שלנו תותים*, *אם תרצי*) are mainstream Galgalatz pop sung by a religious artist, much like בניה ברבי and יובל דיין, which were *not* excluded. Excluding him may still be right (*אמן על הילדים* is a prayer), but he should be marked borderline for the owner.
2. **אגם בוחבוט** (not excluded) vs **שחר טבוך ואגם בוחבוט** (excluded as a Mizrahi-dance duet). This is inconsistent at the edge. She says she rejects both labels, pop and Mizrahi. Either keep both open and judge per song, or exclude both. The owner should decide the two together.
3. **שי גבסו** (not excluded): lean disagree. He is generally classed as a Mediterranean/Mizrahi-pop singer, close to איתי לוי and עדן חסון, who are excluded. *יום ועוד יומיים* is a pop ballad, so the existing song is fine, but new batches would bring in Mizrahi material. Suggest exclude, or at least a flag per song.

### The "borderline" notes, one by one

Excluded credits:

| Credit | View |
|---|---|
| עומר אדם | Agree (Mizrahi-pop star). |
| ששון שאולוב | Agree (Mizrahi/Bukharan pop). |
| שימי תבורי | Agree (classic Mizrahi singer). |
| עדן חסון | Agree. |
| שחר טבוך ואגם בוחבוט | Agree, but see disagreement 2 above. |
| אודיה ועופר ניסים | Agree. |
| יגל אושרי | Agree. |
| אודיה | Agree. |
| נסרין קדרי | Agree. |

Not excluded:

| Credit | View |
|---|---|
| סטטיק ובן אל תבורי | Agree (mainstream pop). |
| עפרה חזה | Agree, with a caveat. Her Yemenite repertoire (*אם ננעלו* is a Yemenite Jewish piyyut) is Jewish-style, so new batches should check her songs one at a time. |
| מורן מזור | Agree (Eurovision pop). |
| הפרויקט של עידן רייכל, and the same project with רוני דלומי | Agree (world/pop). |
| בועז מעודה | Agree, weakly (Mizrahi-tinged pop). |
| אבי טולדנו | Agree. |
| אתניקס | Agree, but check songs one at a time (*ג'סיקה* is Mizrahi in style). |
| בועז שרעבי | Agree. |
| יהודה פוליקר | Agree. |
| דודו טסה | Agree. |
| בניה ברבי | Agree. |
| יובל דיין | Agree. |
| אתי אנקרי | Agree. |
| אמיר דדון | Agree. |
| דולי ופן, לירן דנינו ונועה קירל | Agree. |
| אגם בוחבוט | See disagreement 2. |
| שי גבסו | Disagree, weakly (disagreement 3). |

## Verdict

- **2 clear mistakes** (253 → classic-hebrew; 626 → pop under D5) and 1 probable one (412 → classic-hebrew).
- **3 exclusion points** for the owner: Hanan Ben Ari should be marked borderline; Agam Buhbut solo vs her duet is inconsistent; Shai Gabso leans toward exclude.
- The data files and script are internally clean.
- Overall: **approve after these small fixes.** The relabel is careful and conservative, and the change list is accurate.

Sources used: kan.org.il / yael.org.il (נח, Israel Song Festival 1974); maariv.co.il (Hasidic Song Festival 1969); mako.co.il / ice.co.il (Agam Buhbut, *קופידון*).
