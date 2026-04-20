# Ceits frontends on Railway (`cofi_client`)

Deploy **two separate Railway services** from this repo (same pattern as `cofi_server` and `cofi_bot`): one for the marketing site, one for the signed-in workspace. Use Railway-generated `*.up.railway.app` URLs until `ceits.app` / `use.ceits.app` DNS is ready; then add custom domains on each service and update variables.

## Prerequisites

- GitHub (or Git) repo connected to Railway; push this monorepo so Railway builds match your local `cofi_client` tree.
- API (`cofi_server`) should allow CORS from both public URLs (Railway defaults and, later, `https://ceits.app` and `https://use.ceits.app`). Set `ALLOWED_ORIGINS` accordingly (comma-separated).

## Railpack / “`/app/dist`: not found”

Railway’s **Railpack** Node static flow runs `npm run build` and then copies the SPA output directory (default **`dist`** at the **service root**).

In this repo, the root `package.json` **`build`** script builds **`apps/telegram-webapp`**, so artifacts live under **`apps/telegram-webapp/dist`**, not `./dist`. That mismatch produces:

`failed to calculate checksum ... "/app/dist": not found`

**Do this on each static service:**

1. **Build command:** `npm ci && npm run railway:build` (not plain `npm run build` unless you only want the Telegram bundle).
2. **`CEITS_RAILWAY_TARGET`:** `marketing` or `workspace` (see below).
3. **Railpack variable:** set **`RAILPACK_SPA_OUTPUT_DIR`** to the folder that actually exists after that build:
   - Marketing: `apps/marketing/dist`
   - Workspace: `apps/web/dist`

([Railpack `RAILPACK_SPA_OUTPUT_DIR`](https://railpack.com/languages/node) — directory containing the built static files, relative to the app root.)

If you intentionally keep **`npm run build`** at the root (Telegram webapp only), set **`RAILPACK_SPA_OUTPUT_DIR=apps/telegram-webapp/dist`** instead.

## Service A — marketing (public site)

Suggested service name: `ceits-marketing` (used in variable templates below).

| Setting | Value |
|--------|--------|
| **Root directory** | `cofi_client` (path to this folder in the repo) |
| **Service type** | Static / frontend (Railway static hosting) |
| **Build command** | `npm ci && npm run railway:build` |
| **Publish / output directory** | `apps/marketing/dist` |
| **Watch paths** | `cofi_client/apps/marketing/**`, `cofi_client/packages/**`, `cofi_client/package.json`, `cofi_client/package-lock.json` |

**Variables** (service → Variables):

| Name | Purpose |
|------|--------|
| `CEITS_RAILWAY_TARGET` | `marketing` |
| `RAILPACK_SPA_OUTPUT_DIR` | `apps/marketing/dist` (required for Railpack; see section above) |
| `VITE_WORKSPACE_URL` | After workspace service exists: `https://${{ceits-workspace.RAILWAY_PUBLIC_DOMAIN}}` (replace `ceits-workspace` with your actual workspace service name). For a first deploy, you can use a temporary full `https://…up.railway.app` URL, then switch to the template and redeploy. |

`VITE_*` values are baked in at **build** time; change them and redeploy when URLs change.

## Service B — workspace (`use.*` app)

Suggested service name: `ceits-workspace`.

| Setting | Value |
|--------|--------|
| **Root directory** | `cofi_client` |
| **Service type** | Static / frontend |
| **Build command** | `npm ci && npm run railway:build` |
| **Publish / output directory** | `apps/web/dist` |
| **Watch paths** | `cofi_client/apps/web/**`, `cofi_client/packages/**`, `cofi_client/package.json`, `cofi_client/package-lock.json` |

**Variables**:

| Name | Purpose |
|------|--------|
| `CEITS_RAILWAY_TARGET` | `workspace` |
| `RAILPACK_SPA_OUTPUT_DIR` | `apps/web/dist` (required for Railpack; see section above) |
| `VITE_API_URL` | Your API public origin, e.g. `https://<cofi_server>.up.railway.app` (no trailing `/api`). |
| `VITE_MARKETING_URL` | `https://${{ceits-marketing.RAILWAY_PUBLIC_DOMAIN}}` (adjust service name to match marketing). |
| `VITE_CEITS_APP_URL` | Same origin as this workspace app: `https://${{ceits-workspace.RAILWAY_PUBLIC_DOMAIN}}` or the final `https://use.ceits.app` once configured. |

## Ordering and cross-service URLs

1. Create **workspace** and **marketing** services (or deploy workspace first).
2. Copy each service’s **public Railway URL** from the dashboard if templates are unavailable.
3. Set `VITE_*` and redeploy so links between sites and the API are correct.

## Custom domains later

For each service: **Settings → Networking → Custom domain** → add `ceits.app` (marketing) and `use.ceits.app` (workspace). Update `VITE_MARKETING_URL`, `VITE_WORKSPACE_URL`, and `VITE_CEITS_APP_URL` to the final HTTPS URLs and redeploy both frontends; extend `ALLOWED_ORIGINS` on the API.

## Local parity

See `apps/marketing/.env.example` and `apps/web/.env.example`. Dev defaults: marketing `http://127.0.0.1:5173`, workspace `http://127.0.0.1:5174`.
