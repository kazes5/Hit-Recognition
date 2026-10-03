import type { CatalogSong, Song } from '../types.js';
import { pickBestCover, pickBestPreview, sanitizeCoverUrl, type ItunesTrack } from './matching.js';
import type { PreviewProvider } from './types.js';

export interface ItunesPreviewProviderOptions {
  country?: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** How long a null caused by a network/HTTP error is cached (a "not found" null is cached until restart). */
  errorTtlMs?: number;
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
}

interface LookupResult {
  previewUrl: string | null;
  coverUrl: string | null;
}

const NOT_FOUND: LookupResult = { previewUrl: null, coverUrl: null };

interface CacheEntry {
  value: LookupResult;
  expiresAt: number;
}

export const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
export const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

/** iTunes `lang` for Hebrew songs: asks the IL storefront for Hebrew-script names instead of transliterations. */
export const HEBREW_LANG = 'he_il';

/** Non-2xx response from iTunes. */
class HttpError extends Error {
  constructor(readonly status: number) {
    super(`iTunes responded ${status}`);
  }
}

export class ItunesPreviewProvider implements PreviewProvider {
  private readonly country: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly errorTtlMs: number;
  private readonly now: () => number;
  private readonly logger: Pick<Console, 'warn'>;
  private readonly cache = new Map<number, CacheEntry>();
  private readonly inFlight = new Map<number, Promise<LookupResult>>();
  /** Cleared after iTunes rejects `lang=he_il` once (4xx); Hebrew songs then search without it. */
  private hebrewLangSupported = true;

  constructor(options: ItunesPreviewProviderOptions = {}) {
    this.country = options.country ?? 'IL';
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.errorTtlMs = options.errorTtlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? console;
  }

  buildSearchUrl(song: Pick<Song, 'artist' | 'title'>, lang?: string): string {
    const params = new URLSearchParams({
      term: `${song.artist} ${song.title}`,
      entity: 'song',
      limit: '10',
      country: this.country,
    });
    if (lang !== undefined) params.set('lang', lang);
    return `${ITUNES_SEARCH_URL}?${params.toString()}`;
  }

  buildLookupUrl(trackId: number): string {
    const params = new URLSearchParams({ id: String(trackId), country: this.country, entity: 'song' });
    return `${ITUNES_LOOKUP_URL}?${params.toString()}`;
  }

  async getPreviewUrl(song: CatalogSong): Promise<string | null> {
    return (await this.resolve(song)).previewUrl;
  }

  async getCoverUrl(song: CatalogSong): Promise<string | null> {
    return (await this.resolve(song)).coverUrl;
  }

  /** One cached/in-flight iTunes resolution per song, shared by preview and cover. */
  private resolve(song: CatalogSong): Promise<LookupResult> {
    const cached = this.cache.get(song.id);
    if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached.value);

    const pending = this.inFlight.get(song.id);
    if (pending) return pending;

    const lookup = this.lookup(song).finally(() => this.inFlight.delete(song.id));
    this.inFlight.set(song.id, lookup);
    return lookup;
  }

  private async lookup(song: CatalogSong): Promise<LookupResult> {
    try {
      const value = await this.find(song);
      this.cache.set(song.id, { value, expiresAt: Number.POSITIVE_INFINITY });
      return value;
    } catch (err) {
      this.logger.warn(`[preview] iTunes lookup failed for song ${song.id}: ${(err as Error).message}`);
      this.cache.set(song.id, { value: NOT_FOUND, expiresAt: this.now() + this.errorTtlMs });
      return NOT_FOUND;
    }
  }

  /**
   * Pinned `itunesTrackId` first (no name matching), then search. Hebrew songs
   * search with lang=he_il first and, if nothing matches, once more without it.
   */
  private async find(song: CatalogSong): Promise<LookupResult> {
    if (song.itunesTrackId !== undefined) {
      const pinned = await this.findByTrackId(song.itunesTrackId);
      if (pinned) return pinned;
      this.logger.warn(`[preview] iTunes track id ${song.itunesTrackId} of song ${song.id} has no preview; falling back to search`);
    }

    const langs = song.language === 'he' && this.hebrewLangSupported ? [HEBREW_LANG, undefined] : [undefined];
    let coverUrl: string | null = null;
    let lastResults: ItunesTrack[] = [];
    for (const lang of langs) {
      let results: ItunesTrack[];
      try {
        results = await this.fetchResults(this.buildSearchUrl(song, lang));
      } catch (err) {
        // The localised search is only a bonus: never let it fail the song.
        if (lang === undefined) throw err;
        if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
          this.hebrewLangSupported = false;
          this.logger.warn(`[preview] iTunes rejected lang=${lang} (${err.message}); searching without it from now on`);
        }
        continue;
      }
      if (results.length > 0) lastResults = results;
      const previewUrl = pickBestPreview(song, results);
      const cover = pickBestCover(song, results);
      if (previewUrl !== null) return { previewUrl, coverUrl: cover ?? coverUrl };
      coverUrl ??= cover;
    }

    if (lastResults.length > 0) {
      const seen = lastResults
        .slice(0, 3)
        .map((t) => `"${t.artistName ?? '?'} – ${t.trackName ?? t.trackCensoredName ?? '?'}"`)
        .join(', ');
      this.logger.warn(`[preview] no match for song ${song.id} "${song.artist} – ${song.title}": ${seen}`);
    }
    return { previewUrl: null, coverUrl };
  }

  /** The pinned track's preview and cover, or null if the lookup has no preview for it. */
  private async findByTrackId(trackId: number): Promise<LookupResult | null> {
    const results = await this.fetchResults(this.buildLookupUrl(trackId));
    const track = results.find((t) => t.trackId === trackId) ?? results.find((t) => t.kind === 'song');
    if (!track || typeof track.previewUrl !== 'string' || track.previewUrl.length === 0) return null;
    const cover = typeof track.artworkUrl100 === 'string' ? sanitizeCoverUrl(track.artworkUrl100) : null;
    return { previewUrl: track.previewUrl, coverUrl: cover };
  }

  /** GETs an iTunes Search/Lookup URL; throws on network/HTTP/JSON errors. */
  private async fetchResults(url: string): Promise<ItunesTrack[]> {
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new HttpError(res.status);
    const body = (await res.json()) as { results?: unknown };
    return Array.isArray(body.results) ? (body.results as ItunesTrack[]) : [];
  }
}
