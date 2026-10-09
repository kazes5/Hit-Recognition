import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../catalog-io.mjs';
import { assignGenre, isArmyBandCredit } from '../genre.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const realGenres = JSON.parse(fs.readFileSync(path.join(dir, '..', '..', 'artist-genres.json'), 'utf8'));

const map = {
  'יהודית רביץ': { genre: 'light-rock', exclude: false },
  'אילנית': { genre: 'pop', exclude: false },
  'אילן': { genre: 'pop', exclude: false },
  'זמר מזרחי': { genre: 'pop', exclude: true },
  'The Beatles': { genre: 'pop', exclude: false },
  'Lady Gaga': { genre: 'pop', exclude: false },
  'Bruno Mars': { genre: 'soul-rnb', exclude: false },
  'להקת הנח"ל': { genre: 'army-bands', exclude: false },
  'כוורת': { genre: 'rock', exclude: false },
};
const c = (artist, o = {}) => ({ source: 'reshet-gimel', chartYear: 1990, rank: 1, language: 'he', title: 'ש', artist, ...o });

describe('assignGenre lookup', () => {
  test('exact credit', () => {
    assert.deepEqual(assignGenre(c('יהודית רביץ'), map), { genre: 'light-rock', excluded: false, flag: null, via: ['יהודית רביץ'] });
  });
  test('normalized credit (niqqud, case, "The", "להקת")', () => {
    assert.equal(assignGenre(c('יְהוּדִית רָבִיץ'), map).genre, 'light-rock');
    assert.equal(assignGenre(c('Beatles', { language: 'en' }), map).genre, 'pop');
    assert.equal(assignGenre(c('THE BEATLES', { language: 'en' }), map).genre, 'pop');
    assert.equal(assignGenre(c('להקת כוורת'), map).genre, 'rock');
  });
  test('collaboration: each member, first known member decides the genre', () => {
    assert.equal(assignGenre(c('Bruno Mars & Lady Gaga', { language: 'en' }), map).genre, 'soul-rnb');
    assert.equal(assignGenre(c('Unknown Guy feat. Lady Gaga', { language: 'en' }), map).genre, 'pop');
    assert.equal(assignGenre(c('Unknown Guy feat. Lady Gaga', { language: 'en' }), map).flag, null);
  });
  test('excluded if any member is excluded (D5)', () => {
    assert.equal(assignGenre(c('זמר מזרחי'), map).excluded, true);
    assert.equal(assignGenre(c('יהודית רביץ וזמר מזרחי'), map).excluded, true);
    assert.equal(assignGenre(c('יהודית רביץ ואילנית'), map).excluded, false);
  });
  test('unknown performer → genre null, flagged', () => {
    assert.deepEqual(assignGenre(c('אף אחד'), map), { genre: null, excluded: false, flag: 'unknown-performer', via: [] });
  });
});

describe('event hints', () => {
  test('Israel Song Festival before 1980 turns pop into classic-hebrew', () => {
    assert.equal(assignGenre(c('אילנית', { source: 'israel-song-festival', chartYear: 1975 }), map).genre, 'classic-hebrew');
    assert.equal(assignGenre(c('אילנית', { source: 'israel-song-festival', chartYear: 1980 }), map).genre, 'pop');
    assert.equal(assignGenre(c('יהודית רביץ', { source: 'israel-song-festival', chartYear: 1975 }), map).genre, 'light-rock');
    const merged = c('אילנית', { charts: [{ source: 'reshet-gimel', chartYear: 1982, rank: 4 }, { source: 'israel-song-festival', chartYear: 1978, rank: 1 }] });
    assert.equal(assignGenre(merged, map).genre, 'classic-hebrew');
  });
  test('army band credits → army-bands, even for an unknown performer', () => {
    assert.ok(isArmyBandCredit('להקת פיקוד צפון'));
    assert.ok(isArmyBandCredit('יגאל בשן ולהקת פיקוד צפון'));
    assert.ok(isArmyBandCredit('להקת הנח״ל'));
    assert.ok(!isArmyBandCredit('שרה\'לה שרון ולהקת שירו'));
    assert.ok(!isArmyBandCredit('להקת כוורת'));
    assert.deepEqual(assignGenre(c('להקת חיל האוויר'), map), { genre: 'army-bands', excluded: false, flag: null, via: [] });
    assert.equal(assignGenre(c('אילנית ולהקת פיקוד מרכז'), map).genre, 'army-bands');
    assert.equal(assignGenre(c('להקת הנחל'), map).genre, 'army-bands');
  });
});

test('every catalog credit is found in the real artist-genres.json', () => {
  for (const s of readCatalog()) {
    const r = assignGenre({ ...s, source: 'reshet-gimel', chartYear: s.year }, realGenres);
    assert.equal(r.flag, null, s.artist);
    assert.equal(r.excluded, realGenres[s.artist].exclude, s.artist);
  }
});
