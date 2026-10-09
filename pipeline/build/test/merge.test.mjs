import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatSongs, readCatalog } from '../catalog-io.mjs';
import { addSongs, validateSong } from '../merge.mjs';

const catalog = readCatalog();
const song = (o) => ({ artist: 'New Artist', title: 'New Song', year: 1999, language: 'en', genre: 'pop', difficulty: 2, ...o });

describe('addSongs', () => {
  test('assigns the next ids and keeps the key order', () => {
    const out = addSongs(catalog, [
      { itunesTrackId: 123, titleAliases: ['NS'], difficulty: 3, genre: 'rock', language: 'en', year: 2001, title: 'New Song', artist: 'New Artist', artistKeys: ['New Artist'] },
      song({ title: 'Other Song' }),
      { ...song({ artist: 'זמר חדש', title: 'שיר חדש', language: 'he' }), id: 5 },
    ]);
    assert.equal(out.length, catalog.length + 3);
    const added = out.slice(catalog.length);
    assert.deepEqual(added.map((s) => s.id), [670, 671, 672]);
    assert.deepEqual(Object.keys(added[0]), ['id', 'artist', 'title', 'year', 'language', 'genre', 'difficulty', 'artistKeys', 'titleAliases', 'itunesTrackId']);
    assert.equal(
      formatSongs(added.slice(2)),
      '[\n  {"id":672,"artist":"זמר חדש","title":"שיר חדש","year":1999,"language":"he","genre":"pop","difficulty":2}\n]\n',
    );
    assert.equal(catalog.length, readCatalog().length, 'input not changed');
  });

  test('refuses a song already in the catalog, also under another spelling', () => {
    assert.throws(() => addSongs(catalog, [song({ artist: 'Elvis Presley', title: 'Hound dog', year: 1956, genre: 'rock' })]), /already in the catalog as song 239/);
    assert.throws(() => addSongs(catalog, [song({ artist: 'ירדנה ארזי', title: 'בֶּן אָדָם', language: 'he' })]), /song 169/);
  });

  test('accepts the same title by another performer', () => {
    const out = addSongs(catalog, [song({ artist: 'שלמה ארצי', title: 'בן אדם', language: 'he' })]);
    assert.equal(out.length, catalog.length + 1);
  });

  test('refuses a song repeated within the batch, and adds nothing', () => {
    assert.throws(() => addSongs(catalog, [song(), song({ title: 'NEW SONG!' })]), /repeated in the batch/);
  });

  test('ids continue after the highest id, not the length', () => {
    const out = addSongs([{ id: 3, ...song({ title: 'A' }) }, { id: 10, ...song({ title: 'B' }) }], [song({ title: 'C' })]);
    assert.equal(out[2].id, 11);
  });
});

describe('validateSong', () => {
  test('the whole catalog is valid', () => {
    for (const { id, ...s } of catalog) assert.deepEqual(validateSong(s), [], String(id));
  });
  test('rejects bad fields', () => {
    const bad = [
      [{ genre: 'mizrahi' }, /genre/],
      [{ difficulty: 0 }, /difficulty/],
      [{ difficulty: 4 }, /difficulty/],
      [{ language: 'fr' }, /language/],
      [{ year: 1850 }, /year/],
      [{ language: 'he' }, /Hebrew script/],
      [{ title: 'שיר' }, /Latin script/],
      [{ artist: 'זמר' }, /Latin script/],
      [{ artistAliases: [] }, /artistAliases/],
      [{ itunesTrackId: '12' }, /itunesTrackId/],
      [{ extra: 1 }, /unknown field/],
      [{ title: ' x' }, /title/],
    ];
    for (const [patch, re] of bad) {
      const errors = validateSong(song(patch));
      assert.ok(errors.some((e) => re.test(e)), `${JSON.stringify(patch)}: ${errors}`);
    }
    assert.throws(() => addSongs(catalog, [song({ genre: 'x' })]), (e) => e.problems.length === 1);
  });
});
