# Ceits brand assets (`@cofi/ceits-brand`)

Single place for **favicons**, **logos**, **wordmarks**, and other static brand files used across Ceits surfaces (web console, marketing site, Telegram web app, emails, and future touchpoints).

## Layout

| Path | Purpose |
| --- | --- |
| `assets/brand/` | Canonical **SVG exports** (mark, horizontal, app icon, favicon)—mirrors `apps/web/public/brand/` for non-Vite consumers |
| `assets/favicon/` | `favicon.ico`, `apple-touch-icon.png`, etc. |
| `assets/logo/` | Raster or alternate exports (optional) |
| `assets/og/` | Open Graph / social preview images (optional) |

Add `.gitkeep` placeholders are removed once real assets land.

## Using from apps (Vite)

1. Add the workspace dependency: `"@cofi/ceits-brand": "file:../../packages/ceits-brand"` in the app `package.json`.
2. **Option A — copy at build:** In `vite.config`, use `vite-plugin-static-copy` (or a small script) to copy `node_modules/@cofi/ceits-brand/assets/**` into `public/brand/` so URLs stay stable (`/brand/favicon/favicon.ico`).
3. **Option B — direct import:** Import SVG/PNG from the package path if your bundler resolves it (may need `resolve.alias` to the `assets` folder).

Prefer one canonical file per asset, then wire each app’s `index.html` and meta tags to the same paths.

## Backend / email

Server-side stacks do not consume this npm package for React; reference **absolute URLs** to your CDN or app origin for images in emails and PDFs. Keep source files here and deploy copies to static hosting as part of release.

## Related

- **React icons:** `@cofi/ceits-icons` (product iconography components).
- **React logo lockups:** `apps/web/src/components/brand/ceits-logo/` (or extract to a shared package later).
- **Docs:** `docs/design/ceits-iconography.md`, `docs/design/ceits-logo-system.md` (repo root).
