import type { CatalogSong } from '../types.js';

/**
 * Providers receive the internal catalog song (incl. lookup hints such as
 * `itunesTrackId`); only the resolved URLs ever reach the client.
 */
export interface PreviewProvider {
  /** Resolves a 30-second preview URL, or null if none can be found. Must never reject. */
  getPreviewUrl(song: CatalogSong): Promise<string | null>;
  /** Resolves an HTTPS cover picture URL, or null if none can be found. Must never reject. Shares one lookup with getPreviewUrl. */
  getCoverUrl(song: CatalogSong): Promise<string | null>;
}
