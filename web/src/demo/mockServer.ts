/**
 * Demo mode: an in-browser stand-in for the Hitster API, so the built app runs
 * as a single static page with no server. Songs come from the real catalog and
 * song selection uses the server's own module; previews are generated tones.
 */
import songsData from '../../../server/data/songs.json';
import { parseNextSongRequest, selectNextSong } from '../../../server/src/selection';
import { toPublicSong, type CatalogSong } from '../../../server/src/types';

const SONGS = songsData as CatalogSong[];
const CLIP_SECONDS = 12;
const SAMPLE_RATE = 8000;

const NOTE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];

/** A short, song-specific melody as a 16-bit mono WAV data URI (the same id always sounds the same). */
export function toneDataUri(songId: number): string {
  let seed = songId * 2654435761;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 2 ** 32;
  };
  const root = 220 * 2 ** (Math.floor(rand() * 12) / 12);
  const noteLen = 0.25 + Math.floor(rand() * 3) * 0.05;
  const melody = Array.from({ length: 8 }, () => root * 2 ** (NOTE_STEPS[Math.floor(rand() * NOTE_STEPS.length)]! / 12));

  const total = CLIP_SECONDS * SAMPLE_RATE;
  const bytes = new Uint8Array(44 + total * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + total * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, total * 2, true);

  const samplesPerNote = Math.floor(noteLen * SAMPLE_RATE);
  for (let i = 0; i < total; i++) {
    const n = Math.floor(i / samplesPerNote);
    const freq = melody[n % melody.length]!;
    const t = (i % samplesPerNote) / SAMPLE_RATE;
    const envelope = Math.min(1, t * 40) * Math.exp(-t * 4);
    const sample = Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) * envelope * 0.35;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Handles an /api request in the browser, mirroring docs/CONTRACTS.md §4. */
export async function handleApiRequest(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (path === '/api/health' && method === 'GET') return json({ status: 'ok' });

  if (path === '/api/songs/next' && method === 'POST') {
    let body: unknown = {};
    try {
      body = init?.body ? JSON.parse(String(init.body)) : {};
    } catch {
      return json({ error: 'INVALID_REQUEST', message: 'Malformed JSON body' }, 400);
    }
    const parsed = parseNextSongRequest(body);
    if (!parsed.ok) return json({ error: 'INVALID_REQUEST', message: parsed.message }, 400);
    const song = selectNextSong(SONGS, parsed.value);
    if (!song) return json({ error: 'NO_SONGS_LEFT', message: 'No songs left' }, 404);
    return json({ song: toPublicSong(song) });
  }

  const preview = /^\/api\/songs\/(\d+)\/preview$/.exec(path);
  if (preview && method === 'GET') {
    const id = Number(preview[1]);
    if (!SONGS.some((s) => s.id === id)) return json({ error: 'SONG_NOT_FOUND', message: 'Unknown song' }, 404);
    return json({ previewUrl: toneDataUri(id) });
  }

  return json({ error: 'NOT_FOUND', message: 'Unknown API route' }, 404);
}

/** Routes the app's /api fetches to the in-browser handler. */
export function installMockServer(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, window.location.href).pathname;
    const apiIndex = path.indexOf('/api/');
    if (apiIndex === -1) return realFetch(input, init);
    return handleApiRequest(path.slice(apiIndex), init);
  };
}
