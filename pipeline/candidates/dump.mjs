// Debug helper: prints raw wikitext excerpts of Wikipedia pages to the job log, so the
// layout of a page can be read where the pages themselves cannot be opened.
// Request file (pipeline/dump-request.json): { "pages": [{ "wiki": "he", "title": "...", "find": ["text", ...], "chars": 2500 }] }
import { readFileSync } from 'node:fs';
import { fetchWikitext } from './index.mjs';
import { getJson } from '../sources/http.mjs';

const file = process.argv[2] ?? new URL('../dump-request.json', import.meta.url);
const { pages } = JSON.parse(readFileSync(file, 'utf8'));
for (const p of pages) {
  const text = await fetchWikitext(p.wiki ?? 'he', p.title, getJson).catch((e) => `ERROR ${e.message}`);
  const t = typeof text === 'string' ? text : text === null ? 'MISSING PAGE' : text.wikitext;
  const chars = p.chars ?? 2500;
  console.log(`\n===== ${p.wiki ?? 'he'}:${p.title} (${t.length} chars) =====`);
  for (const needle of p.find ?? ['']) {
    const at = needle ? t.indexOf(needle) : 0;
    console.log(`----- find "${needle}" → ${at}`);
    if (at >= 0) console.log(t.slice(Math.max(0, at - 200), at + chars));
  }
}
