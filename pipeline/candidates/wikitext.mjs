// Wikitext helpers for chart pages: turning cell wikitext into plain text, splitting
// featured-artist credits, and reading tables, headings and numbered lists.
// Pure functions, no network.
import { stripNoise } from '../sources/wikipedia.mjs';

// ---------- splitting at top level (outside [[…]] and {{…}}) ----------

/** Split `s` on `sep` where it is not inside [[…]], {{…}} or [ext links]. */
export function splitTop(s, sep) {
  const out = [];
  let link = 0;
  let tpl = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === '[[') { link++; i++; continue; }
    if (two === ']]') { link = Math.max(0, link - 1); i++; continue; }
    if (two === '{{') { tpl++; i++; continue; }
    if (two === '}}') { tpl = Math.max(0, tpl - 1); i++; continue; }
    if (!link && !tpl && s.startsWith(sep, i)) {
      out.push(s.slice(start, i));
      i += sep.length - 1;
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/** Index of the first top-level occurrence of `sep`, or -1. */
function indexTop(s, sep) {
  const parts = splitTop(s, sep);
  return parts.length > 1 ? parts[0].length : -1;
}

// ---------- templates → text ----------

const DROP_TEMPLATES = /^(?:efn|efn-[a-z]+|sfn|sfnp|refn|ref|note|r|cn|citation needed|fact|dagger|double-dagger|double dagger|†|‡|\*|hs|hidden sort key|sort key|flagicon|flag icon|anchor|כ|הערה|הערות|הערה בשוליים|צ|צ-מאמר|צ-אתר|clarify|dubious|nbsp|-|,)$/i;
const FIRST_ARG = /^(?:nowrap|nobr|no wrap|small|big|lang|lang-[a-z]+|nowrap begin|ill|interlanguage link|interlanguage link multi|ill2|ltr|rtl|ימין|שמאל|כ-שמאל|מונח|נוטה|ללא גלישה|קישור שפה|קישור בשפה זרה|שפה|abbr|tooltip|tt|highlight|nowiki)$/i;

function templateText(inner) {
  const parts = splitTop(inner, '|');
  const name = parts[0].trim().replace(/_/g, ' ');
  const args = parts.slice(1);
  const positional = args.filter((a) => indexTop(a, '=') < 0 || /^\s*\d+\s*=/.test(a)).map((a) => a.replace(/^\s*\d+\s*=/, ''));
  const lname = name.toLowerCase();
  if (DROP_TEMPLATES.test(name)) return '';
  if (/^sort$/i.test(name)) return positional[1] ?? positional[0] ?? '';
  if (/^(?:sortname|sort name)$/i.test(name)) return [positional[0], positional[1]].filter(Boolean).join(' ');
  if (/^(?:lang|lang-[a-z]+)$/i.test(name) && lname === 'lang') return positional[1] ?? positional[0] ?? '';
  if (FIRST_ARG.test(name)) return positional[0] ?? '';
  if (/^(?:br|break|ש)$/i.test(name)) return ' ';
  // Unknown template: keep its first positional argument (often the visible text), else drop it.
  return positional[0] ?? '';
}

/** Replace templates, innermost first. */
function expandTemplates(s) {
  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => templateText(inner));
  } while (s !== prev && ++guard < 20);
  return s.replace(/\{\{|\}\}/g, '');
}

const DISAMBIG = /\s*\((?:[^()]*\b(?:song|single|band|singer|musician|rapper|group|duo|entertainer|performer)\b[^()]*|[^()]*(?:שיר|סינגל|להקה|זמר|זמרת|מוזיקאי|ראפר|הרכב|צמד)[^()]*)\)\s*$/i;

/** [[Target|Text]] → Text, [[Target]] → Target (without a "(song)" style suffix). Files and categories are dropped. */
function replaceLinks(s) {
  let prev;
  let guard = 0;
  do {
    prev = s;
    s = s.replace(/\[\[([^[\]]*)\]\]/g, (_, inner) => {
      if (/^\s*(?:file|image|קובץ|תמונה|category|קטגוריה)\s*:/i.test(inner)) return '';
      const bar = inner.indexOf('|');
      if (bar >= 0) {
        const text = inner.slice(bar + 1);
        if (text.trim()) return text;
        return inner.slice(0, bar).replace(/\s*\([^()]*\)\s*$/, ''); // pipe trick
      }
      return inner.replace(/^:/, '').replace(DISAMBIG, '');
    });
  } while (s !== prev && ++guard < 5);
  return s.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\[(?:https?:)?\/\/\S+\]/g, '');
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&ndash;': '–', '&mdash;': '—', '&lrm;': '', '&rlm;': '', '&thinsp;': ' ', '&lt;': '<', '&gt;': '>' };

