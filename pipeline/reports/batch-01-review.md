# Batch 1: review of the 208 flagged songs

Input: `pipeline/reports/batch-01-flagged.csv` (branch `song-pipeline`, HEAD 2a3a49a). Decisions per song: `pipeline/reports/batch-01-decisions.json` (`songs` = one entry per CSV row, with `row` = CSV line number; `performers` = new labels in `artist-genres.json` format).

**How this was decided.** The sandbox has no internet. Years come only from the source years in the CSV, the chart year, and general knowledge of Israeli music. Nothing was checked on the web. `low` means a best guess, usually the chart year, and should get a web check before merging. `medium` means two sources agree, or one trusted source plus the store, inside the chart window. `high` means 2–3 trusted sources agree inside the window, or the chart confirms them.

## Summary

| Action | Songs | high | medium | low |
|---|---|---|---|---|
| add | 148 | 41 | 89 | 18 |
| add-after-preview | 47 | 25 | 7 | 15 |
| exclude | 2 | 2 | 0 | 0 |
| drop | 4 | 3 | 1 | 0 |
| ask-owner | 7 | 3 | 3 | 1 |
| **total** | **208** | | | |

- `add-after-preview` = the year is decided but no iTunes preview was found (flag `needs-preview`), or the preview that was found is probably a different recording (flag `check-preview`).
- 6 songs have a store date clearly earlier than the song's year, so their iTunes track is probably a different recording: אריק איינשטיין – פראג (row 12); ג'וזי כץ – תני לי להחליט (row 59); רוחמה רז – רקפת (row 68); יהודית תמיר – רומיאו (row 175); יהודה פוליקר – פנים אל מול פנים (row 178); שלמה ארצי – אנחנו לא צריכים (row 179). Listen before adding.
- Credit fixes: write `בעז שרעבי` as the catalog's `בועז שרעבי` (rows with that credit), and `להקת פיקוד המרכז` as `להקת פיקוד מרכז`.

### Drops and exclusions

| Row | Performer | Song | Action | Why |
|---|---|---|---|---|
| 27 | הגשש החיוור ונעמי שמר | לו יהי | drop | Same song as catalog id 253 (Chava Alberstein, לו יהי, 1973); this Naomi Shemer/HaGashash version has no preview either |
| 33 | עפרה חזה | שיר הפריחה | drop | Duplicate of catalog id 318 (עפרה חזה, שיר הפרחה, 1979) - spelling variant |
| 51 | עוזי חיטמן ועודד בן חור | אדון עולם | exclude | "אדון עולם" - Hasidic Song Festival song (D5) |
| 100 | בעז שרעבי | אצלי הכל בסדר | drop | Duplicate of catalog id 393 (בועז שרעבי, אצלי הכל בסדר, 1984) - performer spelling variant |
| 147 | אורנה ומשה דץ | כאן | drop | Duplicate of catalog id 185 (דואו דאץ, כאן, 1991) - same act under its members' names |
| 162 | אלי לוזון | גשם | exclude | אלי לוזון is a Mizrahi performer (D5); also a cover of Benzin's 1982 song |

### Low-confidence years (web check recommended before merge)

| Row | Performer | Song | Action | Year | Why |
|---|---|---|---|---|---|
| 4 | אבי טולדנו | בדרך חזרה | add | 1969 | No trusted year; MusicBrainz 1998 and store 2000 are re-releases. Year taken from the chart (1968 also possible) |
| 5 | להקת פיקוד מרכז | שנינו מאותו הכפר | add | 1968 | Only the store (1978, a compilation); from the band's late-1960s programme, charted 1969. 1968 from memory, unverified |
| 7 | אבי טולדנו | עם רדת יום | add | 1969 | No trusted year; MusicBrainz 1998 and store 2016 are re-releases. Year taken from the chart |
| 8 | להקת הנח"ל | קרנבל בנח"ל | add-after-preview | 1969 | Only MusicBrainz 1989 (compilation); year from the chart. needs-preview |
| 14 | חוה אלברשטיין | מרדף | add | 1969 | Only the store (1970), later than the 1969 chart, so a re-release; Wikipedia page is a different subject. Year from the chart |
| 16 | עמי שביט | הפרח הלבן | add-after-preview | 1969 | No source and no preview; performer not identified. Year from the chart only; drop if no preview is found. needs-preview |
| 32 | צוות הווי חטיבת הצנחנים ושלישיית פיקוד מרכז | מסביב למדורה | add-after-preview | 1972 | Sources give 1948, the year the song was written; this army-band recording charted 1972 (1971 possible). needs-preview |
| 45 | צביקה פיק | דמדומים | add | 1975 | Wikidata 2011 is a different item (a book); MusicBrainz/store 1980 are later than the 1976 chart (re-releases). 1975 from memory, 1976 possible |
| 50 | דורית ראובני, דודו זכאי והגבעטרון | הללויה | add-after-preview | 1976 | Sources are for Milk & Honey's 1979 Eurovision song (catalog id 128), a different song; this one charted 1976. needs-preview |
| 54 | אריק איינשטיין, ג'וזי כץ וחבורת לול | מה איתי | add-after-preview | 1970 | Wikipedia/Wikidata 2022 are a different item; from the Lool recordings, chart 1971 (1971 also possible). needs-preview |
| 57 | צביקה פיק | סימנים | add | 1973 | Only the store (1999, re-release); year from the chart (1972 possible) |
| 58 | הגשש החיוור | נא | add-after-preview | 1975 | No source and no preview; year from the chart only. needs-preview |
| 61 | דדי בן עמי | דזדמונה | add-after-preview | 1970 | Only MusicBrainz 2003 (re-release); year from the chart. needs-preview |
| 71 | עדנה לב | רגע לפני | add | 1970 | Wikipedia/Wikidata 2008 are a different song; MusicBrainz 1972 and store 2005 are later than the 1970 chart. Year from the chart |
| 74 | רותי נבון | בין האצבעות | add | 1973 | MusicBrainz and store 1974 are after the 1973 chart; year set to chart year. Check chart-year mapping (see rule note) |
| 75 | שרי | למה לא | add | 1978 | Wikipedia/Wikidata 1971 are a different song ("למה לא סיפרת לי"); MusicBrainz 1996/store 2019 re-releases. Year from the chart |
| 87 | עירית בולקא | מוכרת הפרחים הקטנה | add-after-preview | 1978 | No source and no preview; performer not identified. Year from the chart only. needs-preview |
| 92 | בנזין | בית משותף | add | 1983 | MusicBrainz and store 1984 are after the 1983 chart; Wikipedia page is the TV series. Year set to chart year; check chart-year mapping |
| 95 | אבי טולדנו | כל חיי | add | 1980 | MusicBrainz 1998 and store 2016 re-releases; year from the chart |
| 101 | שלמה ארצי | אני שומע שוב (שיר חייל) | add | 1980 | Only the store (1985, re-release); year from the chart (1979 possible) |
| 104 | חלב ודבש וגלי עטרי | שיר לשירים | add-after-preview | 1980 | No usable source (Wikipedia page is a generic one); year from the chart. needs-preview |
| 106 | תיסלם | שנה שנייה | add-after-preview | 1982 | Only MusicBrainz 2009 (re-release); same period as Tislam's 1982 hits. needs-preview |
| 116 | צביקה פיק | השתקפות | add | 1978 | MusicBrainz and store both 1978, three years before the 1981 chart (outside the window); store is an upper bound so not later than 1978 |
| 124 | ירדנה ארזי | מחוזות האהבה | add | 1987 | MusicBrainz and store 1988 are after the 1987 chart; year set to chart year. Check chart-year mapping |
| 127 | שימי תבורי | תני לי את הלב | add | 1981 | MusicBrainz 2007 and store 1996 re-releases; year from the chart |
| 128 | אבי טולדנו | תרקדי את הלילה | add | 1986 | Wikipedia/Wikidata 2023 are a different song; MusicBrainz 1998 and store 2016 re-releases. Year from the chart |
| 129 | ירדנה ארזי ויהורם גאון | אדם אחר | add-after-preview | 1988 | Wikipedia/Wikidata 2016 are a different song; year from the chart. needs-preview |
| 137 | מיסטר הרי | אל תשכחי אותנו | add-after-preview | 1980 | No source and no preview; performer not identified. Year from the chart only. needs-preview |
| 179 | שלמה ארצי | אנחנו לא צריכים | add-after-preview | 1999 | Wikipedia/Wikidata 1970 are a different song; MusicBrainz 2000 later than chart; store 1992 is earlier than the chart, so the preview may be a different recording. Year from the chart |
| 189 | אתניקס והקומדי סטור | שיר הטרטע | add-after-preview | 1995 | No source and no preview (comedy recording); year from the chart. needs-preview |
| 192 | אורי פיינמן | נערת הכפר | add-after-preview | 1990 | Wikidata 1954 is the original song; this is a 1990 cover, year from the chart. needs-preview |
| 207 | ליליה | גבר באמבטיה | add | 1989 | Store 1989 (upper bound) inside window 1990; performer not identified |
| 209 | משינה | נגעה בשמיים | add | 1993 | MusicBrainz 2003 and store 1995 are later than the 1993 chart (re-releases); year from the chart (1992 possible) |

