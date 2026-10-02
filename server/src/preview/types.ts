import type { Song } from '../types.js';

export interface PreviewProvider {
  /** Resolves a 30-second preview URL, or null if none can be found. Must never reject. */
  getPreviewUrl(song: Song): Promise<string | null>;
}
