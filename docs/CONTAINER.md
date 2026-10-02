# Container

One production image (`Dockerfile`, multi-stage on `node:22-alpine`) runs the Express server, which serves both `/api/*` and the built web app.

| Stage | Does |
|---|---|
| `web-build` | `npm ci && npm run build` in `web/` → `web/dist` |
| `server-build` | `npm ci && npm run build` in `server/` → `server/dist` |
| `runtime` | `npm ci --omit=dev` for `server/`, plus `server/dist`, `server/data`, and web dist at `/app/web/dist`. Runs as non-root `node`, `WORKDIR /app/server`, `CMD node dist/index.js`. |

## Build & run

```sh
docker build -t hitster .
docker run --rm -p 3000:3000 hitster                          # real iTunes previews
docker run --rm -p 3000:3000 -e PREVIEW_PROVIDER=mock hitster # offline / tests
```

Or with Compose (builds and runs on http://localhost:3000):

```sh
docker compose up --build
PREVIEW_PROVIDER=mock HOST_PORT=3200 docker compose up --build
```

## Environment

| Var | Image default | Notes |
|---|---|---|
| `PORT` | `3000` | Railway overrides it; health check follows it. |
| `STATIC_DIR` | `/app/web/dist` | Built frontend location inside the image. |
| `PREVIEW_PROVIDER` | `itunes` | `mock` serves `/api/mock-audio` instead of iTunes previews. |
| `ITUNES_COUNTRY` | `IL` (server default) | iTunes storefront. |
| `NODE_ENV` | `production` | |

## Health

`HEALTHCHECK` runs `wget -qO- http://127.0.0.1:$PORT/api/health` every 30 s. Check it with `docker inspect --format '{{.State.Health.Status}}' <container>`.

## Behind a TLS-intercepting proxy

If `npm ci` fails during the build with certificate errors or `Exit handler never called!`, npm can't trust your proxy's CA. Don't change the Dockerfile. Build from a local copy that bind-mounts the CA into the `npm ci` steps instead:

```sh
sed 's#^RUN npm ci#RUN --mount=type=bind,from=ca,source=ca.crt,target=/tmp/ca.crt NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci#' Dockerfile > /tmp/Dockerfile.ca
docker build -f /tmp/Dockerfile.ca --build-context ca=/path/to/ca-dir -t hitster .
```