## Questions for the owner (ask-owner)

- **יגאל בשן – מה נשתנה** (row 22, year if added: 1972): Is Yigal Bashan's "מה נשתנה" (1972) a religious or Hasidic-festival song? If so, we leave it out (D5). If not, add it as 1972.
- **שוקי ודורית – גן נעול** (row 34, year if added: 1979): Shuki & Dorit's "גן נעול" (1979) uses words from the Song of Songs. Is it a religious song (leave out) or an ordinary pop song (add as 1979)?
- **חוה אלברשטיין – משירי ארץ אהבתי** (row 53, year if added: 1970): Chava Alberstein's "משירי ארץ אהבתי" (1970) is a medley of old songs from the 1940s–50s. Players may guess the songs' original years. Add it as 1970, or leave it out?
- **חנה לסלאו וג'קי מקייטן – מריומה יומה** (row 123, year if added: 1985): Hanna Laslo & Jacky Makaiten's "מריומה יומה" (1985) is a comedy song. Is it a Mizrahi-style song (leave out) or fine to add? It has no preview yet either.
- **רונית שחר – אהוב יקר** (row 156, year if added: 1996): Is Ronit Shahar ('אהוב יקר', 1996) a Mizrahi-style singer (leave out) or a pop singer (add)?
- **ירון חדד – זודיאק** (row 159, year if added: 1992): Is Yaron Hadad ('זודיאק', 1992) a Mizrahi-style singer (leave out) or a pop singer (add)?
- **זקני צפת – שישי שבת** (row 172, year if added: 1994): Ziknei Tzfat ('שישי שבת', 1994) sing about Shabbat. Is this a Jewish/religious song (leave out) or fine to add? It has no preview yet either.

## Rule proposals

Counts are for these 208 rows. I simulated each rule on the CSV and compared it with the decisions in this review. "Agree" means the rule gives the same year as the review.

