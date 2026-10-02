# syntax=docker/dockerfile:1
# Hitster production image: one Node process serves the API and the built web app.

ARG NODE_IMAGE=node:22-alpine

# ---- Stage 1: build the web frontend (web/ -> web/dist) ----
FROM ${NODE_IMAGE} AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---- Stage 2: build the server (server/ -> server/dist) ----
FROM ${NODE_IMAGE} AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build

# ---- Stage 3: runtime (prod deps + compiled server + static web) ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/web/dist \
    PREVIEW_PROVIDER=itunes
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY --from=server-build /app/server/dist ./dist
COPY server/data ./data
COPY --from=web-build /app/web/dist /app/web/dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
