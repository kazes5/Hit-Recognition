import type { Song } from '../types.js';
import { pickBestCover, pickBestPreview, type ItunesTrack } from './matching.js';
import type { PreviewProvider } from './types.js';

export interface ItunesPreviewProviderOptions {
  country?: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** How long a null caused by a network/HTTP error is cached (a "not found" null is cached forever). */
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

export class ItunesPreviewProvider implements PreviewProvider {
  private readonly country: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly errorTtlMs: number;
  private readonly now: () => number;
  private readonly logger: Pick<Console, 'warn'>;
  private readonly cache = new Map<number, CacheEntry>();
  private readonly inFlight = new Map<number, Promise<LookupResult>>();

  constructor(options: ItunesPreviewProviderOptions = {}) {
    this.country = options.country ?? 'IL';
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.errorTtlMs = options.errorTtlMs ?? 5 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? console;
  }

  buildSearchUrl(song: Pick<Song, 'artist' | 'title'>): string {
    const params = new URLSearchParams({
      term: `${song.artist} ${song.title}`,
      entity: 'song',
      limit: '10',
      country: this.country,
    });
    return `${ITUNES_SEARCH_URL}?${params.toString()}`;
  }

  async getPreviewUrl(song: Song): Promise<string | null> {
    return (await this.resolve(song)).previewUrl;
  }

  async getCoverUrl(song: Song): Promise<string | null> {
    return (await this.resolve(song)).coverUrl;
  }

  /** One cached/in-flight iTunes search per song, shared by preview and cover. */
  private resolve(song: Song): Promise<LookupResult> {
    const cached = this.cache.get(song.id);
    if (cached && cached.expiresAt > this.now()) return Promise.resolve(cached.value);

    const pending = this.inFlight.get(song.id);
    if (pending) return pending;

    const lookup = this.lookup(song).finally(() => this.inFlight.delete(song.id));
    this.inFlight.set(song.id, lookup);
    return lookup;
  }

  private async lookup(song: Song): Promise<LookupResult> {
    try {
      const res = await this.fetchFn(this.buildSearchUrl(song), {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`iTunes responded ${res.status}`);
      const body = (await res.json()) as { results?: unknown };
      const results = Array.isArray(body.results) ? (body.results as ItunesTrack[]) : [];
      const value: LookupResult = { previewUrl: pickBestPreview(song, results), coverUrl: pickBestCover(song, results) };
      this.cache.set(song.id, { value, expiresAt: Number.POSITIVE_INFINITY });
      return value;
    } catch (err) {
      this.logger.warn(`[preview] iTunes lookup failed for song ${song.id}: ${(err as Error).message}`);
      this.cache.set(song.id, { value: NOT_FOUND, expiresAt: this.now() + this.errorTtlMs });
      return NOT_FOUND;
    }
  }
}
