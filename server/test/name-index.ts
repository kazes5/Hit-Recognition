import {
  allowedTypos,
  artistGuessKeys,
  artistMatchKeys,
  isArtistCorrect,
  isTitleCorrect,
  titleGuessKeys,
  titleMatchKeys,
  type KnownNames,
} from '../src/guess.js';
import { songArtistKeys } from '../src/selection.js';
import type { CatalogSong } from '../src/types.js';

/**
 * An index of catalog songs by their match keys (artistMatchKeys or
 * titleMatchKeys from guess.ts), so a test can check a guess against only the
 * songs that could accept it instead of against the whole catalog.
 *
 * Why it never misses a song: a guess key g can match a song key e only if
 * g === e or g is within k = allowedTypos(letters of e) edits of e (guess.ts
 * contract). Pad both with a start and an end mark; e then has (letters + 1)
 * letter pairs ("bigrams"). One edit spoils at most 3 of them: a changed or
 * deleted letter spoils the 2 pairs it is in, an inserted letter the 1 pair it
 * splits, and swapping two neighbours the 3 pairs that touch them. Every
 * unspoiled pair of e is also a pair of g, at its own place in g. So g and e
 * share at least (letters + 1) - 3k pairs, counting repeated pairs as often as
 * both strings have them (always at least 3 with today's allowedTypos). The
 * index counts shared pairs and keeps every key that reaches its bound: a
 * superset of the keys that can match, which the real check then filters.
 */
export class NameIndex<S> {
  private readonly keys: string[] = [];
  private readonly owners: S[][] = [];
  private readonly minShared: number[] = [];
  private readonly postings = new Map<string, number[]>();
  private readonly counts: Int32Array;

  constructor(songs: readonly S[], matchKeys: (song: S) => readonly string[]) {
    const ids = new Map<string, number>();
    for (const song of songs) {
      for (const key of matchKeys(song)) {
        let id = ids.get(key);
        if (id === undefined) {
          id = this.keys.length;
          ids.set(key, id);
          this.keys.push(key);
          this.owners.push([]);
          const letters = Array.from(key).length;
          this.minShared.push(letters + 1 - 3 * allowedTypos(letters));
          for (const token of pairTokens(key)) {
            const list = this.postings.get(token);
            if (list) list.push(id);
            else this.postings.set(token, [id]);
          }
        }
        const owners = this.owners[id]!;
        if (owners[owners.length - 1] !== song) owners.push(song);
      }
    }
    this.counts = new Int32Array(this.keys.length);
  }

  /** Every song with a key that a guess with these keys could match (and possibly more). */
  candidates(guessKeys: readonly string[]): Set<S> {
    const out = new Set<S>();
    const touched: number[] = [];
    for (const guessKey of guessKeys) {
      for (const token of pairTokens(guessKey)) {
        for (const id of this.postings.get(token) ?? []) {
          if (this.counts[id] === 0) touched.push(id);
          this.counts[id]! += 1;
        }
      }
      for (const id of touched) {
        if (this.counts[id]! >= this.minShared[id]!) for (const song of this.owners[id]!) out.add(song);
        this.counts[id] = 0;
      }
      touched.length = 0;
    }
    return out;
  }
}

const EDGE = '\u0000';

/** Letter pairs of the padded key, the n-th repeat of a pair as its own token (so shared tokens count a multiset). */
function pairTokens(key: string): string[] {
  const letters = [EDGE, ...Array.from(key), EDGE];
  const seen = new Map<string, number>();
  const tokens: string[] = [];
  for (let i = 0; i + 1 < letters.length; i++) {
    const pair = letters[i]! + letters[i + 1]!;
    const n = (seen.get(pair) ?? 0) + 1;
    seen.set(pair, n);
    tokens.push(`${pair}\u0001${n}`);
  }
  return tokens;
}

/**
 * Every song that accepts another song's alias: "<song id> artist <- <other id> \"<alias>\"".
 * Artist aliases of songs that share a performer don't count. `indexed: false`
 * compares every pair of songs (the reference, quadratic); `indexed: true` asks
 * only the songs a NameIndex returns and reports the same list.
 */
export function aliasMismatches(songs: readonly CatalogSong[], known: KnownNames, options: { indexed: boolean }): string[] {
  const keys = new Map(songs.map((s) => [s, songArtistKeys(s)]));
  const sharesArtist = (a: CatalogSong, b: CatalogSong): boolean => keys.get(a)!.some((key) => keys.get(b)!.includes(key));
  const artistIndex = options.indexed ? new NameIndex(songs, artistMatchKeys) : undefined;
  const titleIndex = options.indexed ? new NameIndex(songs, titleMatchKeys) : undefined;
  const wrong: string[] = [];
  for (const other of songs) {
    for (const a of other.artistAliases ?? []) {
      for (const s of artistIndex ? artistIndex.candidates(artistGuessKeys(a)) : songs) {
        if (s !== other && !sharesArtist(s, other) && isArtistCorrect(s, a, known)) wrong.push(`${s.id} artist <- ${other.id} "${a}"`);
      }
    }
    for (const t of other.titleAliases ?? []) {
      for (const s of titleIndex ? titleIndex.candidates(titleGuessKeys(t)) : songs) {
        if (s !== other && isTitleCorrect(s, t, known)) wrong.push(`${s.id} title <- ${other.id} "${t}"`);
      }
    }
  }
  return wrong.sort();
}
