import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanText, pageBlocks, parseTable, splitCredit, splitTop, stripQuotes } from '../wikitext.mjs';

describe('cleanText', () => {
  test('links, refs, footnotes, templates and bold are removed', () => {
    assert.equal(cleanText('"[[Like a Virgin (song)|Like a Virgin]]"<ref name="a">x</ref>{{efn|note}}'), '"Like a Virgin"');
    assert.equal(cleanText("'''[[Wham!]]''' featuring [[George Michael]]<ref name=x/>"), 'Wham! featuring George Michael');
    assert.equal(cleanText('{{sortname|Chaka|Khan}}'), 'Chaka Khan');
    assert.equal(cleanText('{{sort|Beatles|[[The Beatles]]}}'), 'The Beatles');
    assert.equal(cleanText('{{nowrap|[[Hall & Oates|Daryl Hall &amp; John Oates]]}}'), 'Daryl Hall & John Oates');
    assert.equal(cleanText('Song<sup>[a]</sup>'), 'Song');
    assert.equal(cleanText('Song{{dagger}}'), 'Song');
    assert.equal(cleanText('Song †'), 'Song');
  });
  test('a link without display text loses its "(song)" / "(שיר)" disambiguation only', () => {
    assert.equal(cleanText('[[ימים טובים (שיר)]]'), 'ימים טובים');
    assert.equal(cleanText("[[Don't You (Forget About Me)]]"), "Don't You (Forget About Me)");
    assert.equal(cleanText('[[Heart (band)]]'), 'Heart');
  });
  test('Hebrew {{ש}} line break and <br> become spaces; file links are dropped', () => {
    assert.equal(cleanText('[[גידי גוב]]{{ש}}ו[[שלום חנוך]]'), 'גידי גוב ושלום חנוך');
    assert.equal(cleanText('A<br />B'), 'A B');
    assert.equal(cleanText('[[File:x.jpg|20px]] Song'), 'Song');
  });
  test('an unclosed <ref> at the end of a cell is dropped', () => {
    assert.equal(cleanText('Song<ref>{{cite web|title=x'), 'Song');
  });
});

describe('stripQuotes and splitCredit', () => {
  test('outer quotes go, inner gershayim stay', () => {
    assert.equal(stripQuotes('"Careless Whisper"'), 'Careless Whisper');
    assert.equal(stripQuotes('“Hey Jude”'), 'Hey Jude');
    assert.equal(stripQuotes('״חופים״'), 'חופים');
    assert.equal(stripQuotes('צה"ל'), 'צה"ל');
    assert.equal(stripQuotes('"Don\'t Be Cruel" / "Hound Dog"'), "Don't Be Cruel / Hound Dog");
    assert.equal(stripQuotes('"Song" (live)'), 'Song (live)');
  });
  test('featured artists are cut, duets are kept, the full credit is kept', () => {
    assert.deepEqual(splitCredit('Wham! featuring George Michael'), { artist: 'Wham!', creditRaw: 'Wham! featuring George Michael' });
    assert.equal(splitCredit('Major Lazer and DJ Snake feat. MØ').artist, 'Major Lazer and DJ Snake');
    assert.equal(splitCredit('Drake ft. Rihanna').artist, 'Drake');
    assert.equal(splitCredit('חנן בן ארי בהשתתפות עדן חסון').artist, 'חנן בן ארי');
    assert.equal(splitCredit('כוורת מארחת את גידי גוב').artist, 'כוורת');
    assert.equal(splitCredit('Simon & Garfunkel').artist, 'Simon & Garfunkel');
    assert.equal(splitCredit('גידי גוב ושלום חנוך').artist, 'גידי גוב ושלום חנוך');
  });
});

describe('tables', () => {
  test('splitTop ignores separators inside links and templates', () => {
    assert.deepEqual(splitTop('1 || [[A|B]] || {{x|y}}', '||'), ['1 ', ' [[A|B]] ', ' {{x|y}}']);
  });
  test('rowspan and colspan are expanded; attributes are not content', () => {
    const t = parseTable([
      '{| class="wikitable"',
      '|+ Caption',
      '! No. !! Title !! Artist',
      '|-',
      '| 1 || style="x" | "A" || rowspan="2" | [[Taylor Swift]]',
      '|-',
      '| 2 || "B"',
      '|-',
      '| 3 || colspan="2" | n/a',
      '|}',
    ]);
    assert.equal(t.caption, 'Caption');
    assert.deepEqual(t.rows.map((r) => r.map((c) => c.text)), [['No.', 'Title', 'Artist'], ['1', '"A"', 'Taylor Swift'], ['2', '"B"', 'Taylor Swift'], ['3', 'n/a', 'n/a']]);
    assert.equal(t.rows[2][2].spanned, true);
  });
  test('multi-line cells and nested tables stay inside their cell', () => {
    const t = parseTable(['{|', '! a', '! b', '|-', '| x', 'continued', '| {{nowrap|y}}', '{|', '| inner', '|}', '|}']);
    assert.equal(t.rows.length, 2);
    assert.equal(t.rows[1][0].text, 'x continued');
    assert.match(t.rows[1][1].text, /^y/);
  });
  test('pageBlocks gives tables and numbered lists with their headings', () => {
    const blocks = pageBlocks(['== תשמ"ג ==', '=== sub ===', '{|', '! a', '|}', '== x ==', '# one – two', '# three – four', '## sub-item', 'text', '1. hand – numbered'].join('\n'));
    assert.deepEqual(blocks.map((b) => [b.kind, b.headings]), [['table', ['תשמ"ג', 'sub']], ['list', ['x']], ['list', ['x']]]);
    assert.equal(blocks[1].items.length, 2);
    assert.equal(blocks[2].items[0].rank, 1);
  });
});
