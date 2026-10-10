import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readCatalog } from '../catalog-io.mjs';
import { creditKeys, findInCatalog, indexCatalog, looseHebrew, matchCatalog, mergeCandidates, sameSong, splitCredit, titleKeys } from '../match.mjs';

const cand = (o) => ({ source: 'reshet-gimel', chartYear: 1990, rank: 5, language: 'he', page: 'p', ...o });
const catalog = readCatalog();
const byId = (id) => catalog.find((s) => s.id === id);

describe('normalization', () => {
  test('niqqud, punctuation, case, final letters and spaces', () => {
    assert.deepEqual(titleKeys('בֶּן אָדָם'), titleKeys('בן אדם'));
    assert.deepEqual(titleKeys('Hound dog'), titleKeys('Hound Dog'));
    assert.deepEqual(titleKeys("Don't Stop!"), titleKeys('Dont Stop'));
    assert.deepEqual(titleKeys('Rock & Roll'), titleKeys('Rock and Roll'));
    assert.equal(titleKeys('שלום').length, 1);
    assert.ok(titleKeys('Song - 2011 Remaster').includes(titleKeys('Song')[0]));
  });
  test('credit splitting: & and ו feat. ft. ,', () => {
    assert.deepEqual(splitCredit('דטנר וקושניר'), ['דטנר', 'קושניר']);
    assert.deepEqual(splitCredit('Rihanna feat. Jay-Z'), ['Rihanna', 'Jay-Z']);
    assert.deepEqual(splitCredit('Rihanna ft. Jay-Z'), ['Rihanna', 'Jay-Z']);
    assert.deepEqual(splitCredit('דולי ופן, לירן דנינו ונועה קירל'), ['דולי', 'פן', 'לירן דנינו', 'נועה קירל']);
    assert.deepEqual(splitCredit('Lady Gaga & Bradley Cooper'), ['Lady Gaga', 'Bradley Cooper']);
    assert.ok(creditKeys('The Beatles').includes(creditKeys('Beatles')[0]));
    assert.ok(creditKeys('להקת כוורת').includes(creditKeys('כוורת')[0]));
  });
});

describe('the catalog', () => {
  test('has no song matching another catalog song', () => {
    for (const s of catalog) {
      const { match } = findInCatalog(s, indexCatalog(catalog.filter((x) => x !== s)));
      assert.equal(match, null, `${s.id} ${s.artist} - ${s.title} matches ${match?.id}`);
    }
  });
});

describe('matchCatalog: existing songs', () => {
  test('"Hound dog" by Elvis Presley is the catalog\'s "Hound Dog"', () => {
    const r = matchCatalog([cand({ source: 'billboard', language: 'en', artist: 'Elvis Presley', title: 'Hound dog', chartYear: 1956 })], catalog);
    assert.deepEqual(r.existing.map((e) => e.songId), [239]);
    assert.equal(r.fresh.length, 0);
  });

  test('Yardena Arazi\'s and Odeya\'s "בן אדם" are different songs', () => {
    assert.equal(byId(169).title, byId(668).title);
    assert.equal(sameSong(byId(169), byId(668)), false);
    const r = matchCatalog(
      [cand({ artist: 'ירדנה ארזי', title: 'בן אדם', chartYear: 1988 }), cand({ artist: 'אודיה', title: 'בֶּן אָדָם', chartYear: 2024 })],
      catalog,
    );
    assert.equal(r.merged.length, 2, 'not merged with each other');
    assert.deepEqual(r.existing.map((e) => e.songId).sort((a, b) => a - b), [169, 668]);
  });

  test('a third "בן אדם" by someone else is fresh, reported as same-title-other-performer', () => {
    const r = matchCatalog([cand({ artist: 'שלמה ארצי', title: 'בן אדם' })], catalog);
    assert.equal(r.fresh.length, 1);
    assert.deepEqual(
      r.possibleDuplicates.map((p) => [p.songId, p.reason]).sort(),
      [[169, 'same-title-other-performer'], [668, 'same-title-other-performer']],
    );
  });

  test('aliases: Latin spelling of a Hebrew song, and the artist alias', () => {
    const r = matchCatalog([cand({ artist: 'Odeya', title: 'Ben Adam', language: 'en' })], catalog);
    assert.deepEqual(r.existing.map((e) => e.songId), [668]);
  });

  test('collaborations: order, "&" vs "ו", one member named, artistKeys', () => {
    const base = catalog.find((s) => s.artist === 'דטנר וקושניר');
    for (const artist of ['דטנר & קושניר', 'קושניר ודטנר', 'Datner & Kushnir', 'דטנר']) {
      const r = matchCatalog([cand({ artist, title: base.title })], catalog);
      assert.deepEqual(r.existing.map((e) => e.songId), [base.id], artist);
    }
    const ronson = byId(110); // Mark Ronson, artistKeys include Bruno Mars
    const r = matchCatalog([cand({ language: 'en', source: 'billboard', artist: 'Mark Ronson featuring Bruno Mars', title: ronson.title })], catalog);
    assert.deepEqual(r.existing.map((e) => e.songId), [110]);
    const r2 = matchCatalog([cand({ language: 'en', source: 'billboard', artist: 'Bruno Mars', title: ronson.title })], catalog);
    assert.deepEqual(r2.existing.map((e) => e.songId), [110]);
  });

  test('the same title by an unrelated performer is not a match', () => {
    const r = matchCatalog([cand({ language: 'en', source: 'billboard', artist: 'Big Mama Thornton', title: 'Hound Dog', chartYear: 1953 })], catalog);
    assert.equal(r.existing.length, 0);
    assert.equal(r.fresh.length, 1);
  });

  test('a spelling variant by the same performer is fresh but reported', () => {
    const r = matchCatalog([cand({ language: 'en', source: 'billboard', artist: 'Elvis Presley', title: 'Hound Dogg' })], catalog);
    assert.equal(r.fresh.length, 1);
    assert.deepEqual(r.possibleDuplicates.map((p) => [p.songId, p.reason]), [[239, 'similar-title-same-performer']]);
    const he = matchCatalog([cand({ artist: 'שולי נתן', title: 'ירושליים של זהב' })], catalog);
    assert.deepEqual(he.possibleDuplicates.map((p) => [p.songId, p.reason]), [[21, 'similar-title-same-performer']]);
  });

  test('short titles by the same performer need an exact match (no typo allowance)', () => {
    const r = matchCatalog([cand({ artist: 'ירדנה ארזי', title: 'בן אדאם' })], catalog);
    assert.equal(r.fresh.length, 1);
    assert.equal(r.possibleDuplicates.filter((p) => p.reason === 'similar-title-same-performer').length, 0);
  });

  test('Hebrew plene / defective spelling of the title is reported for the same performer', () => {
    const songs = [{ id: 1, artist: 'א', title: 'אמא', language: 'he' }];
    const r = matchCatalog([cand({ artist: 'א', title: 'אימא' })], songs);
    assert.equal(r.possibleDuplicates[0].reason, 'similar-title-same-performer');
  });
});

