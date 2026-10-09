import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { artistMatches, norm, normArtist, sameTitle, splitArtists, titleMatch, yearsIn } from '../normalize.mjs';

describe('norm', () => {
  test('removes Hebrew niqqud and cantillation', () => {
    assert.equal(norm('שָׁלוֹם'), 'שלום');
    assert.equal(norm('יְרוּשָׁלַיִם שֶׁל זָהָב'), 'ירושלים של זהב');
  });
  test('drops parentheses and brackets', () => {
    assert.equal(norm('Umbrella (feat. Jay-Z)'), 'umbrella');
    assert.equal(norm('Wonderwall [Remastered]'), 'wonderwall');
  });
  test('apostrophes and geresh do not split words', () => {
    assert.equal(norm("Don't Know Why"), norm('Dont Know Why'));
    assert.equal(norm("Livin' la Vida Loca"), 'livin la vida loca');
    assert.equal(norm('צה״ל'), 'צהל');
  });
  test('punctuation, accents and & are normalised', () => {
    assert.equal(norm('Hello,   World!'), 'hello world');
    assert.equal(norm('Café'), 'cafe');
    assert.equal(norm('Ilan & Ilanit'), 'ilan and ilanit');
  });
  test('store suffixes are removed', () => {
    assert.equal(norm('Proud Mary - 2008 Remaster'), 'proud mary');
    assert.equal(norm('Every Breath You Take - Remastered 2003'), 'every breath you take');
    assert.equal(norm('Sultans of Swing - Live at Alchemy'), 'sultans of swing');
  });
});

describe('title matching', () => {
  test('exact, prefix (word boundary) and none', () => {
    assert.equal(titleMatch('Hound dog', 'Hound Dog'), 2);
    assert.equal(titleMatch('Call Me Maybe', 'Call Me'), 1);
    assert.equal(titleMatch('Callme', 'Call'), 0);
    assert.equal(titleMatch('', 'x'), 0);
    assert.ok(sameTitle('ערב של שושנים', 'עֶרֶב שֶׁל שׁוֹשַׁנִּים'));
  });
});

describe('performers', () => {
  test('normArtist drops "the" and featured credits', () => {
    assert.equal(normArtist('The Beatles'), 'beatles');
    assert.equal(normArtist('Mark Ronson feat. Bruno Mars'), 'mark ronson');
  });
  test('splitArtists handles &, and, Hebrew ו', () => {
    assert.deepEqual(splitArtists('Moti Giladi & Sarai Tzuriel'), ['Moti Giladi', 'Sarai Tzuriel']);
    assert.deepEqual(splitArtists('אביב גפן ואריק איינשטיין'), ['אביב גפן', 'אריק איינשטיין']);
  });
  test('artistMatches by whole words, either way, including parts of a credit', () => {
    assert.ok(artistMatches('Creedence Clearwater Revival', ['Creedence Clearwater Revival']));
    assert.ok(artistMatches('Mark Ronson & Bruno Mars', ['Mark Ronson']));
    assert.ok(artistMatches('Arik Einstein', ['אביב גפן ואריק איינשטיין', 'Aviv Geffen & Arik Einstein']));
    assert.ok(!artistMatches('Ike & Tina Turner', ['Creedence Clearwater Revival']));
    assert.ok(!artistMatches('Ryan Adams', ['Oasis']));
  });
});

describe('yearsIn', () => {
  test('finds 4-digit years 1900..next year only', () => {
    assert.deepEqual(yearsIn('19 May 1978, 3:07, 2099, 1850, 12345'), [1978]);
    assert.deepEqual(yearsIn('ב-1958 ובשנת 1957'), [1958, 1957]);
  });
});
