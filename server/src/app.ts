import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Express, type RequestHandler, type Response } from 'express';
import type { PreviewProvider } from './preview/types.js';
import { parseNextSongRequest, selectNextSong, type Rng } from './selection.js';
import { computeStats } from './stats.js';
import { toPublicSong, type ApiError, type CatalogSong } from './types.js';
import { createMockCoverSvg } from './preview/mock-cover.js';
import { createSilentWav } from './wav.js';

export interface AppOptions {
  songs: readonly CatalogSong[];
  previewProvider: PreviewProvider;
  /** Built frontend directory. Skipped if undefined or missing. */
  staticDir?: string;
  rng?: Rng;
}

function sendError(res: Response, status: number, error: string, message: string): void {
  const body: ApiError = { error, message };
  res.status(status).json(body);
}

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

function isDirectory(dir: string): boolean {
  try {
    return existsSync(dir) && statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function createApp(options: AppOptions): Express {
  const { songs, previewProvider, staticDir, rng = Math.random } = options;
  const songsById = new Map(songs.map((s) => [s.id, s]));
  const stats = computeStats(songs);
  const mockWav = createSilentWav(2);
  const mockCover = Buffer.from(createMockCoverSvg(), 'utf8');

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  const api = express.Router();
  api.use(express.json({ limit: '16kb' }));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  api.get('/songs/stats', (_req, res) => {
    res.json(stats);
  });

  api.post('/songs/next', (req, res) => {
    const parsed = parseNextSongRequest(req.body);
    if (!parsed.ok) {
      sendError(res, 400, 'INVALID_REQUEST', parsed.message);
      return;
    }
    const song = selectNextSong(songs, parsed.value, rng);
    if (!song) {
      sendError(res, 404, 'NO_SONGS_LEFT', 'No songs left for the selected languages');
      return;
    }
    res.json({ song: toPublicSong(song) });
  });

  api.get('/songs/:id/preview', async (req, res) => {
    const raw = req.params.id;
    const song = /^\d+$/.test(raw) ? songsById.get(Number(raw)) : undefined;
    if (!song) {
      sendError(res, 404, 'SONG_NOT_FOUND', `Unknown song id: ${raw}`);
      return;
    }
    let previewUrl: string | null = null;
    try {
      previewUrl = await previewProvider.getPreviewUrl(toPublicSong(song));
    } catch {
      previewUrl = null; // providers should never throw, but never surface it to the client
    }
    res.json({ previewUrl });
  });

  api.get('/songs/:id/cover', async (req, res) => {
    const raw = req.params.id;
    const song = /^\d+$/.test(raw) ? songsById.get(Number(raw)) : undefined;
    if (!song) {
      sendError(res, 404, 'SONG_NOT_FOUND', `Unknown song id: ${raw}`);
      return;
    }
    let coverUrl: string | null = null;
    try {
      coverUrl = await previewProvider.getCoverUrl(toPublicSong(song));
    } catch {
      coverUrl = null; // never surface provider errors to the client
    }
    res.json({ coverUrl });
  });

  api.get('/mock-cover', (_req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Length', String(mockCover.length));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(mockCover);
  });

  api.get('/mock-audio', (_req, res) => {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(mockWav.length));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(mockWav);
  });

  api.use((req, res) => {
    sendError(res, 404, 'NOT_FOUND', `No API route for ${req.method} ${req.originalUrl}`);
  });

  const apiErrorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    const e = err as { type?: string; status?: number; message?: string };
    if (e.type === 'entity.parse.failed' || e.type === 'entity.too.large' || e.status === 400 || e.status === 413) {
      sendError(res, 400, 'INVALID_REQUEST', e.type === 'entity.too.large' ? 'Request body too large' : 'Malformed JSON body');
      return;
    }
    console.error('[api] unexpected error', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  };
  api.use(apiErrorHandler);

  app.use('/api', api);

  if (staticDir && isDirectory(staticDir)) {
    const root = path.resolve(staticDir);
    const indexHtml = path.join(root, 'index.html');
    app.use(
      express.static(root, {
        index: 'index.html',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !existsSync(indexHtml)) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  return app;
}