/**
 * Cell wikitext → plain text: no refs, comments, footnotes, templates, links, bold/italic,
 * HTML tags or entities; whitespace collapsed. Quotes are kept (see stripQuotes).
 */
export function cleanText(wikitext) {
  let s = stripNoise(String(wikitext ?? ''));
  s = s.replace(/<ref\b[^>]*>[\s\S]*$/i, ''); // unclosed <ref>
  s = s.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = expandTemplates(s);
  s = replaceLinks(s);
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&[a-z]+;|&#\d+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? (/^&#\d+;$/.test(e) ? String.fromCodePoint(Number(e.slice(2, -1))) : ' '));
  s = s.replace(/'''''|'''|''(?!')/g, '');
  s = s.replace(/[‎‏‪-‮]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  // Footnote markers left at the end: "Song*", "Song †", "Song [a]", "Song (1)"
  s = s.replace(/(?:\s*(?:[*†‡§¶#]+|\[[a-z0-9]{1,3}\]))+$/i, '').trim();
  return s;
}

const OUTER_QUOTES = [['"', '"'], ['“', '”'], ['„', '“'], ['„', '”'], ['”', '”'], ['״', '״'], ['«', '»'], ["'", "'"]];

/** Remove quotes around a title; '"A" / "B"' (double A-side) → 'A / B'. Inner gershayim (צה"ל) stay. */
export function stripQuotes(title) {
  let t = String(title ?? '').trim();
  // Double A-sides and medleys: "A" / "B", "A"/"B"
  if (/^["“].*["”]\s*\/\s*["“].*["”]$/.test(t)) {
    return t.split(/["”]\s*\/\s*["“]/).map((p) => stripQuotes(p.replace(/^["“]|["”]$/g, ''))).join(' / ');
  }
  for (const [a, b] of OUTER_QUOTES) {
    if (t.length > 2 && t.startsWith(a) && t.endsWith(b) && !t.slice(1, -1).includes(a === b ? a : b)) {
      return t.slice(a.length, -b.length).trim();
    }
  }
  // A quoted title followed by a note: '"Song" (live)' → 'Song (live)'
  const m = t.match(/^["“](.+?)["”](\s.*)?$/);
  if (m) return (m[1] + (m[2] ?? '')).trim();
  return t;
}

const FEAT = /\s+(?:\(\s*)?(?:featuring|feat\.?|ft\.?|פיצ'רינג|פיצ׳רינג|בהשתתפות|מארחת? את|מארחים את)\s+/i;

/**
 * Split a performer credit: "Wham! featuring George Michael" → { artist: 'Wham!', creditRaw: '…' }.
 * Only featured-artist forms are split; duets ("A & B", "A and B", "A ו-B", "A עם B") stay whole.
 */
export function splitCredit(credit) {
  const creditRaw = String(credit ?? '').trim();
  const m = creditRaw.match(FEAT);
  const artist = m ? creditRaw.slice(0, m.index).trim().replace(/[,(]\s*$/, '').trim() : creditRaw;
  return { artist: artist || creditRaw, creditRaw };
}

// ---------- tables ----------

/** Split a cell into attributes and content: 'style="x" | text' → { attrs, content }. */
function cellParts(raw) {
  const i = indexTop(raw, '|');
  if (i >= 0 && raw[i + 1] !== '|') {
    const attrs = raw.slice(0, i);
    if (/^\s*(?:[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"']+)\s*)+$/i.test(attrs) || !attrs.trim()) {
      return { attrs, content: raw.slice(i + 1) };
    }
  }
  return { attrs: '', content: raw };
}

const spanOf = (attrs, name) => {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?\\s*(\\d+)`, 'i'));
  return m ? Math.max(1, Math.min(200, Number(m[1]))) : 1;
};

/**
 * Parse one table (lines from "{|" to "|}") into a grid: rows of cells
 * { header, raw, text } with rowspan/colspan expanded. Nested tables are kept as raw text.
 * @returns {{ caption: string, rows: {header:boolean, raw:string, text:string, spanned?:boolean}[][] }}
 */
export function parseTable(lines) {
  const rawRows = [];
  let row = null;
  let caption = '';
  let depth = 0;
  let last = null; // last cell, for continuation lines
  const newRow = () => { row = []; rawRows.push(row); last = null; };
  for (const line0 of lines) {
    const line = line0.trim();
    if (line.startsWith('{|')) {
      depth++;
      if (depth > 1 && last) last.raw += '\n' + line0;
      continue;
    }
    if (depth > 1) {
      if (line.startsWith('|}')) depth--;
      if (last) last.raw += '\n' + line0;
      continue;
    }
    if (line.startsWith('|}')) { depth--; continue; }
    if (line.startsWith('|+')) { caption = cellParts(line.slice(2)).content; continue; }
    if (line.startsWith('|-')) { newRow(); continue; }
    if (line.startsWith('!') || line.startsWith('|')) {
      if (!row) newRow();
      const header = line.startsWith('!');
      const body = line.slice(1);
      let pieces = splitTop(body, '||');
      if (header) pieces = pieces.flatMap((p) => splitTop(p, '!!'));
      for (const p of pieces) {
        const { attrs, content } = cellParts(p);
        last = { header, attrs, raw: content };
        row.push(last);
      }
      continue;
    }
    if (last) last.raw += '\n' + line0;
    else if (line && !row) caption = caption || '';
  }
  // Expand rowspan / colspan into a grid.
  const grid = [];
  const pending = []; // column → { cell, left }
  for (const r of rawRows) {
    if (!r.length && !pending.some((p) => p && p.left > 0)) continue;
    const out = [];
    let col = 0;
    const take = () => {
      while (pending[col] && pending[col].left > 0) {
        out[col] = { ...pending[col].cell, spanned: true };
        pending[col].left--;
        col++;
      }
    };
    for (const c of r) {
      take();
      const cell = { header: c.header, raw: c.raw, text: cleanText(c.raw) };
      const rs = spanOf(c.attrs, 'rowspan');
      const cs = spanOf(c.attrs, 'colspan');
      for (let k = 0; k < cs; k++) {
        out[col] = cell;
        if (rs > 1) pending[col] = { cell, left: rs - 1 };
        col++;
      }
    }
    take();
    for (let k = 0; k < out.length; k++) if (!out[k]) out[k] = { header: false, raw: '', text: '' };
    if (out.length) grid.push(out);
  }
  return { caption: cleanText(caption), rows: grid };
}

const HEADING = /^(={2,6})\s*(.*?)\s*\1\s*$/;

/**
 * Walk a page: tables and numbered-list runs, each with the headings above it.
 * @returns {{ kind:'table'|'list', line:number, headings:string[], table?:object, items?:{rank:number|null, raw:string, line:number}[] }[]}
 */
export function pageBlocks(wikitext) {
  const lines = stripNoise(wikitext).split('\n');
  const blocks = [];
  const stack = []; // [{ level, text }]
  let list = null;
  const headings = () => stack.map((h) => h.text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    const h = t.match(HEADING);
    if (h) {
      list = null;
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: cleanText(h[2]) });
      continue;
    }
    if (t.startsWith('{|')) {
      list = null;
      const start = i;
      let depth = 0;
      for (; i < lines.length; i++) {
        const u = lines[i].trim();
        if (u.startsWith('{|')) depth++;
        else if (u.startsWith('|}')) { depth--; if (depth === 0) break; }
      }
      blocks.push({ kind: 'table', line: start + 1, headings: headings(), table: parseTable(lines.slice(start, i + 1)) });
      continue;
    }
    // "# item" (numbered list) or "* 3. item" / "3. item" (hand-numbered)
    const num = t.match(/^#(?![#:*])\s*(.*)$/);
    const hand = !num && t.match(/^(?:[*:]\s*)?(\d{1,3})\s*[.)]\s+(.*)$/);
    if (num || hand) {
      if (!list) {
        list = { kind: 'list', line: i + 1, headings: headings(), items: [] };
        blocks.push(list);
      }
      if (num) list.items.push({ rank: null, raw: num[1], line: i + 1 });
      else list.items.push({ rank: Number(hand[1]), raw: hand[2], line: i + 1 });
      continue;
    }
    if (/^#[#:*]/.test(t)) continue; // sub-items of a list
    if (t) list = null;
  }
  return blocks;
}
