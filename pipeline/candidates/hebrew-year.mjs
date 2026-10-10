// Hebrew calendar years written in letters (תשמ"ג, ה'תשמ"ג, תש"ם, תשמ''ג) → the civil year.
//
// Mapping (documented in the README section of index.mjs): a Hebrew year starts at Rosh
// Hashanah (September/October) and ends in the next civil year. The annual Hebrew hit
// parades (Reshet Gimel, Galgalatz) are broadcast on the eve of Rosh Hashanah, at the END
// of the Hebrew year they cover, so the chart's civil year is the year the Hebrew year
// ended in:  chartYear = hebrewYear − 3760.
//   תשכ"ט (5729, Sep 1968 – Sep 1969) → 1969
//   תשמ"ג (5743, Sep 1982 – Sep 1983) → 1983
//   תשנ"ו (5756) → 1996,  תשפ"ה (5785) → 2025,  תשפ"ו (5786) → 2026

const VALUES = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

/** Value of Hebrew numeral letters (no thousands), or null if the letters are not a well-formed numeral. */
export function gematria(letters) {
  const s = String(letters).replace(/["״'׳]/g, '');
  if (!s) return null;
  let sum = 0;
  let prev = Infinity;
  for (let i = 0; i < s.length; i++) {
    const v = VALUES[s[i]];
    if (!v) return null;
    // Numerals are written largest first (ת may repeat: תת = 800); טו/טז replace יה/יו.
    const special = (s[i - 1] === 'ט' && (s[i] === 'ו' || s[i] === 'ז'));
    if (v > prev && !special) return null;
    if (v === prev && v !== 400) return null;
    sum += v;
    prev = v;
  }
  return sum;
}

// ת followed by up to three letters, with gershayim (" ״ or two apostrophes) before the
// last letter; optional ה' (thousands) prefix. Not preceded/followed by a Hebrew letter.
const HEBREW_YEAR = /(?<![א-ת])(?:ה['׳]\s?)?(ת[א-ת]{0,2}(?:["״]|'')[א-ת])(?![א-ת])/g;

/** All Hebrew years (5700–5800) in a text, as { hebrew: 'תשמ"ג', year: 5743, civil: 1983 }. */
export function hebrewYearsIn(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(HEBREW_YEAR)) {
    const g = gematria(m[1].replace(/''/g, '"'));
    if (g == null) continue;
    const year = 5000 + g;
    if (year < 5700 || year > 5800) continue; // ת"א (Tel Aviv), תנ"ך … are not years
    out.push({ hebrew: m[1], year, civil: year - 3760 });
  }
  return out;
}

/** Civil year a Hebrew year ended in. */
export function hebrewToChartYear(hebrewYear) {
  return hebrewYear - 3760;
}