describe('merging within the batch', () => {
  test('same song in two charts and years → bestRank, firstChartYear, charts', () => {
    const merged = mergeCandidates([
      cand({ source: 'reshet-gimel', chartYear: 1991, rank: 7, artist: 'יהודית רביץ', title: 'באה מאהבה' }),
      cand({ source: 'galgalatz', chartYear: 1990, rank: 12, artist: 'יהודית רביץ', title: 'באה מאהבה!' }),
      cand({ source: 'reshet-gimel', chartYear: 1990, rank: 3, artist: 'אחר', title: 'באה מאהבה' }),
    ]);
    assert.equal(merged.length, 2);
    const m = merged.find((x) => x.artist === 'יהודית רביץ');
    assert.equal(m.bestRank, 7);
    assert.equal(m.rank, 7);
    assert.equal(m.firstChartYear, 1990);
    assert.equal(m.chartYear, 1990);
    assert.equal(m.source, 'reshet-gimel');
    assert.deepEqual(m.charts.map((c) => [c.source, c.chartYear, c.rank]), [['galgalatz', 1990, 12], ['reshet-gimel', 1991, 7]]);
  });

  test('merging is idempotent and joins collaborations credited differently', () => {
    const once = mergeCandidates([
      cand({ artist: 'סטטיק ובן אל תבורי', title: 'טודו בום', chartYear: 2017, rank: 2 }),
      cand({ artist: 'בן אל תבורי וסטטיק', title: 'טודו בום', chartYear: 2018, rank: 9, source: 'galgalatz' }),
    ]);
    assert.equal(once.length, 1);
    assert.equal(once[0].charts.length, 2);
    const twice = mergeCandidates([...once, cand({ artist: 'סטטיק', title: 'טודו בום', chartYear: 2016, rank: 15 })]);
    assert.equal(twice.length, 1);
    assert.equal(twice[0].charts.length, 3);
    assert.equal(twice[0].firstChartYear, 2016);
    assert.equal(twice[0].bestRank, 2);
  });

  test('matchCatalog returns every merged song exactly once in fresh or existing', () => {
    const r = matchCatalog(
      [
        cand({ language: 'en', artist: 'Elvis Presley', title: 'Hound Dog', chartYear: 1956, rank: 2, source: 'billboard' }),
        cand({ language: 'en', artist: 'Elvis Presley', title: 'HOUND DOG', chartYear: 1957, rank: 18, source: 'billboard' }),
        cand({ language: 'en', artist: 'Nobody Known', title: 'Brand New', chartYear: 1999, rank: 1, source: 'billboard' }),
      ],
      catalog,
    );
    assert.equal(r.merged.length, 2);
    assert.equal(r.existing.length + r.fresh.length, 2);
    assert.equal(r.existing[0].candidate.charts.length, 2);
    assert.equal(r.fresh[0].title, 'Brand New');
  });
});

describe('Hebrew performer spelling variants (batch 1)', () => {
  test('"בעז שרעבי" is the catalog\'s "בועז שרעבי": the same title is an existing song', () => {
    const r = matchCatalog([cand({ artist: 'בעז שרעבי', title: 'אצלי הכל בסדר' })], catalog);
    assert.deepEqual(r.existing.map((e) => e.songId), [393]);
  });
  test('a different title by the variant spelling stays fresh', () => {
    const r = matchCatalog([cand({ artist: 'בעז שרעבי', title: 'שיר שלא קיים בקטלוג' })], catalog);
    assert.equal(r.fresh.length, 1);
  });
  test('looseHebrew drops a leading ה and inner ו / י', () => {
    assert.equal(looseHebrew('בועז שרעבי'), looseHebrew('בעז שרעבי'));
    assert.equal(looseHebrew('Rita'), null);
  });
});
