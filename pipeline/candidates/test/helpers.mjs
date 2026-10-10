// Shared test helpers for the candidate extractors (not a test file itself; running it is a no-op).
import { readFileSync } from 'node:fs';

/** A hand-made wikitext fixture (each states its source page in its first comment). */
export function wikitext(name) {
  return readFileSync(new URL(`./fixtures/${name}.wikitext`, import.meta.url), 'utf8');
}

/** An action=parse response (formatversion=2) for a fixture, as the MediaWiki API returns it. */
export function parseResponse(title, name) {
  return { parse: { title, pageid: 1, wikitext: wikitext(name) } };
}

export const MISSING = { error: { code: 'missingtitle', info: "The page you specified doesn't exist." } };

export function allpages(...titles) {
  return { batchcomplete: true, query: { allpages: titles.map((title, i) => ({ pageid: i + 1, ns: 0, title })) } };
}

export function search(...titles) {
  return { batchcomplete: true, query: { searchinfo: { totalhits: titles.length }, search: titles.map((title, i) => ({ ns: 0, title, pageid: i + 1 })) } };
}
