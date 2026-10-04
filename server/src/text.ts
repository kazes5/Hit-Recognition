/**
 * Text normalization shared by preview matching (preview/matching.ts) and
 * guess checking (guess.ts).
 */

/**
 * Lowercases, strips diacritics (incl. Hebrew niqqud), turns punctuation into
 * spaces and collapses whitespace. Keeps letters and digits of any script.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Hebrew "and" connector after normalization: a "ו" prefixed to a word (or standing
 * alone) after a space, as in "דטנר וקושניר" / "דטנר ו קושניר". Same idea as
 * HEBREW_AND in selection.ts; a leading "ו" ("ורד") is never touched.
 */
const HEBREW_AND = / ו ?(?=[א-ת])/g;

/** Normalized artist credit; the Hebrew "ו" connector becomes " and " like "&". */
export function normalizeArtist(artist: string): string {
  return normalizeText(artist).replace(HEBREW_AND, ' and ').replace(/^the /, '');
}

/** Title without parenthetical / bracketed parts and " - Remastered"-style suffixes. */
export function normalizeTitleCore(title: string): string {
  const stripped = title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s[-–—]\s.*$/, ' ');
  const core = normalizeText(stripped);
  return core.length > 0 ? core : normalizeText(title);
}
