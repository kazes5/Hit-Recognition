// Where each chart lives on Wikipedia, and how its pages are read.
//
// Page names were checked by web search (the dev sandbox cannot reach Wikipedia), so the
// Hebrew sources do not hard-code one title: they DISCOVER their pages with the MediaWiki
// API (list=allpages by title prefix, plus a title search) and keep the pages whose title
// passes `accept`. Every discovered page is listed in the run summary with what it gave.
//
// Hebrew-calendar charts: the civil chartYear is the year the Hebrew year ended in
// (see hebrew-year.mjs): תשמ"ג → 1983.

const now = new Date();
const thisYear = now.getUTCFullYear();
/** The Hebrew annual parades air at Rosh Hashanah (September/October). */
const lastHebrewChart = now.getUTCMonth() >= 9 ? thisYear : thisYear - 1;
/** Billboard publishes its year-end chart in December. */
const lastBillboard = now.getUTCMonth() === 11 ? thisYear : thisYear - 1;

const ANNUAL = {
  annual: true,
  prefixes: ['מצעד הפזמונים העברי השנתי'],
  searches: ['intitle:"מצעד הפזמונים העברי השנתי"'],
  // the decade pages only; the main article has no lists
  accept: (t) => /^מצעד הפזמונים העברי השנתי \(/.test(t),
};

export const SOURCES = {
  // The annual Hebrew hit parades. he.wikipedia keeps them on decade pages,
  // "מצעד הפזמונים העברי השנתי (ה'תש"ל–ה'תשל"ט)" … "(ה'תש"ף ואילך)", one section per year
  // ("=== ה'תש"ל-1970 ===") with several labelled rankings each (annual.mjs). Both sources read
  // the same pages; the label above each list decides the station:
  //   Kol Yisrael / Reshet Gimel / Kan Gimel → reshet-gimel (also an unlabelled list),
  //   Galei Tzahal / Galgalatz → galgalatz, Media Forest / ACUM airplay lists → skipped (problem).
  'reshet-gimel': { wiki: 'he', language: 'he', firstYear: 1969, lastYear: lastHebrewChart, ...ANNUAL },
  galgalatz: { wiki: 'he', language: 'he', firstYear: 1970, lastYear: lastHebrewChart, ...ANNUAL },
  // Billboard Year-End Hot 100 (1959–). Before the Hot 100 (August 1958) Billboard's
  // year-end lists ranked other charts; Wikipedia has them as "Billboard year-end top 50
  // singles of 1956/1957/1958" (retail sales) and a top 30 for 1955. Those are used for
  // 1955–1958; 1958 uses the top-50 page (not the half-year Hot 100).
  billboard: {
    wiki: 'en',
    language: 'en',
    firstYear: 1955,
    lastYear: lastBillboard,
    titlesForYear: (y) =>
      y >= 1959
        ? [`Billboard Year-End Hot 100 singles of ${y}`]
        : y >= 1956
          ? [`Billboard year-end top 50 singles of ${y}`, `Billboard Year-End Top 50 Singles of ${y}`, `Billboard Year-End Hot 100 singles of ${y}`]
          : [`Billboard year-end top 30 singles of ${y}`, `Billboard year-end top 50 singles of ${y}`, `Billboard Year-End Top 30 Singles of ${y}`],
  },
  // Optional (task 3.2): Israel's Eurovision entries, one per year (rank 1, final placing kept as `placing`).
  eurovision: {
    wiki: 'he',
    language: 'he',
    firstYear: 1973,
    lastYear: thisYear,
    rankMode: 'entry',
    pages: ['ישראל באירוויזיון'],
    expectEveryYear: false,
  },
  // Optional: Israel Song Festival (פסטיבל הזמר והפזמון, 1960–1980 and later revivals). rank = placing, or 1.
  'israel-song-festival': {
    wiki: 'he',
    language: 'he',
    firstYear: 1960,
    lastYear: 1980,
    rankMode: 'entry',
    rankFromPlacing: true,
    prefixes: ['פסטיבל הזמר והפזמון'],
    searches: ['intitle:"פסטיבל הזמר והפזמון"'],
    accept: (t) => /^פסטיבל הזמר והפזמון/.test(t),
    fallbackPages: ['פסטיבל הזמר והפזמון'],
    expectEveryYear: false,
  },
};

export const ALL_SOURCES = Object.keys(SOURCES);
