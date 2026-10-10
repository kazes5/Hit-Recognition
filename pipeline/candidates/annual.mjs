// Parser for the he.wikipedia annual Hebrew hit-parade pages
// ("מצעד הפזמונים העברי השנתי (ה'תש"ל–ה'תשל"ט)", "… (ה'תש"ף ואילך)", …), which hold the
// Reshet Gimel AND the Galgalatz / Galei Tzahal annual rankings.
//
// Real layout (checked on raw wikitext, 2026-10):
//  - One section per year: "=== ה'תש"ל-1970 ===", "== ה'תשע"ח-2018==", "==ה'תשפ"ה-2025==".
//    The civil year is the number after the dash (= the year the Hebrew year ended in).
//  - Several rankings per year, each introduced by a label above it: a plain line ending in ":"
//    ("הדירוג של "קול ישראל" לשנה זו:"), a bold label ("'''המצעד השנתי של גלגלצ:'''", possibly on
//    the same line as "{{טורים" or right after the "}}" of the previous list) or a ";" line
//    (";כאן גימל{{הערה|…}}"). Only the label nearest above a list counts; a list with no label
//    in its year section is Reshet Gimel (Kol Yisrael).
//  - Two list containers: a layout table "{| |valign="top"| * 1. … |width="50"| |valign="top"| * 11. … |}"
//    with explicit numbers ("* 7א." = a tie), and "{{טורים | רוחב = … | תוכן = # … }}" with "#" items
//    (implicit 1, 2, 3 …). "{{שני טורים|…}}" holds singer-of-the-year lists and is ignored.
//  - Item: "[[link|Title]]" – [[Artist]] (lyricist/composer). Soloists: "[[להקה]], סולן: [[X]]".
import { stripNoise } from '../sources/wikipedia.mjs';
import { hebrewYearsIn } from './hebrew-year.mjs';
import { cleanText } from './wikitext.mjs';

export const AIRPLAY = /מדיה פורסט|מדיה פורט|אקו"ם|אקו״ם|השמעות|מושמע/;
const GALGALATZ = /גלגלצ|גלי צה"ל|גלי צה״ל|גל"צ|גל״צ/;
// "רשת ג" is also written without the geresh ("המצעד השנתי של רשת ג:", 2016).
const RESHET_GIMEL = /קול ישראל|רשת ג(?![א-ת])|רשת גימל|כאן גימל|כאן ג(?![א-ת])|הגל הקל/;
// A label that names no station is the page's main (Reshet Gimel) ranking: "דירוג הרשת לשנה זו:",
// "הדירוג לשנה זו:", "דירוג המצעד:", "דירוג השירים:", "מצעד עמוס להיטים, והדירוג הוא:" (1974–1998).
const GENERIC = /^(?:ה?דירוג(?: הרשת| המצעד| השירים)?(?: לשנה זו)?|.*והדירוג הוא)\s*:?\s*$/;
// Rankings that are neither station: websites, regional radio, Jewish/Hasidic, karaoke (decision D: skipped).
const OTHER = /מאקו|כאן מורשת|וואלה|ynet ורדיו|רדיו תל אביב|רדיו דרום|רדיו קול|ישראל היום|היטליסט|אייס|סרוגים|קריוקי|אקו 99|מאזיני התחנה|גולשי האתר|ערוץ 24|האזוריות/;

/** Station label → 'reshet-gimel' | 'galgalatz' | 'airplay' | 'other' | null (unknown). */
export function labelSource(label) {
  const t = String(label ?? '').trim();
  if (AIRPLAY.test(t)) return 'airplay';
  if (GALGALATZ.test(t)) return 'galgalatz';
  if (RESHET_GIMEL.test(t)) return 'reshet-gimel';
  if (OTHER.test(t)) return 'other';
  if (GENERIC.test(t)) return 'reshet-gimel';
  return null;
}

// ---------- top-level scanning (outside [[…]] and {{…}}) ----------

function scan(s, visit) {
  let link = 0;
  let tpl = 0;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === '[[') { link++; i++; continue; }
    if (two === ']]' && link) { link--; i++; continue; }
    if (two === '{{') { tpl++; i++; continue; }
    if (two === '}}' && tpl) { tpl--; i++; continue; }
    if (!link && !tpl && visit(i) === false) return;
  }
}

