// Task 3.5: genre and exclusion of a candidate, from artist-genres.json.
//
// Lookup: the exact credit, then the normalized credit, then each contributor of a
// collaboration (exact, then normalized). Excluded (D5) when the credit or ANY
// contributor is marked `exclude`. A performer not found at all → genre null,
// flag 'unknown-performer' (a person labels it; it may be Mizrahi or Jewish/Hasidic).
//
// Event hints:
//   - a credit naming an army band ("להקת" + an army unit) → 'army-bands', also for an
//     unknown performer (army bands are never excluded, so no flag);
//   - Israel Song Festival before 1980 → 'classic-hebrew' when the performer's genre is pop.
import { creditKeys, splitCredit } from './match.mjs';

const indexes = new WeakMap();

/** Normalized credit → entry, built once per artistGenres object. */
function normalizedIndex(artistGenres) {
  let index = indexes.get(artistGenres);
  if (!index) {
    index = new Map();
    for (const [credit, entry] of Object.entries(artistGenres)) {
      const key = creditKeys(credit)[0]; // the whole-credit key comes first
      if (key && !index.has(key)) index.set(key, { credit, entry });
    }
    indexes.set(artistGenres, index);
  }
  return index;
}

/** → { credit, entry, how: 'exact'|'normalized' } or null. */
export function lookupPerformer(name, artistGenres) {
  if (Object.prototype.hasOwnProperty.call(artistGenres, name)) return { credit: name, entry: artistGenres[name], how: 'exact' };
  const key = creditKeys(name)[0];
  const hit = key ? normalizedIndex(artistGenres).get(key) : undefined;
  return hit ? { ...hit, how: 'normalized' } : null;
}

/** Army units that have (or had) a band, as written after "להקת"; quotes are ignored. */
const ARMY_UNITS = [
  'הנחל', 'נחל', 'פיקוד מרכז', 'פיקוד צפון', 'פיקוד דרום', 'פיקוד העורף', 'חיל הים', 'חיל האוויר', 'חיל האויר',
  'חיל השריון', 'גייסות השריון', 'השריון', 'שריון', 'חיל התותחנים', 'התותחנים', 'חיל החינוך', 'חיל הקשר', 'חיל ההנדסה',
  'חיל המודיעין', 'חיל רפואה', 'הצנחנים', 'צנחנים', 'גולני', 'גבעתי', 'הגדנע', 'גדנע', 'צהל', 'זרוע היבשה', 'חיל המשטרה הצבאית',
  'פיקוד', 'חיל',
];

/** True when the credit names an army band: "להקת" followed by an army unit. */
export function isArmyBandCredit(credit) {
  const text = String(credit ?? '').replace(/['"׳״`’]/g, '').replace(/\s+/g, ' ');
  return ARMY_UNITS.some((unit) => text.includes(`להקת ${unit}`));
}

function chartEntries(candidate) {
  return Array.isArray(candidate.charts) && candidate.charts.length ? candidate.charts : [candidate];
}

/** True for an Israel Song Festival entry before 1980 (any chart of a merged candidate). */
export function isEarlyFestival(candidate) {
  return chartEntries(candidate).some((c) => c.source === 'israel-song-festival' && Number.isInteger(c.chartYear) && c.chartYear < 1980);
}

/**
 * assignGenre(candidate, artistGenres) → { genre, excluded, flag, via? }
 *   flag: 'unknown-performer' | null; via: which artist-genres credit(s) decided it.
 */
export function assignGenre(candidate, artistGenres) {
  const credit = String(candidate.artist ?? '');
  const whole = lookupPerformer(credit, artistGenres);
  const members = splitCredit(credit);
  const memberHits = members.length > 1 ? members.map((m) => lookupPerformer(m, artistGenres)).filter(Boolean) : [];

  const hits = whole ? [whole, ...memberHits] : memberHits;
  const excluded = hits.some((h) => h.entry?.exclude === true);
  const army = isArmyBandCredit(credit);

  if (hits.length === 0) {
    if (army) return { genre: 'army-bands', excluded: false, flag: null, via: [] };
    return { genre: null, excluded: false, flag: 'unknown-performer', via: [] };
  }

  let genre = hits[0].entry.genre;
  if (army) genre = 'army-bands';
  else if (genre === 'pop' && isEarlyFestival(candidate)) genre = 'classic-hebrew';
  return { genre, excluded, flag: null, via: [...new Set(hits.map((h) => h.credit))] };
}
