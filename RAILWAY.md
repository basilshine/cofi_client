# Ceits frontends on Railway (`cofi_client`)

Deploy **two separate Railway services** from this repo (same pattern as `cofi_server` and `cofi_bot`): one for the marketing site, one for the signed-in workspace. Use Railway-generated `*.up.railway.app` URLs until `ceits.app` / `use.ceits.app` DNS is ready; then add custom domains on each service and update variables.

## Prerequisites

- GitHub (or Git) repo connected to Railway; push this monorepo so Railway builds match your local `cofi_client` tree.
- API (`cofi_server`) should allow CORS from both public URLs (Railway defaults and, later, `https://ceits.app` and `https://use.ceits.app`). Set `ALLOWED_ORIGINS` accordingly (comma-separated).

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
