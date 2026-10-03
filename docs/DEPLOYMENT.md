# Deploying Hitster to Railway

Hitster ships as **one Docker image** (root `Dockerfile`): a single Node process serves the API (`/api/*`) and the built frontend on `$PORT`. Railway builds that image from GitHub and runs it.

Deployment config is checked in as [`railway.json`](../railway.json) (config-as-code). It overrides dashboard settings for the same fields:

| Setting | Value | Why |
|---|---|---|
| `build.builder` | `DOCKERFILE` | Build with the root `Dockerfile`, not Nixpacks/Railpack |
| `build.dockerfilePath` | `Dockerfile` | Root of the repo |
| `deploy.healthcheckPath` | `/api/health` | Must return `200 {"status":"ok"}` before traffic switches over |
| `deploy.healthcheckTimeout` | `120` (seconds) | Time allowed for the new deploy to become healthy |
| `deploy.restartPolicyType` / `restartPolicyMaxRetries` | `ON_FAILURE` / `5` | Restart on crash, but don't loop forever |
| `deploy.numReplicas` | `1` | Game state lives in the browser; in-memory preview cache is per process |

No start command is set: Railway runs the Dockerfile's `CMD`.

---

## 1. First deploy (dashboard)

1. Open <https://railway.com/dashboard>.
2. Choose where the service goes:
   - **New project:** **+ New** → **Deploy from GitHub repo**, or
   - **Existing project:** open the project → **+ Create** (or **+ New**) → **GitHub Repo**.
3. Select **`kazes5/Hit-Recognition`**.
   - Not listed? Click **Configure GitHub App** (or go to GitHub → Settings → Applications → *Railway* → Configure) and grant access to `Hit-Recognition`, then return and refresh.
4. Railway reads `railway.json` and builds from the `Dockerfile`. Branch: `main`.
5. Open the service → **Variables** → add:

   | Variable | Value |
   |---|---|
   | `PREVIEW_PROVIDER` | `itunes` |
   | `ITUNES_COUNTRY` | `IL` |

   **Do not set `PORT`.** Railway injects it and the server must listen on it. `STATIC_DIR` is set inside the image by the Dockerfile; leave it alone.
   Saving variables triggers a redeploy (or click **Deploy** to apply staged changes).
6. **Settings → Networking → Public Networking → Generate Domain.** If Railway asks for a port, leave it empty or enter the port shown in the deploy logs. Railway routes to `$PORT` by default.
7. Check `https://<your-domain>.up.railway.app/api/health`. It should return `{"status":"ok"}`.

## 2. Alternative: Railway CLI (on your own machine)

```bash
npm i -g @railway/cli
railway login                      # opens the browser
cd Hit-Recognition                 # local clone of the repo

railway link                       # pick the existing project (and environment)
#   or: railway init               # create a new project instead

railway up                         # upload + build + deploy the current directory
                                   # (on first run, creates/selects the service)
railway variables --set "PREVIEW_PROVIDER=itunes" --set "ITUNES_COUNTRY=IL"
railway domain                     # generate a public *.up.railway.app domain
railway logs                       # follow runtime logs
```

`railway up` deploys your **local working tree**. For deploys driven by GitHub, connect the repo in the dashboard as described in section 1. The service's **Settings → Source** shows which repo it is connected to.

## 3. Ongoing operation

- **Auto-deploy:** once the service is connected to GitHub, every push to `main` builds and deploys. You can change the branch, or turn on *Wait for CI*, under **Settings → Source**.
- **Zero-downtime:** the old deployment keeps serving until the new one passes `/api/health`. A failed health check leaves the old version live.
- **Rollback:** **Deployments** tab → pick an earlier successful deployment → **⋮** → **Redeploy** (or **Rollback**).
- **Logs:** click a deployment to see its **Build Logs** and **Deploy Logs**.
- **Preview logs:** the server logs `[preview] iTunes lookup failed for song <id>: …` for network/HTTP errors (that null is cached for 5 minutes, then retried), and `[preview] no match for song <id> "<artist> – <title>": "<artist> – <track>", …` (first 3 iTunes results) when iTunes answers but no result matches the song. A "no match" is cached in memory until the process restarts, so after fixing the catalog (e.g. adding an `itunesTrackId`, see `docs/CONTRACTS.md` §4) **redeploy or restart** to clear the cache.

## 4. Post-deploy smoke checklist

- [ ] `GET https://<domain>/api/health` returns `200 {"status":"ok"}`
- [ ] `GET https://<domain>/api/songs/stats`: `total` is about 300, and `byLanguage` and `byDecade` look right
- [ ] `GET https://<domain>/api/songs/227/preview` (any valid id) returns a non-null `previewUrl` on an Apple CDN host, **not** `/api/mock-audio`
- [ ] Opening `https://<domain>/` on a phone shows the Home screen with the neon logo
- [ ] Refreshing a non-`/api` path (e.g. `https://<domain>/anything`) still loads the app (SPA fallback)
- [ ] Start a game with 2 players, tap **Play**, and hear the clip. Previews are fetched from iTunes by the deployed server. The sandbox the app was built in had no internet access, so this is the first real check of preview loading.
- [ ] Switch to Hebrew in Settings: the layout becomes RTL and Hebrew songs play
- [ ] Place a card, **Reveal**, **Next**: the game flows and the scoreboard updates

## 5. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build OK but deploy fails with **"Healthcheck failed"** | The server must listen on `process.env.PORT` and on all interfaces (`0.0.0.0` / no host argument), **not** `127.0.0.1` or `localhost`. Check the Deploy Logs for the port it bound. Don't set `PORT` manually to a different value. If startup is slow, raise `healthcheckTimeout` in `railway.json`. |
| Health check passes but the site shows "Application failed to respond" | The domain points at the wrong port. In **Settings → Networking**, clear the target port or set it to the port in the logs. |
| `/` returns 404 or a blank page while `/api/health` works | The frontend wasn't copied into the image or `STATIC_DIR` is wrong. Check that the Dockerfile copies `web/dist` and sets `STATIC_DIR` to that path. |
| `previewUrl` is always `null` | iTunes unreachable or no match in the storefront. Check Deploy Logs for `[preview] iTunes lookup failed` (fetch errors) or `[preview] no match for song …` (iTunes answered, but with other songs or names). Confirm `PREVIEW_PROVIDER=itunes`. Try `ITUNES_COUNTRY=US` to test whether it's a storefront issue: some tracks exist only in certain countries. Results are cached in memory, so redeploy or restart after changing variables. |
| One song (often Hebrew) never plays and the game silently skips it | Look for `[preview] no match for song <id>` in the Deploy Logs: it lists what iTunes returned. Hebrew songs are searched with `lang=he_il` first and accept transliterated names, but if the right track is still not picked, add its `itunesTrackId` to `server/data/songs.json` (see `docs/CONTRACTS.md` §4) and redeploy (a redeploy also clears the cached "no match"). |
| Previews are always `/api/mock-audio` | `PREVIEW_PROVIDER` is set to `mock`. Set it to `itunes` (or delete it, since the default is `itunes`). |
| Clips don't play on iPhone | Audio only starts after a user tap (autoplay policy). Make sure the phone isn't in silent mode. |
| Build uses a stale layer or old dependencies | Redeploy with the cache disabled: add the service variable `NO_CACHE=1` and redeploy, then remove the variable afterwards. |
| Railway ignores the Dockerfile and uses Nixpacks/Railpack | `railway.json` must be at the repo root on the deployed branch, or the service's **Root Directory** setting doesn't point at the repo root. In **Settings → Config-as-code**, the path should be `/railway.json`. |
