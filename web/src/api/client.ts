import type { Language, Song } from '../game/types';

export type ApiErrorCode =
  | 'NO_SONGS_LEFT'
  | 'INVALID_REQUEST'
  | 'SONG_NOT_FOUND'
  | 'NETWORK'
  | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface NextSongRequest {
  excludeIds?: number[];
  excludeArtists?: string[];
  languages?: Language[];
}

const KNOWN_CODES: ApiErrorCode[] = ['NO_SONGS_LEFT', 'INVALID_REQUEST', 'SONG_NOT_FOUND'];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (err) {
    throw new ApiError('NETWORK', err instanceof Error ? err.message : 'Network error');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; message?: string };
    const code = KNOWN_CODES.find((c) => c === b.error) ?? (res.status >= 500 ? 'NETWORK' : 'UNKNOWN');
    throw new ApiError(code, b.message ?? `HTTP ${res.status}`, res.status);
  }
  if (body === null) throw new ApiError('UNKNOWN', 'Invalid JSON response', res.status);
  return body as T;
}

export async function fetchNextSong(req: NextSongRequest): Promise<Song> {
  const data = await request<{ song?: Song }>('/api/songs/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!data.song) throw new ApiError('UNKNOWN', 'Missing song in response');
  return data.song;
}

export async function fetchPreviewUrl(songId: number): Promise<string | null> {
  const data = await request<{ previewUrl?: string | null }>(
    `/api/songs/${encodeURIComponent(String(songId))}/preview`,
  );
  return typeof data.previewUrl === 'string' && data.previewUrl ? data.previewUrl : null;
}