/** Index of the end of the template starting at `start` ("{{"), just after its "}}"; -1 if unbalanced. */
function templateEnd(s, start) {
  let depth = 0;
  for (let i = start; i < s.length - 1; i++) {
    if (s[i] === '{' && s[i + 1] === '{') { depth++; i++; continue; }
    if (s[i] === '}' && s[i + 1] === '}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Remove whole templates by name ({{הערה|…}} footnotes), nesting-aware. */
export function removeTemplates(s, names) {
  const re = new RegExp(`\\{\\{\\s*(?:${names.join('|')})\\s*(?=[|}])`, 'g');
  let out = s;
  for (let guard = 0; guard < 10000; guard++) {
    re.lastIndex = 0;
    const m = re.exec(out);
    if (!m) break;
    const end = templateEnd(out, m.index);
    out = end < 0 ? out.slice(0, m.index) : out.slice(0, m.index) + out.slice(end);
  }
  return out;
}

const DASH_SEP = /^\s[–—-]+\s/;
const QUOTES = new Set(['"', '“', '”', '„', '״']);

/** Index of the first top-level " – " / " - " separator, or -1. */
function dashIndex(s) {
  let at = -1;
  scan(s, (i) => {
    if (DASH_SEP.test(s.slice(i, i + 4)) || (/\s/.test(s[i]) && /^[–—-]+\s/.test(s.slice(i + 1, i + 4)))) { at = i; return false; }
    return true;
  });
  return at;
}

/** Strip balanced top-level "(…)" groups at the end of a performer text: lyricist/composer credits. */
function stripTrailingParens(s) {
  let t = s.trimEnd();
  for (let guard = 0; guard < 10 && t.endsWith(')'); guard++) {
    // find the "(" that opens the final group, at top level
    let depth = 0;
    let open = -1;
    const tops = [];
    scan(t, (i) => { tops.push(i); return true; });
    for (let k = tops.length - 1; k >= 0; k--) {
      const ch = t[tops[k]];
      if (ch === ')') depth++;
      else if (ch === '(') { depth--; if (depth === 0) { open = tops[k]; break; } }
    }
    if (open <= 0) break;
    t = t.slice(0, open).trimEnd();
  }
  return t;
}

const COVER = /\s*\((?:קאבר|גרסת כיסוי|גרסה מחודשת)\)\s*$/;

/**
 * One list item → { title, artist, creditRaw, soloist? } or { error }.
 * '"[[link|Title]]" – [[Band]], סולן: [[X]] (lyrics/music)'
 */
export function parseItem(raw) {
  const s = String(raw ?? '').trim();
  let titleRaw;
  let rest;
  if (QUOTES.has(s[0])) {
    // The closing quote is the first top-level quote followed by optional "(…)" notes and a dash.
    scan(s, (i) => {
      if (i === 0 || !QUOTES.has(s[i])) return true;
      const m = s.slice(i + 1).match(/^\s*(?:\([^()]*\)\s*)*[–—-]+\s/);
      if (!m) return true;
      titleRaw = s.slice(1, i);
      rest = s.slice(i + 1 + m[0].length);
      return false;
    });
    if (titleRaw === undefined) {
      // Missing or misplaced closing quote ('"אמא יקרה – דודו אהרון', '"התקווה- [[סאבלימינל]]',
      // '"סהרה" Live – טונה'): split at the first top-level dash followed by a space.
      let at = -1;
      scan(s, (i) => {
        if (i > 1 && /[–—-]/.test(s[i]) && /\s/.test(s[i + 1] ?? '')) { at = i; return false; }
        return true;
      });
      if (at < 0) return { error: 'cannot find the closing quote of the title' };
      titleRaw = s.slice(1, at).trim();
      const q = [...titleRaw].findIndex((c) => QUOTES.has(c));
      if (q > 0) titleRaw = titleRaw.slice(0, q);
      rest = s.slice(at).replace(/^\s*[–—-]+\s*/, '');
    }
  } else {
    const at = dashIndex(s);
    if (at < 0) return { error: 'no " – " between title and performer' };
    titleRaw = s.slice(0, at);
    rest = s.slice(at).replace(/^\s*[–—-]+\s*/, '');
  }
  // '"[[טאטע תטהר]] - גרסה אקוסטית"': a note after the linked title, inside the quotes.
  const inner = dashIndex(titleRaw);
  if (inner > 0 && titleRaw.slice(0, inner).trim().endsWith(']]')) titleRaw = titleRaw.slice(0, inner);
  const title = cleanText(titleRaw).replace(COVER, '').replace(/^["“„״]|["”״]$/g, '').trim();

  const performer = stripTrailingParens(rest);
  const creditRaw = cleanText(performer).replace(/[,;:\s]+$/, '');
  let artist = creditRaw;
  let soloist;
  const solo = performer.match(/,\s*(?:\[\[)?(?:סולנית|סולן)(?:\|[^\]]*)?(?:\]\])?\s*:\s*/);
  if (solo) {
    artist = cleanText(performer.slice(0, solo.index)).replace(/[,;:\s]+$/, '');
    soloist = cleanText(performer.slice(solo.index + solo[0].length)).replace(/[,;:\s]+$/, '');
  }
  if (!title) return { error: 'empty title' };
  if (!artist) return { error: 'empty performer' };
  return soloist ? { title, artist, creditRaw, soloist } : { title, artist, creditRaw };
}

// ---------- page structure ----------

/** Year of a section heading: the number after the dash ("ה'תש"ל-1970"), else a single Hebrew year. */
export function headingYear(text) {
  const m = String(text).match(/[-–—]\s*(\d{4})\s*$/);
  if (m) return Number(m[1]);
  const heb = hebrewYearsIn(text);
  return heb.length === 1 && !/\d{4}/.test(text) ? heb[0].civil : null;
}

const ITEM_TABLE = /^\*\s*(\d{1,3})\s*([א-ת])?\s*[.)]\s*(.*)$/;

/** Labels in a stretch of text between lists: [{ pos, text }]. */
function labelsIn(gap) {
  const out = [];
  for (const m of gap.matchAll(/'''(.+?)'''/g)) {
    const t = cleanText(m[1]);
    if (labelSource(t) || /מצעד|דירוג/.test(t)) out.push({ pos: m.index, text: t });
  }
  let pos = 0;
  for (const line of gap.split('\n')) {
    const t = line.trim();
    if (t.startsWith(';')) out.push({ pos, text: cleanText(t.slice(1)) });
    else {
      const c = cleanText(t.replace(/'''/g, ''));
      if (c.endsWith(':') && !/^[*#|{]/.test(t)) {
        const sentences = c.split(/(?<=[.!?])\s+/);
        out.push({ pos: pos + 1, text: sentences[sentences.length - 1] });
      }
    }
    pos += line.length + 1;
  }
  return out.sort((a, b) => a.pos - b.pos);
}

/**
 * Lists of a page in order, with their year and label.
 * @returns {{ year:number|null, heading:string, label:string|null, kind:'table'|'columns'|'bare', line:number, items:{rank:number, tie:boolean, raw:string}[], bad:string[] }[]}
 */
export function annualLists(wikitext) {
  const text = removeTemplates(stripNoise(wikitext), ['הערה', 'הערות שוליים', 'ש']);
  const lineAt = (pos) => text.slice(0, pos).split('\n').length;
  const events = []; // { start, end, type }
  // headings
  for (const m of text.matchAll(/^(={2,6})\s*([^=\n].*?)\s*\1\s*$/gm)) events.push({ start: m.index, end: m.index + m[0].length, type: 'heading', level: m[1].length, text: cleanText(m[2]) });
  // {{טורים …}} and {{שני טורים …}}
  for (const m of text.matchAll(/\{\{\s*(שני טורים|טורים)\s*(?=[|\n}])/g)) {
    const end = templateEnd(text, m.index);
    events.push({ start: m.index, end: end < 0 ? text.length : end, type: m[1] === 'טורים' ? 'columns' : 'skip' });
  }
  // layout tables {| … |}
  const lines = text.split('\n');
  let pos = 0;
  const lineStarts = lines.map((l) => { const p = pos; pos += l.length + 1; return p; });
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('{|')) continue;
    let depth = 0;
    let j = i;
    for (; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.startsWith('{|')) depth++;
      else if (t.startsWith('|}')) { depth--; if (depth === 0) break; }
    }
    events.push({ start: lineStarts[i], end: (lineStarts[j] ?? text.length) + (lines[j]?.length ?? 0), type: 'table' });
    i = j;
  }
  // drop events inside other spans (lists inside {{שני טורים}}, tables inside templates)
  events.sort((a, b) => a.start - b.start || b.end - a.end);
  const top = [];
  for (const e of events) {
    const outer = top.find((o) => o.type !== 'heading' && e.start >= o.start && e.end <= o.end && o !== e);
    if (!outer) top.push(e);
  }
  // bare item runs outside every span ("* 1. …" or '# "…"' lines)
  const covered = (p) => top.some((e) => e.type !== 'heading' && p >= e.start && p < e.end);
  for (let i = 0; i < lines.length; i++) {
    const isItem = (l) => ITEM_TABLE.test(l.trim()) || /^#\s*["“„]/.test(l.trim());
    if (!isItem(lines[i]) || covered(lineStarts[i])) continue;
    let j = i;
    while (j + 1 < lines.length && isItem(lines[j + 1]) && !covered(lineStarts[j + 1])) j++;
    top.push({ start: lineStarts[i], end: lineStarts[j] + lines[j].length, type: 'bare' });
    i = j;
  }
  top.sort((a, b) => a.start - b.start);

  const out = [];
  let year = null;
  let heading = '';
  let label = null;
  let prevEnd = 0;
  for (const e of top) {
    const gap = text.slice(prevEnd, e.start);
    const ls = labelsIn(gap);
    if (ls.length) label = ls[ls.length - 1].text;
    prevEnd = Math.max(prevEnd, e.end);
    if (e.type === 'heading') {
      const y = headingYear(e.text);
      if (y || e.level <= 2) { year = y; heading = e.text; label = null; }
      continue;
    }
    if (e.type === 'skip') continue;
    const body = text.slice(e.start, e.end);
    const items = [];
    const bad = [];
    if (e.type === 'columns') {
      const inner = body.slice(2, -2);
      const m = inner.match(/\|\s*תוכן\s*=\s*/);
      if (!m) { bad.push('"טורים" without a "תוכן =" parameter'); }
      else {
        let n = 0;
        for (const l of inner.slice(m.index + m[0].length).split('\n')) {
          const t = l.trim();
          if (!t) continue;
          if (t.startsWith('|')) break; // next template parameter
          if (/^#[#:*]/.test(t)) continue;
          if (t.startsWith('#')) items.push({ rank: ++n, tie: false, raw: t.replace(/^#\s*/, '') });
          else bad.push(`unrecognised line: "${cleanText(t).slice(0, 80)}"`);
        }
      }
    } else {
      let n = 0;
      for (const l of body.split('\n')) {
        const t = l.trim();
        const m = t.match(ITEM_TABLE);
        if (m) items.push({ rank: Number(m[1]), tie: Boolean(m[2]), raw: m[3] });
        else if (/^#\s*["“„]/.test(t)) items.push({ rank: ++n, tie: false, raw: t.replace(/^#\s*/, '') });
        else if (t.startsWith('*') || t.startsWith('#')) bad.push(`unrecognised item: "${cleanText(t).slice(0, 80)}"`);
      }
    }
    out.push({ year, heading, label, kind: e.type, line: lineAt(e.start), items, bad });
  }
  return out;
}

/**
 * Entries of an annual page, per station.
 * @returns {{ entries: {source, chartYear, rank, title, artist, creditRaw, soloist?, tie?}[], problems: {source?, page, reason, detail?}[], notes: string[] }}
 */
export function parseAnnualPage({ wikitext, page }) {
  const entries = [];
  const problems = [];
  const notes = [];
  const seen = new Map(); // `${year}:${source}` → line
  for (const list of annualLists(wikitext)) {
    const where = `line ${list.line}${list.heading ? ` (${list.heading})` : ''}${list.label ? `, label "${list.label}"` : ''}`;
    if (!list.items.length && !list.bad.length) { notes.push(`empty list at ${where}`); continue; }
    const source = list.label == null ? 'reshet-gimel' : labelSource(list.label);
    if (source === 'airplay') {
      problems.push({ page, reason: 'airplay-ranking-skipped', detail: `${list.year ?? '?'}: "${list.label}" (${list.items.length} items) at ${where}` });
      continue;
    }
    if (source === 'other') {
      problems.push({ page, reason: 'other-ranking-skipped', detail: `${list.year ?? '?'}: "${list.label}" (${list.items.length} items) at ${where}` });
      continue;
    }
    if (!source) {
      problems.push({ page, reason: `unknown-ranking-label: "${list.label}" at ${where} (${list.items.length} items skipped)` });
      continue;
    }
    if (!list.year) {
      problems.push({ source, page, reason: `a ranking list with no year at ${where} (${list.items.length} items skipped)` });
      continue;
    }
    const key = `${list.year}:${source}`;
    if (seen.has(key)) {
      problems.push({ source, page, reason: `year ${list.year}: a second ${source} ranking at ${where} was ignored (the one at line ${seen.get(key)} is used)` });
      continue;
    }
    seen.set(key, list.line);
    for (const b of list.bad) problems.push({ source, page, reason: `year ${list.year}: ${b} at ${where}` });
    for (const it of list.items) {
      const r = parseItem(it.raw);
      if (r.error) {
        problems.push({ source, page, reason: `year ${list.year}, rank ${it.rank}: ${r.error}: "${cleanText(it.raw).slice(0, 100)}"` });
        continue;
      }
      const e = { source, chartYear: list.year, rank: it.rank, title: r.title, artist: r.artist, creditRaw: r.creditRaw };
      if (r.soloist) e.soloist = r.soloist;
      if (it.tie) e.tie = true;
      entries.push(e);
    }
  }
  return { entries, problems, notes };
}
