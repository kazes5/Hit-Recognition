// Shared title / performer normalisation, from the source test (poc/source-test.mjs),
// with three fixes: apostrophes and geresh are dropped instead of splitting a word
// ("Don't" == "Dont"), store suffixes like " - 2011 Remaster" are removed, and
// prefix matches are reported separately from exact ones.

const NIQQUD = /[֑-ׇ]/g; // cantillation marks and niqqud
const APOSTROPHES = /['’‘`´׳״"“”]/g;
const STORE_SUFFIX = /\s+[-–—]\s+(?:[^-–—]*\b(?:remaster(?:ed)?|live|version|mono|stereo|edit|mix|single|demo|acoustic)\b[^-–—]*|\d{4}\s*(?:remaster(?:ed)?)?)$/i;

/** Lower-case, no niqqud, no parentheses, punctuation → single spaces. */
export function norm(s) {
  return String(s ?? '')
    .replace(STORE_SUFFIX, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(NIQQUD, '')
    .replace(/[̀-ͯ]/g, '') // Latin accents (NFKD splits them off)
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(APOSTROPHES, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** 2 = same title, 1 = one starts with the other (word boundary), 0 = different. */
export function titleMatch(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 2;
  if (x.startsWith(y + ' ') || y.startsWith(x + ' ')) return 1;
  return 0;
}

/** The source test's matcher: exact or prefix match. */
export function sameTitle(a, b) {
  return titleMatch(a, b) > 0;
}

/** Best match of a candidate title against a title and its aliases. */
export function titleMatchAny(candidate, titles) {
  return Math.max(0, ...titles.filter(Boolean).map((t) => titleMatch(candidate, t)));
}

/** Performer key: like norm, also drops a leading "the" and "feat." credits. */
export function normArtist(s) {
  return norm(String(s ?? '').replace(/\s+(?:feat\.?|ft\.?|featuring|עם)\s+.*$/i, ''))
    .replace(/^the /, '')
    .trim();
}

/** Split a credit like "A & B", "A and B", "A ו B", "A, B" into performer names. */
export function splitArtists(s) {
  return String(s ?? '')
    .split(/\s*(?:&|,|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\s+ו(?=[א-ת]))\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Does a store/database credit name one of our performer names?
 * True when a normalised name equals, or appears as whole words inside, the other.
 */
export function artistMatches(candidate, names) {
  const c = normArtist(candidate);
  if (!c) return false;
  for (const n of names.flatMap((x) => [x, ...splitArtists(x)])) {
    const k = normArtist(n);
    if (!k) continue;
    if (c === k || ` ${c} `.includes(` ${k} `) || ` ${k} `.includes(` ${c} `)) return true;
  }
  return false;
}

/** All 4-digit years 1900..maxYear in a text, in order. */
export function yearsIn(text, maxYear = new Date().getUTCFullYear() + 1) {
  return [...String(text ?? '').matchAll(/(?<!\d)(19\d\d|20\d\d)(?!\d)/g)].map((m) => Number(m[1])).filter((y) => y <= maxYear);
}