| # | Proposal | Rows settled (of 208) | Agree with review |
|---|---|---|---|
| 1 | **Chart-window rule** (the owner's example). Accept year Y when Y is the chart year or the year before, at least one trusted source gives Y, and the store date is not earlier than Y. For pre-1970 Hebrew songs, require two trusted sources equal to the chart year. | 125 years (97 fully automatic, with a preview and not otherwise held) | 125/125 |
| 2 | **Store as a confirming source.** Accept year Y when one trusted source and the store both give Y inside [chart−2, chart]. Most of these are MusicBrainz plus store. This is a narrower form of rule 1. | 53 more than today's 2-of-3 (111 years in total) | 111/111 |
| 3 | **Don't let an unknown performer block the year.** Settle the year as usual and queue only the performer for labelling. Hold the song only when the performer may fall under D5. | 51 rows had a good year and were held only for the performer (39 had no other reason). Labels for all 75 performers are proposed below. | 51/51 |
| 4 | **Ignore a trusted year that is outside the chart window or points to another song**: a `(שיר של X)` page where X is a different performer, a page title that is not the song title (e.g. `שיר`, `אני (שיר)`, a TV series or a compilation), or a year earlier than chart−2 or later than the chart. Then apply the rules above to what is left. | 27 rows had a Wikipedia/Wikidata year more than 2 years from the chart (6 are other performers' pages). These rows stop being "disagree"; most then settle by rule 1 or 2. | no wrong settles in simulation |
| 5 | **Pre-1970 Hebrew: let the chart confirm.** Auto-accept when two trusted sources equal the chart year. | 7 of the 20 pre-1970 rows | 7/7 |
| 6 | **Better duplicate matching**: ignore ו/ה spelling (בעז/בועז, הפריחה/הפרחה), map member-name credits to acts (אורנה ומשה דץ → דואו דאץ), and flag the same title already in the catalog by another performer. | 4 drops found by hand here (rows 27, 33, 100, 147) | – |
| 7 | **Preview sanity check**: when the store date is clearly earlier than the accepted year, flag `check-preview`, because the iTunes track is probably another recording. This catches errors, it does not settle rows. | 6 rows flagged | – |
| 8 | **Check the chart-year mapping.** Three songs have MusicBrainz and store both at chart year + 1 (rows 74, 92, 124). Either these lists end later than assumed, or the extractor is off by one for some years. Worth checking in the extractor before the next batch, because it changes what "inside the window" means. | 3 rows (set to the chart year, low confidence) | – |

Rules 1 and 3 together would have settled about 97 of the 208 rows with no person involved: year settled, a preview present, the performer labelled, and not a D5 question. The no-preview rows (47) still need a preview from somewhere. Rule changes cannot settle those.

Caveats: rule 1 trusts a single source when it matches the chart. In the source test, MusicBrainz alone was exact 79% of the time for Hebrew. Wikipedia and Wikidata are often not independent, because Wikidata copies the Wikipedia infobox. Suggest running rule 1 on the 60-song source test before turning it on.

## Performer labels (new entries for artist-genres.json)

75 performers: 3 excluded, 15 marked `"unsure": true`. Entries marked unsure are best guesses; for D5-unsure performers the song is in ask-owner. The full entries are in `batch-01-decisions.json` → `performers`.

| Performer | Genre | Exclude | Note |
|---|---|---|---|
| אבטיפוס | pop | no | 1990s pop band; genre unsure (pop or light-rock) |
| אורי פיינמן | pop | no | actor-singer; 1990 pop songs and a cover of an old song |
| אורנה ומשה דץ | pop | no | same act as דואו דאץ (already labelled pop); add as an alias of דואו דאץ |
| אושיק לוי | classic-hebrew | no | 1970s Israeli singer and actor (classic Israeli song) |
| אחרית הימים | light-rock | no | unsure: early-1970s Israeli band; genre could be pop or rock |
| איגי וקסמן | rock | no | 1990s singer-songwriter, rock |
| איזולירבנד | rock | no | 1980s new-wave/rock band |
| אילנה אביטל | classic-hebrew | no | classic Israeli singer |
| אילנה רובינא | classic-hebrew | no | early-1970s singer of classic Israeli songs |
| אלי לוזון | pop | **yes** | Mizrahi-style performer (D5) |
| אלי מגן | classic-hebrew | no | early-1970s singer/actor, classic Israeli song |
| אפרים שמיר | light-rock | no | Kaveret member; solo pop/light rock |
| בן ארצי | pop | no | pop singer (son of Shlomo Artzi) |
| בעז שרעבי | pop | no | spelling variant of בועז שרעבי (pop, not excluded, owner-reviewed borderline); add as alias |
| ג'וזי כץ | light-rock | no | folk/light rock singer (Lool, Arik Einstein circle) |
| ג'ינג'יות | pop | no | 1990s girl pop group |
| גבי שושן | classic-hebrew | no | 1970s singer/actor, classic Israeli song |
| גזוז | pop | no | late-1970s pop group |
| גן חיות | rock | no | 1990s rock band |
| גרי אקשטיין | pop | no | pop singer/entertainer |
| דדי בן עמי | pop | no | unsure: little-known 1970 performer; genre guessed |
| דודה | rock | no | unsure: early-1980s band; rock guessed |
| דודו זכאי | classic-hebrew | no | 1970s singer of Israeli songs |
| דורית ראובני, דודו זכאי והגבעטרון | classic-hebrew | no | collaboration with the Gevatron choir |
| דני גרנות | classic-hebrew | no | unsure – late-1960s singer; genre guessed from era |
| דפנה ארמוני | pop | no | 1980s pop singer |
| היי פייב | pop | no | 1990s boy band, dance-pop |
| הכבש השישה עשר | light-rock | no | the 1978 children's album (Yoni Rechter and others) |
| הנשמות הטהורות | pop | no | 1970s pop group |
| הקליק | rock | no | 1980s new-wave/rock band |
| זקני צפת | rock | **yes** | unsure: 1990s band with Shabbat/Jewish themes ("שישי שבת"); excluded until the owner decides (D5) |
| חבורת הזמר של פיקוד צפון | army-bands | no | army ensemble |
| חדוה ודוד | pop | no | pop duo (1970 Tokyo festival winners) |
| חנה לסלאו וג'קי מקייטן | pop | no | unsure: comedy duet; the song may be a Mizrahi-style parody (D5) - owner to decide |
| יאיר ניצני | pop | no | satirical pop/rock (HaAshem Tamid) |
| יהודית תמיר | pop | no | 1990s pop singer |
| יוני נמרי | classic-hebrew | no | unsure: little-known early-1970s performer; genre guessed from era |
| יורם ארבל | classic-hebrew | no | 1969 festival-era song; genre from era |
| יזהר אשדות | rock | no | ex-Tislam; pop-rock solo |
| יעל לוי | light-rock | no | singer; existing duet with David Broza is light-rock |
| יצחק קלפטר | light-rock | no | Kaveret guitarist; solo light rock |
| ירון חדד | pop | no | unsure: could not place this performer or rule out Mizrahi style - owner to decide |
| ירמי קפלן | rock | no | 1990s rock singer |
| ליליה | pop | no | unsure: could not identify this act; genre guessed |
| ללדין | rock | no | 1990s rock band |
| מוטי פליישר | classic-hebrew | no | around-1970 singer of classic Israeli songs |
| מיסטר הרי | pop | no | unsure: could not identify this act |
| מיקה קרני | pop | no | 1990s pop/rock singer |
| מנגו | rock | no | late-1980s rock band |
| מני בגר | pop | no | pop singer (1970s-80s) |
| נוער שוליים | rock | no | 1990s rock band |
| נורית גלרון | light-rock | no | singer, light rock/ballads |
| סיון שביט | pop | no | 1990s pop singer |
| סקסטה | pop | no | late-1970s vocal group |
| עוזי חיטמן | pop | no | pop songwriter/singer; his "אדון עולם" (Hasidic Song Festival) is excluded per song |
| עוזי חיטמן ועודד בן חור | pop | **yes** | only credit is "אדון עולם", a Hasidic Song Festival song (D5) |
| עוזי פוקס | pop | no | 1970s pop singer |
| עירית בולקא | pop | no | unsure: could not identify this performer |
| עמי שביט | classic-hebrew | no | unsure: could not identify this performer; genre from era |
| ענת עצמון | pop | no | actress and pop singer |
| פבלו רוזנברג | pop | no | pop ballad singer |
| צוות הווי חטיבת הצנחנים | army-bands | no | army entertainment troupe |
| צוות הווי חטיבת הצנחנים ושלישיית פיקוד מרכז | army-bands | no | two army ensembles |
| צוות הווי פיקוד מרכז | army-bands | no | army entertainment troupe |
| צליל מכוון | pop | no | late-1970s pop group |
| רבקה זהר | classic-hebrew | no | classic Israeli singer (רבקה זהר ולהקת חיל הים is army-bands) |
| רוחמה רז | classic-hebrew | no | classic Israeli singer |
| רונית שחר | pop | no | unsure: 1990s pop singer, possibly Mediterranean/Mizrahi style - owner to decide (D5) |
| רותי נבון | pop | no | 1970s pop singer |
| שוקי ודורית | pop | no | unsure: duo not identified with certainty |
| שלישיית פיקוד מרכז | army-bands | no | army trio |
| שרון חזיז | pop | no | 1990s pop singer |
| שרי | pop | no | unsure: 1970s singer known by first name only; not identified with certainty |
| ששי קשת | classic-hebrew | no | actor-singer, classic Israeli song |
| תופעת דופלר | rock | no | 1990s rock band |

## All decisions

| Row | Performer | Song | Action | Year | Genre | Conf. | Reason |
|---|---|---|---|---|---|---|---|
| 2 | רבקה זהר | על כפיו יביא | add | 1969 | classic-hebrew | high | Wikipedia, Wikidata and store all 1969, #1 in chart 1969; MusicBrainz 1995 is a compilation |
| 3 | להקת פיקוד המרכז | שירו של צנחן | add | 1969 | army-bands | high | Wikipedia, Wikidata, MusicBrainz all 1969 = chart year; store 1993 is a re-release. Credit is a variant of להקת פיקוד מרכז |
| 4 | אבי טולדנו | בדרך חזרה | add | 1969 | pop | low | No trusted year; MusicBrainz 1998 and store 2000 are re-releases. Year taken from the chart (1968 also possible) |
| 5 | להקת פיקוד מרכז | שנינו מאותו הכפר | add | 1968 | army-bands | low | Only the store (1978, a compilation); from the band's late-1960s programme, charted 1969. 1968 from memory, unverified |
| 6 | להקת הנח"ל | החיים היפים | add-after-preview | 1969 | army-bands | high | Wikipedia and Wikidata 1969 = chart year (chart confirms); MusicBrainz 1996 re-release. needs-preview |
| 7 | אבי טולדנו | עם רדת יום | add | 1969 | pop | low | No trusted year; MusicBrainz 1998 and store 2016 are re-releases. Year taken from the chart |
| 8 | להקת הנח"ל | קרנבל בנח"ל | add-after-preview | 1969 | army-bands | low | Only MusicBrainz 1989 (compilation); year from the chart. needs-preview |
| 9 | להקת גייסות השריון | שריונים 69 | add | 1969 | army-bands | high | Title says 1969; store 1969 = chart year; MusicBrainz 1994 is a compilation |
| 10 | להקת הנח"ל | בשמלה אדומה | add-after-preview | 1969 | army-bands | high | Wikipedia and Wikidata 1969 = chart year; MusicBrainz 1989 re-release. needs-preview |
| 11 | יגאל בשן | אין לי יותר מה לומר | add | 1969 | pop | medium | Store 1969 (upper bound) = chart year; MusicBrainz 1998 re-release |
| 12 | אריק איינשטיין | פראג | add | 1969 | light-rock | medium | All three trusted sources 1969 = chart year; store says 1968, so check the preview is the same recording |
| 13 | אילן ואילנית | בעקבותייך | add-after-preview | 1968 | classic-hebrew | high | Wikipedia and Wikidata 1968, inside chart window 1969; MusicBrainz 1970 re-release. needs-preview |
| 14 | חוה אלברשטיין | מרדף | add | 1969 | light-rock | low | Only the store (1970), later than the 1969 chart, so a re-release; Wikipedia page is a different subject. Year from the chart |
| 15 | יורם ארבל | אני אצבע את השלכת בירוק | add | 1969 | classic-hebrew | high | Wikipedia, Wikidata and store all 1969 = chart year |
| 16 | עמי שביט | הפרח הלבן | add-after-preview | 1969 | classic-hebrew | low | No source and no preview; performer not identified. Year from the chart only; drop if no preview is found. needs-preview |
| 17 | להקת פיקוד צפון | על המשמר | add | 1969 | army-bands | medium | Store 1969 (upper bound) = chart year |
| 18 | להקת חיל הים | רק בישראל | add-after-preview | 1968 | army-bands | high | Wikipedia and Wikidata 1968, inside chart window; MusicBrainz 2010 re-release. needs-preview |
| 19 | אילנית | שיר בארבעה בתים | add | 1969 | pop | high | Wikipedia and Wikidata 1969 = chart year; MusicBrainz 1995 and store 2006 re-releases |
| 20 | אריק איינשטיין ושלום חנוך | למה לי לקחת ללב | add-after-preview | 1970 | light-rock | high | Wikipedia and Wikidata 1970 = chart year (#1). needs-preview |
| 21 | שלמה ארצי | פתאום עכשיו, פתאום היום | add | 1970 | pop | high | 1970 Israel Song Festival winner; MusicBrainz and store 1970 = chart #1; Wikipedia/Wikidata 1996 are wrong (later item) |
| 22 | יגאל בשן | מה נשתנה | ask-owner | 1972 | pop | medium | Store 1972 = chart year (#1). Possible religious/Hasidic-festival song (D5) - owner to confirm |
| 23 | שלישיית פיקוד מרכז | היום היום | add | 1971 | army-bands | high | Wikipedia and Wikidata 1971, inside chart window 1972; store 1972 |
| 24 | חדוה ודוד | אני חולם על נעמי | add-after-preview | 1970 | pop | high | Wikipedia and Wikidata 1970 (Tokyo festival 1970), inside window; MusicBrainz 1981 re-release. needs-preview |
| 25 | בעז שרעבי | חייך וחיי | add | 1972 | pop | high | Wikipedia, Wikidata and store 1972 = chart year. Credit spelling: use catalog name בועז שרעבי |
| 26 | שלמה ארצי | אל תשאל ילד | add | 1971 | pop | medium | MusicBrainz and store both 1971, inside chart window 1972 |
| 27 | הגשש החיוור ונעמי שמר | לו יהי | drop | 1973 | pop | medium | Same song as catalog id 253 (Chava Alberstein, לו יהי, 1973); this Naomi Shemer/HaGashash version has no preview either |
| 28 | חוה אלברשטיין | את תלכי בשדה | add | 1975 | light-rock | medium | MusicBrainz and store both 1975, inside chart window 1976 |
| 29 | חבורת הזמר של פיקוד צפון | בלילה על הדשא | add | 1977 | army-bands | high | Wikipedia and Wikidata 1977 = chart year; MusicBrainz 1996 and store 2012 re-releases |
| 30 | צוות הווי פיקוד מרכז | שומר החומות | add-after-preview | 1977 | army-bands | high | Wikipedia and Wikidata 1977, inside window 1978. needs-preview |
| 31 | אילנה רובינא | לך איתה | add-after-preview | 1971 | classic-hebrew | high | Wikipedia, Wikidata, MusicBrainz all 1971 = chart year. needs-preview |
| 32 | צוות הווי חטיבת הצנחנים ושלישיית פיקוד מרכז | מסביב למדורה | add-after-preview | 1972 | army-bands | low | Sources give 1948, the year the song was written; this army-band recording charted 1972 (1971 possible). needs-preview |
| 33 | עפרה חזה | שיר הפריחה | drop |  | pop | high | Duplicate of catalog id 318 (עפרה חזה, שיר הפרחה, 1979) - spelling variant |
| 34 | שוקי ודורית | גן נעול | ask-owner | 1979 | pop | low | Wikipedia/Wikidata 1928 are for the old text/setting; this version charted 1979 (store 1980). Song of Songs lyrics - owner to confirm it is not a religious song (D5) |
| 35 | להקת הנח"ל | בלדה ליצחק שדה | add | 1972 | army-bands | medium | Store 1972 (upper bound) = chart year; MusicBrainz 1989 compilation |
| 36 | צוות הווי חטיבת הצנחנים | בארץ אהבתי השקד פורח | add | 1975 | army-bands | medium | Wikidata and store 1975 = chart year; Wikipedia 1951 is the original song, this is the 1975 army-troupe recording |
| 37 | אושיק לוי | חוזה לך ברח | add | 1970 | classic-hebrew | medium | Store 1970 = chart year; MusicBrainz 1971 is later than store (re-release); Wikidata 1910 is the Bialik poem |
| 38 | אילנית | אהבתה של תרזה די-מון | add-after-preview | 1970 | pop | high | Wikipedia and Wikidata 1970 = chart year; MusicBrainz 2003 re-release. needs-preview |
| 39 | אושיק לוי | לישון לישון | add | 1971 | classic-hebrew | high | All four sources 1971 = chart year |
| 40 | ששי קשת | ומתוק האור בעיניים | add | 1971 | classic-hebrew | high | Wikipedia, Wikidata, store 1971 = chart year; MusicBrainz 1999 re-release |
| 41 | להקת חיל הים | על אם הדרך | add | 1971 | army-bands | medium | Store 1971, inside chart window 1972; MusicBrainz 1994 compilation |
| 42 | גבי שושן | שש עשרה מלאו לנער | add | 1973 | classic-hebrew | high | Wikipedia, Wikidata, store 1973 = chart year; MusicBrainz 2011 re-release |
| 43 | גזוז | תשע בכיכר | add | 1978 | pop | high | Wikipedia and Wikidata 1978, inside window 1979; MusicBrainz/store 1979 |
| 44 | צליל מכוון | צליל מכוון | add | 1979 | pop | high | All four sources 1979 = chart year |
| 45 | צביקה פיק | דמדומים | add | 1975 | pop | low | Wikidata 2011 is a different item (a book); MusicBrainz/store 1980 are later than the 1976 chart (re-releases). 1975 from memory, 1976 possible |
| 46 | מוטי פליישר | עפרה | add-after-preview | 1970 | classic-hebrew | high | Wikipedia and Wikidata 1970 = chart year. needs-preview |
| 47 | אילן ואילנית | חופשי ומאושר | add-after-preview | 1971 | classic-hebrew | high | Wikipedia, Wikidata, MusicBrainz 1971 = chart year. needs-preview |
| 48 | צביקה פיק | לא אני הוא האיש | add | 1978 | pop | medium | Store 1978 (upper bound) inside window 1979; Wikidata 1929 is a different item, MusicBrainz 2004 re-release |
| 49 | עוזי פוקס | אין לך מה לדאוג | add | 1974 | pop | high | Wikidata, MusicBrainz, store 1974 = chart year (Wikipedia 1973) |
| 50 | דורית ראובני, דודו זכאי והגבעטרון | הללויה | add-after-preview | 1976 | classic-hebrew | low | Sources are for Milk & Honey's 1979 Eurovision song (catalog id 128), a different song; this one charted 1976. needs-preview |
| 51 | עוזי חיטמן ועודד בן חור | אדון עולם | exclude |  | pop | high | "אדון עולם" - Hasidic Song Festival song (D5) |
| 52 | עוזי חיטמן | רציתי שתדע | add | 1977 | pop | high | Wikipedia, Wikidata, store 1977, inside window 1978; MusicBrainz 1994 re-release |
| 53 | חוה אלברשטיין | משירי ארץ אהבתי | ask-owner | 1970 | light-rock | medium | MusicBrainz and store 1970 = chart year; Wikipedia 1951 is for the old songs. It is a medley of old songs - owner to decide if a medley fits the game |
| 54 | אריק איינשטיין, ג'וזי כץ וחבורת לול | מה איתי | add-after-preview | 1970 | light-rock | low | Wikipedia/Wikidata 2022 are a different item; from the Lool recordings, chart 1971 (1971 also possible). needs-preview |
| 55 | אלי מגן | עד סוף הקיץ | add | 1972 | classic-hebrew | high | Wikipedia and Wikidata 1972 = chart year; MusicBrainz/store 1990 compilation |
| 56 | אילנית | גוליבר | add-after-preview | 1973 | pop | high | Wikipedia and Wikidata 1973 = chart year; MusicBrainz 1976 re-release. needs-preview |
| 57 | צביקה פיק | סימנים | add | 1973 | pop | low | Only the store (1999, re-release); year from the chart (1972 possible) |
| 58 | הגשש החיוור | נא | add-after-preview | 1975 | pop | low | No source and no preview; year from the chart only. needs-preview |
| 59 | ג'וזי כץ | תני לי להחליט | add-after-preview | 1976 | light-rock | medium | Wikipedia and Wikidata 1976, inside window 1977. The found preview is dated 1971, earlier than the song: likely the wrong recording - check it |
| 60 | שלמה ארצי | רק עלה | add | 1978 | pop | medium | MusicBrainz and store 1978 = chart year |
| 61 | דדי בן עמי | דזדמונה | add-after-preview | 1970 | pop | low | Only MusicBrainz 2003 (re-release); year from the chart. needs-preview |
| 62 | צביקה פיק | שני תפוחים | add | 1971 | pop | medium | Store 1971 = chart year; MusicBrainz 1975 later than store (re-release) |
| 63 | יהורם גאון | אני זוכר | add | 1970 | classic-hebrew | medium | Store 1970 = chart year; MusicBrainz 1971 later than store (re-release) |
| 64 | אילנית | לאורך השדרה שאין בה איש | add-after-preview | 1972 | pop | high | Wikipedia, Wikidata, MusicBrainz 1972 = chart year. needs-preview |
| 65 | יוני נמרי | שושנת פלאים | add-after-preview | 1973 | classic-hebrew | high | Wikipedia and Wikidata 1973 = chart year. needs-preview |
| 66 | להקת פיקוד מרכז | האיש מן הבקעה | add | 1971 | army-bands | medium | Wikipedia 1971 and store 1972 inside window 1973; Wikipedia preferred (96% exact in the test) |
| 67 | דודו זכאי | חייכי לי בשירים | add-after-preview | 1974 | classic-hebrew | high | Wikipedia and Wikidata 1974, inside window 1975. needs-preview |
| 68 | רוחמה רז | רקפת | add-after-preview | 1977 | classic-hebrew | medium | Wikipedia and Wikidata 1977 = chart year; the found preview is dated 1970, earlier than the song: likely the wrong recording - check it |
| 69 | הכבש השישה עשר | גן סגור | add | 1978 | light-rock | high | Wikipedia, Wikidata, store 1978, inside window 1979; MusicBrainz 2008 re-release |
| 70 | מוטי פליישר | אבשלום | add | 1970 | classic-hebrew | high | All four sources 1970 = chart year |
| 71 | עדנה לב | רגע לפני | add | 1970 | classic-hebrew | low | Wikipedia/Wikidata 2008 are a different song; MusicBrainz 1972 and store 2005 are later than the 1970 chart. Year from the chart |
| 72 | אילנה רובינא | בלדה על נערי שגדל | add | 1972 | classic-hebrew | high | Wikipedia and store 1972 = chart year; MusicBrainz 1999 re-release |
| 73 | הנשמות הטהורות | אחכה לך | add | 1973 | pop | medium | MusicBrainz 1973 = chart year; Wikipedia and store 1974 are after the 1973 chart (see chart-year note) |
| 74 | רותי נבון | בין האצבעות | add | 1973 | pop | low | MusicBrainz and store 1974 are after the 1973 chart; year set to chart year. Check chart-year mapping (see rule note) |
| 75 | שרי | למה לא | add | 1978 | pop | low | Wikipedia/Wikidata 1971 are a different song ("למה לא סיפרת לי"); MusicBrainz 1996/store 2019 re-releases. Year from the chart |
| 76 | אחרית הימים | יש לי יום הולדת | add | 1972 | light-rock | high | All four sources 1972 |
| 77 | כוורת | טנגו צפרדעים | add | 1975 | rock | high | MusicBrainz and store 1975 = chart year (album צעצועים מתנגשים, 1975) |
| 78 | כוורת | לו-לו | add | 1975 | rock | high | MusicBrainz and store 1975, inside window 1976 (album צעצועים מתנגשים, 1975) |
| 79 | צביקה פיק | מסיבת יום שישי | add | 1979 | pop | medium | MusicBrainz and store 1979 = chart year |
| 80 | רבקה זהר | בן יפה נולד | add | 1970 | classic-hebrew | high | Wikipedia, Wikidata, store 1970 = chart year; MusicBrainz 1991 re-release |
| 81 | להקת פיקוד צפון | סיירת אגוז | add | 1970 | army-bands | medium | Store 1970 inside window 1971; MusicBrainz 2010 re-release |
| 82 | אחרית הימים | פתחי לי את הדלת | add | 1972 | light-rock | medium | MusicBrainz and store 1972 = chart year |
| 83 | דני גרנות | לאהוב את החיים | add | 1968 | classic-hebrew | medium | Wikipedia and Wikidata 1968, inside window 1970; store 1969 |
| 84 | שלום חנוך | מאיה | add | 1971 | rock | medium | MusicBrainz 1971 = chart year; store 1980 re-release |
| 85 | שוקולד מנטה מסטיק | שירים הם חברים | add | 1975 | pop | medium | Store 1975 = chart year; MusicBrainz 2003 re-release |
| 86 | אריק סיני | שיר פרידה | add | 1978 | light-rock | medium | Store 1978 = chart year; MusicBrainz 1980 re-release; Wikipedia page is unrelated |
| 87 | עירית בולקא | מוכרת הפרחים הקטנה | add-after-preview | 1978 | pop | low | No source and no preview; performer not identified. Year from the chart only. needs-preview |
| 88 | סקסטה | נולדתי לשלום | add | 1979 | pop | high | Wikipedia and Wikidata 1979 = chart year; MusicBrainz 1999/store 2003 re-releases |
| 89 | צביקה פיק | אין לי איש מלבדי | add | 1979 | pop | medium | Store 1979 = chart year; MusicBrainz 1980 later than store (re-release) |
| 90 | שלמה ארצי | נרקוד נשכח | add | 1986 | pop | medium | MusicBrainz and store 1986 = chart year |
| 91 | איזולירבנד | מלודי | add-after-preview | 1982 | rock | high | Wikipedia, Wikidata, MusicBrainz 1982 = chart year. needs-preview |
| 92 | בנזין | בית משותף | add | 1983 | rock | low | MusicBrainz and store 1984 are after the 1983 chart; Wikipedia page is the TV series. Year set to chart year; check chart-year mapping |
| 93 | תיסלם | בוקר של כיף | add | 1982 | rock | medium | Store 1982 inside window 1983; MusicBrainz 1990 compilation |
| 94 | שלמה ארצי | רוב הזמן את אשתי | add | 1984 | pop | medium | MusicBrainz 1984 = chart year; store 2003 re-release |
| 95 | אבי טולדנו | כל חיי | add | 1980 | pop | low | MusicBrainz 1998 and store 2016 re-releases; year from the chart |
| 96 | ירדנה ארזי | שוב בתמונה | add | 1985 | pop | medium | MusicBrainz and store 1985 inside window 1986; Wikidata 1986 (store is an upper bound, so 1985) |
| 97 | ענת עצמון | בחלום | add-after-preview | 1989 | pop | high | Wikipedia and Wikidata 1989 = chart year. needs-preview |
| 98 | בנזין | חופשי זה לגמרי לבד | add | 1982 | rock | medium | MusicBrainz 1982 = chart year; store 1993 re-release |
| 99 | דויד ברוזה | הרומבה | add | 1983 | light-rock | medium | MusicBrainz and store 1983 = chart year |
| 100 | בעז שרעבי | אצלי הכל בסדר | drop | 1984 | pop | high | Duplicate of catalog id 393 (בועז שרעבי, אצלי הכל בסדר, 1984) - performer spelling variant |
| 101 | שלמה ארצי | אני שומע שוב (שיר חייל) | add | 1980 | pop | low | Only the store (1985, re-release); year from the chart (1979 possible) |
| 102 | משינה | בדרך אל הים | add | 1989 | rock | medium | MusicBrainz and store 1989 = chart year |
| 103 | ירדנה ארזי ולהקת הנח"ל | דרישת שלום | add-after-preview | 1985 | army-bands | high | Wikipedia and Wikidata 1985 = chart year. needs-preview |
| 104 | חלב ודבש וגלי עטרי | שיר לשירים | add-after-preview | 1980 | pop | low | No usable source (Wikipedia page is a generic one); year from the chart. needs-preview |
| 105 | גלי עטרי ומני בגר | דואט פרידה | add-after-preview | 1981 | pop | medium | Wikipedia 1981 inside window 1982. needs-preview |
| 106 | תיסלם | שנה שנייה | add-after-preview | 1982 | rock | low | Only MusicBrainz 2009 (re-release); same period as Tislam's 1982 hits. needs-preview |
| 107 | גלי עטרי | עד שנשיב | add | 1981 | pop | medium | MusicBrainz and store 1981 = chart year |
| 108 | יאיר ניצני | האשם תמיד | add-after-preview | 1986 | pop | medium | Wikipedia and Wikidata 1986 = chart year (page is the show/album of the same name). needs-preview |
| 109 | מנגו | גרה בשינקין | add | 1988 | rock | high | Wikipedia and Wikidata 1988 inside window 1989; store 1989 |
| 110 | עפרה חזה | מכתב אהבה | add | 1982 | pop | medium | MusicBrainz and store 1982 = chart year |
| 111 | גרי אקשטיין | אני הולך לבית שאן | add | 1979 | pop | medium | MusicBrainz and store 1979 inside window 1980 |
| 112 | ירדנה ארזי | האיש מן החלום | add | 1989 | pop | medium | Store 1989 = chart year; MusicBrainz 1998 re-release |
| 113 | ירדנה ארזי | מוזיקה נשארת | add-after-preview | 1982 | pop | high | Wikipedia and Wikidata 1982 = chart year. needs-preview |
| 114 | מני בגר | הולך למערב | add | 1982 | pop | medium | MusicBrainz and store 1982 inside window 1983 |
| 115 | דויד ברוזה | סניוריטה | add | 1979 | light-rock | medium | MusicBrainz 1979 inside window 1980; store 1980 |
| 116 | צביקה פיק | השתקפות | add | 1978 | pop | low | MusicBrainz and store both 1978, three years before the 1981 chart (outside the window); store is an upper bound so not later than 1978 |
| 117 | תיסלם | השריקה הזאת | add | 1982 | rock | medium | Store 1982 inside window 1983; MusicBrainz 1990 compilation |
| 118 | ירדנה ארזי | ההצגה הגדולה | add | 1984 | pop | medium | MusicBrainz and store 1984 inside window 1985 |
| 119 | מני בגר | אהבה בוערת | add | 1982 | pop | medium | MusicBrainz and store 1982 = chart year; Wikipedia/Wikidata 1972 are a different song of the same name |
| 120 | אפרים שמיר | רוקד לקול הבנות | add | 1983 | light-rock | high | Wikipedia, MusicBrainz, store 1983 = chart year |
| 121 | הקליק | כל האמת | add | 1983 | rock | medium | MusicBrainz and store 1983 = chart year |
| 122 | צביקה פיק | המראה | add | 1980 | pop | medium | MusicBrainz and store 1980 = chart year |
| 123 | חנה לסלאו וג'קי מקייטן | מריומה יומה | ask-owner | 1985 | pop | medium | Wikipedia 1985 = chart year; no preview. Comedy duet that may be a Mizrahi-style parody (D5) - owner to decide. needs-preview |
| 124 | ירדנה ארזי | מחוזות האהבה | add | 1987 | pop | low | MusicBrainz and store 1988 are after the 1987 chart; year set to chart year. Check chart-year mapping |
| 125 | יגאל בשן | האמיני לי | add | 1982 | pop | medium | Store 1982 (upper bound) = chart year |
| 126 | יעל לוי | בלדה לנאיבית | add | 1979 | light-rock | high | Wikipedia and Wikidata 1979 inside window 1980; MusicBrainz 1981/store 1982 re-releases |
| 127 | שימי תבורי | תני לי את הלב | add | 1981 | pop | low | MusicBrainz 2007 and store 1996 re-releases; year from the chart |
| 128 | אבי טולדנו | תרקדי את הלילה | add | 1986 | pop | low | Wikipedia/Wikidata 2023 are a different song; MusicBrainz 1998 and store 2016 re-releases. Year from the chart |
| 129 | ירדנה ארזי ויהורם גאון | אדם אחר | add-after-preview | 1988 | pop | low | Wikipedia/Wikidata 2016 are a different song; year from the chart. needs-preview |
| 130 | גלי עטרי | בעקבותיו | add | 1984 | pop | medium | MusicBrainz and store 1984 = chart year |
| 131 | שלמה ארצי | צוותא | add | 1979 | pop | medium | MusicBrainz and store 1979 inside window 1980 |
| 132 | יצחק קלפטר | אני ואת אז | add | 1980 | light-rock | high | Wikipedia and Wikidata 1980 inside window 1981; MusicBrainz/store 1981 |
| 133 | עפרה חזה | כל יום מתחילה שנה | add | 1982 | pop | medium | MusicBrainz and store 1982 = chart year |
| 134 | גלי עטרי | עוד מעט | add | 1988 | pop | medium | MusicBrainz and store 1988 = chart year; Wikipedia page is a different song |
| 135 | ירדנה ארזי | אלף לילה ולילה | add | 1989 | pop | medium | MusicBrainz and store 1989 = chart year |
| 136 | הכל עובר חביבי | תלווי אותי | add | 1983 | pop | medium | MusicBrainz and store 1983 = chart year |
| 137 | מיסטר הרי | אל תשכחי אותנו | add-after-preview | 1980 | pop | low | No source and no preview; performer not identified. Year from the chart only. needs-preview |
| 138 | דודה | אלף כבאים | add | 1980 | rock | medium | MusicBrainz and store 1980 inside window 1981; Wikipedia 1981 (store is an upper bound, so 1980) |
| 139 | תיסלם | כבר הסתיו עכשיו | add | 1982 | rock | medium | Store 1982 inside window 1983; MusicBrainz 1990 compilation |
| 140 | דפנה ארמוני | אלה | add | 1984 | pop | high | Wikipedia and Wikidata 1984 = chart year; MusicBrainz/store 1986 re-release |
| 141 | רמי קלינשטיין וריטה | שבועה | add-after-preview | 1986 | pop | medium | Wikipedia 1986 inside window 1987. needs-preview |
| 142 | תיסלם | כוכבים | add | 1983 | rock | medium | Store 1983 inside window 1984; MusicBrainz 1990 compilation |
| 143 | נוער שוליים | ציירי לך שפם | add | 1990 | rock | high | All four sources 1990 = chart year |
| 144 | אתניקס | כתם הפרי | add | 1991 | pop | medium | MusicBrainz and store 1991 = chart year; Wikidata 2006 is a different item (a journal) |
| 145 | אתניקס | בובה | add | 1993 | pop | medium | MusicBrainz and store 1993 = chart year; Wikipedia/Wikidata 2022 are Noam Bettan's different song |
| 146 | אתניקס | לא לבד | add | 1994 | pop | medium | MusicBrainz and store 1994 = chart year; Wikipedia/Wikidata 2016 are Hanan Ben Ari's different song |
| 147 | אורנה ומשה דץ | כאן | drop | 1991 | pop | high | Duplicate of catalog id 185 (דואו דאץ, כאן, 1991) - same act under its members' names |
| 148 | שלמה ארצי ועמיר לב | אני בא | add | 1992 | pop | medium | Store 1992 = chart year; Wikipedia/Wikidata 1927 are a different page ("אני") |
| 149 | שרון חזיז | קח אותי לשם | add | 1993 | pop | high | Wikipedia, Wikidata, store 1993 inside window 1994 |
| 150 | אביב גפן | אהבנו | add | 1995 | rock | medium | MusicBrainz and store 1995 = chart year; Wikipedia/Wikidata 2006 are a different song |
| 151 | אביב גפן והתעויוט | עונות | add-after-preview | 1995 | rock | medium | Wikipedia 1995, Wikidata 1996, chart 1996; Wikipedia preferred. needs-preview |
| 152 | נוער שוליים | ענוג | add | 1990 | rock | medium | MusicBrainz and store 1990 = chart year; Wikipedia/Wikidata 1934 are the original old song, this is the 1990 version |
| 153 | אתניקס | קלנדיה | add | 1992 | pop | medium | MusicBrainz and store 1992 = chart year |
| 154 | ללדין | יעקב | add | 1994 | rock | high | Wikipedia, Wikidata, store 1994 = chart year; MusicBrainz 1998 re-release |
| 155 | שלמה ארצי | מנגב לך ת'דמעות | add | 1996 | pop | medium | MusicBrainz 1996 inside window 1996; store 1997 re-release |
| 156 | רונית שחר | אהוב יקר | ask-owner | 1996 | pop | high | All four sources 1996, inside window 1997. Only question is the performer's style (D5) |
| 157 | בן ארצי ושלמה ארצי | 17 | add-after-preview | 1998 | pop | high | Wikipedia and Wikidata 1998 = chart year. needs-preview |
| 158 | אילנה אביטל | טוב שבאתם | add-after-preview | 1990 | classic-hebrew | high | Wikipedia, Wikidata, MusicBrainz 1990 = chart year. needs-preview |
| 159 | ירון חדד | זודיאק | ask-owner | 1992 | pop | high | Wikipedia, Wikidata, MusicBrainz 1992 = chart year. Only question is the performer's style (D5) |
| 160 | תופעת דופלר | ליפול על גן עדן | add | 1993 | rock | medium | MusicBrainz and store 1993 = chart year |
| 161 | טיפקס | עוד שבת | add | 1997 | rock | medium | MusicBrainz 1997 = chart year; store 2003 re-release |
| 162 | אלי לוזון | גשם | exclude | 1997 | pop | high | אלי לוזון is a Mizrahi performer (D5); also a cover of Benzin's 1982 song |
| 163 | נוער שוליים | סיזיפה | add | 1990 | rock | medium | MusicBrainz and store 1990 = chart year |
| 164 | גלי עטרי | חזקה מהרוח | add | 1991 | pop | medium | MusicBrainz 1991 inside window 1992; store 1992 |
| 165 | אביב גפן והתעויוט | בוכה על הקבר | add-after-preview | 1993 | rock | high | Wikipedia and Wikidata 1993 = chart year. needs-preview |
| 166 | אתניקס | ילד מרקש | add | 1994 | pop | medium | MusicBrainz and store 1994 = chart year |
| 167 | אבטיפוס | תשאירי לי מקום לחבק אותך | add | 1995 | pop | medium | Store 1995 = chart year; MusicBrainz 1998 re-release |
| 168 | סיון שביט | נשקי אותי | add | 1996 | pop | high | All four sources 1996 = chart year |
| 169 | ירמי קפלן | כבר עכשיו | add | 1995 | rock | medium | MusicBrainz and store 1995, Wikipedia/Wikidata 1996, chart 1997; store is an upper bound so 1995 |
| 170 | היי פייב | כולם רוקדים עכשיו | add | 1998 | pop | medium | MusicBrainz and store 1998 = chart year |
| 171 | נורית גלרון | אתה פה חסר לי | add | 1992 | light-rock | high | All four sources 1992, inside window 1993 |
| 172 | זקני צפת | שישי שבת | ask-owner | 1994 | rock | high | Wikipedia and MusicBrainz 1994 = chart year; no preview. Band with Shabbat/Jewish themes - owner to decide (D5). needs-preview |
| 173 | היי פייב | יום מעונן | add | 1997 | pop | medium | Store 1997 = chart year; MusicBrainz 1998 re-release |
| 174 | אורי פיינמן | שלושים בצל | add | 1990 | pop | medium | Store 1990 (upper bound) = chart year |
| 175 | יהודית תמיר | רומיאו | add | 1991 | pop | medium | Wikipedia, Wikidata, MusicBrainz 1991 = chart year; store 1990 is earlier, so check the preview is the same recording |
| 176 | בעז שרעבי | כשתבוא | add | 1993 | pop | high | Wikipedia, Wikidata, store 1993 inside window 1994. Credit spelling: use catalog name בועז שרעבי |
| 177 | אביב גפן והתעויוט | המכתב | add-after-preview | 1996 | rock | high | Wikipedia and Wikidata 1996 = chart year. needs-preview |
| 178 | יהודה פוליקר | פנים אל מול פנים | add-after-preview | 1997 | rock | medium | MusicBrainz 1997 = chart year. The found preview is dated 1984, long before the song: likely the wrong recording - find the right one |
| 179 | שלמה ארצי | אנחנו לא צריכים | add-after-preview | 1999 | pop | low | Wikipedia/Wikidata 1970 are a different song; MusicBrainz 2000 later than chart; store 1992 is earlier than the chart, so the preview may be a different recording. Year from the chart |
| 180 | שרון חזיז | השמים של יוליה | add | 1993 | pop | medium | Store 1993 (upper bound) inside window 1994; MusicBrainz 1994 |
| 181 | שרון חזיז | הולכת ממך | add | 1995 | pop | medium | MusicBrainz and store 1995 = chart year |
| 182 | טיפקס | סתם | add | 1997 | rock | medium | MusicBrainz and store 1997 = chart year; Wikipedia/Wikidata 2016 are a different song |
| 183 | בן ארצי | חיים משל עצמי | add | 1998 | pop | high | All four sources 1998 = chart year |
| 184 | נוער שוליים | אמסטרדם | add | 1990 | rock | high | All four sources 1990 = chart year |
| 185 | גידי גוב | אני שוב מתאהב | add | 1989 | rock | medium | MusicBrainz 1989 inside window 1991; store 1991 |
| 186 | גן חיות | ירח כחול | add | 1992 | rock | medium | MusicBrainz and store 1992 = chart year |
| 187 | אתי אנקרי | לולו | add | 1993 | pop | medium | MusicBrainz and store 1993 = chart year |
| 188 | ג'ינג'יות | L.A | add | 1994 | pop | high | Wikipedia, Wikidata, MusicBrainz 1994 = chart year; store 2012 re-release |
| 189 | אתניקס והקומדי סטור | שיר הטרטע | add-after-preview | 1995 | pop | low | No source and no preview (comedy recording); year from the chart. needs-preview |
| 190 | פבלו רוזנברג | בדמעות שאת בוכה | add | 1996 | pop | medium | MusicBrainz and store 1996 = chart year |
| 191 | בעז שרעבי | כשאת נוגעת בי | add | 1998 | pop | medium | MusicBrainz and store 1998 = chart year. Credit spelling: use catalog name בועז שרעבי |
| 192 | אורי פיינמן | נערת הכפר | add-after-preview | 1990 | pop | low | Wikidata 1954 is the original song; this is a 1990 cover, year from the chart. needs-preview |
| 193 | אתניקס | אמונה | add | 1991 | pop | medium | MusicBrainz and store 1991 = chart year |
| 194 | יזהר אשדות | איש השוקולד | add | 1992 | rock | high | All four sources 1992 = chart year |
| 195 | דני רובס | הבן של הקוסם | add | 1993 | pop | medium | MusicBrainz and store 1993 = chart year |
| 196 | אביב גפן | כבוד | add | 1994 | rock | medium | MusicBrainz and store 1994 = chart year |
| 197 | אתניקס | לחיות בניו זילנד | add | 1995 | pop | medium | MusicBrainz and store 1995 = chart year |
| 198 | שלמה ארצי | היא לא יודעת מה עובר עלי | add | 1996 | pop | medium | MusicBrainz 1996 = chart year; store 2019 re-release |
| 199 | מיקה קרני | מיטשל | add | 1997 | pop | high | All four sources 1997 = chart year |
| 200 | כנסיית השכל | למיה יש אקדח | add | 1999 | rock | medium | MusicBrainz 1999 = chart year; store 2007 re-release |
| 201 | ירדנה ארזי | כאבים רחוקים | add | 1989 | pop | medium | Store 1989 (upper bound) inside window 1990 |
| 202 | דוד ד'אור | אני עף | add | 1993 | pop | medium | Store 1993 = chart year; MusicBrainz 1998 re-release |
| 203 | אריק איינשטיין | בגללך | add | 1995 | light-rock | medium | MusicBrainz and store 1995 = chart year; Wikipedia/Wikidata 2009 are a compilation album |
| 204 | אתניקס | תביא קצת דינרוס | add | 1996 | pop | medium | MusicBrainz and store 1996 = chart year |
| 205 | איגי וקסמן | לא מחכה יותר לדוור | add-after-preview | 1997 | rock | high | Wikipedia, Wikidata, MusicBrainz 1997 = chart year. needs-preview |
| 206 | דודי לוי ואהוד בנאי | כל הזמן שבעולם | add-after-preview | 1997 | rock | high | Wikipedia and Wikidata 1997 inside window 1998. needs-preview |
| 207 | ליליה | גבר באמבטיה | add | 1989 | pop | low | Store 1989 (upper bound) inside window 1990; performer not identified |
| 208 | יזהר אשדות | הלילות שלנו | add | 1992 | rock | medium | MusicBrainz and store 1992 = chart year |
| 209 | משינה | נגעה בשמיים | add | 1993 | rock | low | MusicBrainz 2003 and store 1995 are later than the 1993 chart (re-releases); year from the chart (1992 possible) |
