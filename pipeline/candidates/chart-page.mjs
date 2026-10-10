// Generic chart-page parser: finds the song tables (or numbered lists) of a Wikipedia
// page, works out which chart year each belongs to, and returns ranked entries.
// Anything that looks like chart data but cannot be read goes to `problems`; tables that
// are clearly something else (no title/performer columns) go to `notes`.
import { hebrewYearsIn } from './hebrew-year.mjs';
import { yearsIn } from '../sources/normalize.mjs';
import { cleanText, pageBlocks, splitCredit, stripQuotes } from './wikitext.mjs';

// Column roles, by header text (cleaned, lower-case). Checked in this order.
const ROLES = [
  ['rank', /^(?:no\.?|#|№|rank(?:ing)?|pos(?:ition|\.)?|place|placing|final|מקום|דירוג|מיקום|מס['׳]?|מספר|מס\.|מקום במצעד|מקום בגמר|מקום סופי)$/i],
  ['year', /^(?:year|שנה|שנת|השנה|שנה עברית|שנת המצעד|תאריך)$/i],
  ['language', /^(?:language|languages|שפה|שפות)$/i],
  ['artist', /artist|performer|singer|מבצע|זמר|אמן|אמנים|להקה|ביצוע|מבצעים/i],
  ['title', /title|song|single|^ה?שיר(?:\s|$)|שם ה?שיר|^שירים$/i],
];
const IGNORE_COL = /writer|composer|lyric|producer|points|label|מילים|לחן|עיבוד|ניקוד|נקודות|מלחין|כותב|הערות|notes/i;

export function columnRoles(headerTexts) {
  const roles = {};
  headerTexts.forEach((h, i) => {
    const t = h.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!t || IGNORE_COL.test(t)) return;
    for (const [role, re] of ROLES) {
      if (roles[role] === undefined && re.test(t)) { roles[role] = i; break; }
    }
  });
  return roles;
}

/**
 * Chart year from a heading/caption/title text. A Hebrew year (תשמ"ג) wins and maps to the
 * civil year it ended in; otherwise the last civil year in the text ("1982–1983" → 1983).
 */
export function yearFromText(text) {
  const heb = hebrewYearsIn(text);
  if (heb.length) return heb[heb.length - 1].civil;
  const ys = yearsIn(text);
  return ys.length ? Math.max(...ys) : null;
}

/** Leading integer of a rank cell ("1", "1.", "T-3", "3=") or null. */
export function parseRank(text) {
  const m = String(text ?? '').match(/^\s*(?:t-?|=)?\s*(\d{1,3})\b/i);
  return m ? Number(m[1]) : null;
}

/**
 * One list item → { title, artist } or null.
 * Forms: '"Title" – Artist', 'Title – Artist', '"Title" by/בביצוע Artist', 'Title / Artist'.
 * order 'artist-title' swaps the unquoted form.
 */
export function splitItem(raw, order = 'title-artist') {
  const text = cleanText(raw);
  let m = text.match(/^["“„״](.+?)["”“״]\s*(?:[-–—:,]+\s*|(?:by|בביצוע|של|מאת)\s+)?(.+)$/i);
  if (m) return { title: m[1].trim(), artist: m[2].trim() };
  m = text.match(/^(.+?)\s+(?:[-–—]{1,2}|\/|בביצוע|by)\s+(.+)$/i);
  if (!m) return null;
  const [a, b] = [stripQuotes(m[1].trim()), m[2].trim()];
  return order === 'artist-title' ? { title: stripQuotes(b), artist: a } : { title: a, artist: b };
}

/**
 * @param {object} o
 * @param {string} o.wikitext
 * @param {string} o.page          page URL (for problems and candidates)
 * @param {number|null} [o.pageYear] year of the whole page (Billboard), used when headings give none
 * @param {RegExp|null} [o.skip]   headings/captions of tables to leave out (e.g. Galgalatz's foreign chart)
 * @param {'rank'|'entry'} [o.rankMode] 'entry': every row is an entry (rank 1), the rank column is kept as `placing`
 * @param {'title-artist'|'artist-title'} [o.listOrder]
 * @returns {{ entries: {chartYear:number, rank:number, title:string, artist:string, creditRaw:string, placing?:number|null}[],
 *             problems: {page:string, reason:string}[], notes: string[] }}
 */
export function parseChartPage(o) {
  const { wikitext, page, pageYear = null, skip = null, rankMode = 'rank', listOrder = 'title-artist' } = o;
  const entries = [];
  const problems = [];
  const notes = [];
  const yearOwner = new Map(); // chartYear → block id that produced it
  const problem = (reason) => problems.push({ page, reason });

  const ctxYear = (headings, caption) => {
    for (const t of [caption, ...[...headings].reverse()]) {
      const y = t ? yearFromText(t) : null;
      if (y) return y;
    }
    return pageYear;
  };
  const where = (b) => `line ${b.line}${b.headings.length ? ` (${b.headings.join(' > ')})` : ''}`;

  /** Accept the entry unless another block already gave this year. */
  function add(blockId, b, e) {
    const owner = yearOwner.get(e.chartYear);
    if (owner !== undefined && owner !== blockId) {
      if (!b.conflicts) b.conflicts = new Set();
      if (!b.conflicts.has(e.chartYear)) {
        b.conflicts.add(e.chartYear);
        problem(`year ${e.chartYear}: a second song table/list at ${where(b)} was ignored (the first one is used)`);
      }
      return;
    }
    yearOwner.set(e.chartYear, blockId);
    entries.push(e);
  }

  pageBlocks(wikitext).forEach((b, blockId) => {
    if (b.kind === 'table') {
      const { rows, caption } = b.table;
      const skipped = skip && [caption, ...b.headings].some((t) => t && skip.test(t));
      // Header: the first row made only of header cells whose texts name a title or artist column.
      let hIdx = -1;
      let roles = {};
      for (let i = 0; i < Math.min(rows.length, 4); i++) {
        if (!rows[i].every((c) => c.header)) continue;
        const r = columnRoles(rows[i].map((c) => c.text));
        if (r.title !== undefined || r.artist !== undefined) { hIdx = i; roles = r; break; }
      }
      if (hIdx < 0) {
        // No header row: a table whose rows start with a number and have 3+ cells looks like a chart.
        const numbered = rows.filter((r) => r.length >= 3 && parseRank(r[0].text) != null && !r.every((c) => c.header));
        if (numbered.length >= 3 && !skipped) {
          problem(`table at ${where(b)} has no header row; read as rank | title | performer`);
          roles = { rank: 0, title: 1, artist: 2 };
        } else {
          const head = (rows[0] ?? []).map((c) => c.text).join(' | ').slice(0, 80);
          notes.push(`table at ${where(b)} ignored (no title/performer columns${head ? `: ${head}` : ''})`);
          return;
        }
      } else if (roles.title === undefined) {
        // e.g. "singer of the year" tables
        notes.push(`table at ${where(b)} ignored (no title column: ${rows[hIdx].map((c) => c.text).join(' | ')})`);
        return;
      } else if (roles.artist === undefined) {
        if (!skipped) problem(`table at ${where(b)} has a title column but no performer column (headers: ${rows[hIdx].map((c) => c.text).join(' | ')})`);
        return;
      } else if (rankMode === 'rank' && roles.year !== undefined && roles.rank === undefined) {
        // One row per year without a rank: a "song of the year" summary, not a chart.
        notes.push(`table at ${where(b)} ignored (one song per year, no rank column: ${rows[hIdx].map((c) => c.text).join(' | ')})`);
        return;
      }
      if (skipped) { notes.push(`table at ${where(b)} skipped (${skip})`); return; }
      let year = ctxYear(b.headings, caption);
      let order = 0;
      let orderNoted = false;
      for (let i = hIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const texts = row.map((c) => c.text);
        if (!texts.some(Boolean)) continue;
        const distinct = new Set(row.map((c) => c.raw));
        // A sub-heading row inside the table ("1983", "תשמ"ג") sets the year for the rows below.
        if (row.every((c) => c.header) || distinct.size === 1) {
          const y = yearFromText(texts.join(' '));
          if (y) { year = y; order = 0; }
          continue;
        }
        const rowDesc = `${where(b)} row "${texts.join(' | ').slice(0, 100)}"`;
        const rowYear = roles.year !== undefined ? yearFromText(texts[roles.year]) : year;
        if (!rowYear) { problem(`no chart year for ${rowDesc}`); continue; }
        const title = stripQuotes(texts[roles.title] ?? '');
        const credit = texts[roles.artist] ?? '';
        let rank;
        let placing;
        if (rankMode === 'entry') {
          rank = 1;
          placing = roles.rank !== undefined ? parseRank(texts[roles.rank]) : null;
        } else if (roles.rank !== undefined) {
          rank = parseRank(texts[roles.rank]);
          if (rank == null) { problem(`no rank in ${rowDesc}`); continue; }
        } else {
          rank = ++order;
          if (!orderNoted) { notes.push(`table at ${where(b)}: no rank column, ranks taken from row order`); orderNoted = true; }
        }
        if (!title || !credit) {
          // Entry tables (Eurovision) have years without an entry ("did not participate").
          if (rankMode === 'entry' && !title && !credit) { notes.push(`no entry in ${rowDesc}`); continue; }
          if (rankMode === 'entry' && /לא השתתפ|did not|withdr|נסוג|פסל|disqualif/i.test(texts.join(' '))) { notes.push(`no entry in ${rowDesc}`); continue; }
          problem(`missing ${title ? 'performer' : 'title'} in ${rowDesc}`);
          continue;
        }
        const e = { chartYear: rowYear, rank, title, ...splitCredit(credit) };
        if (rankMode === 'entry') e.placing = placing;
        if (roles.language !== undefined) e.languageText = texts[roles.language];
        add(roles.year !== undefined ? `${blockId}:${rowYear}` : blockId, b, e);
      }
      return;
    }
    // Numbered list
    const year = ctxYear(b.headings, '');
    if (skip && b.headings.some((t) => skip.test(t))) { notes.push(`list at ${where(b)} skipped (${skip})`); return; }
    const parsed = b.items.map((it) => ({ it, s: splitItem(it.raw, listOrder) }));
    const songLike = parsed.filter((p) => p.s).length;
    if (!year) {
      if (songLike >= 3) problem(`numbered list at ${where(b)} looks like a chart but has no year`);
      else notes.push(`list at ${where(b)} ignored (no year)`);
      return;
    }
    if (songLike === 0) { notes.push(`list at ${where(b)} ignored (no "title – performer" items)`); return; }
    parsed.forEach(({ it, s }, i) => {
      const rank = it.rank ?? i + 1;
      if (!s) { problem(`cannot split title/performer in list item ${rank} at ${where(b)}: "${cleanText(it.raw).slice(0, 100)}"`); return; }
      const title = stripQuotes(s.title);
      if (!title || !s.artist) { problem(`missing title or performer in list item ${rank} at ${where(b)}`); return; }
      add(blockId, b, { chartYear: year, rank: rankMode === 'entry' ? 1 : rank, title, ...splitCredit(s.artist) });
    });
  });
  return { entries, problems, notes };
}
