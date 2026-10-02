import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { CatalogError, loadCatalog } from './catalog.js';
import { ItunesPreviewProvider } from './preview/itunes.js';
import { MockPreviewProvider } from './preview/mock.js';
import type { PreviewProvider } from './preview/types.js';

/** server/ (works from both src/ and dist/). */
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
  console.error(`[startup] ${message}`);
  process.exit(1);
}

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`Invalid PORT: ${raw}`);
  return port;
}

function createPreviewProvider(): PreviewProvider {
  const kind = (process.env.PREVIEW_PROVIDER ?? 'itunes').trim().toLowerCase();
  if (kind === 'mock') return new MockPreviewProvider();
  if (kind === 'itunes') {
    return new ItunesPreviewProvider({ country: (process.env.ITUNES_COUNTRY ?? 'IL').trim() || 'IL' });
  }
  return fail(`Invalid PREVIEW_PROVIDER: ${kind} (expected "itunes" or "mock")`);
}

function main(): void {
  const port = readPort();
  const previewProvider = createPreviewProvider();
  const staticDir = process.env.STATIC_DIR
    ? path.resolve(process.env.STATIC_DIR)
    : path.resolve(SERVER_ROOT, '../web/dist');

  let songs;
  try {
    songs = loadCatalog(path.join(SERVER_ROOT, 'data', 'songs.json'));
  } catch (err) {
    if (err instanceof CatalogError) fail(err.message);
    throw err;
  }

  const app = createApp({ songs, previewProvider, staticDir });
  const server = app.listen(port, () => {
    console.log(
      `[startup] Hitster server listening on port ${port} ` +
        `(songs: ${songs.length}, previews: ${process.env.PREVIEW_PROVIDER ?? 'itunes'}, static: ${staticDir})`,
    );
  });
  server.on('error', (err) => fail(`Server error: ${err.message}`));

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, closing server`);
    server.close(() => {
      console.log('[shutdown] closed');
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => {
      console.warn('[shutdown] forcing exit');
      process.exit(0);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
