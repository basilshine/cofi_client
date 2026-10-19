# Dependency Security Review

Reviewed: 2026-10-19. Scope: client dependency maintenance, not a Tailwind
major-version migration or a product redesign.

## Changes

- Update Tailwind from 3.4.17 to 3.4.19 in the root and marketing workspace.
- Override `postcss-selector-parser` to 7.1.6 or newer compatible 7.x releases.
  This addresses GHSA-w9m9-85wc-3x92 and GHSA-rj75-hqrm-r3gf.
- Remove unused `lint-staged` and its configuration. The actual Husky hook
  continues to run Biome and boundary checks through
  `scripts/precommit-client.ps1`.
- Remove the unused `gh-pages` dependency and legacy `npm run deploy` command.
  Production PNZ deployment remains `.github/workflows/pnz-deploy.yml` and
  `apps/poka-ne-zabyl/Dockerfile`. Neither depends on GitHub Pages.
- Regenerate the lockfile and verify installation with `npm ci --ignore-scripts`.

## Audit Result And Residual Risk

The full-workspace npm audit decreased from nine affected package entries
(eight high, one moderate) to five high entries:

| Package | Dependency path |
| --- | --- |
| `tailwindcss` | Build-time CSS generation for legacy interfaces |
| `chokidar` | `tailwindcss -> chokidar -> braces` |
| `fast-glob` | `tailwindcss -> fast-glob -> micromatch -> braces` |
| `micromatch` | `tailwindcss -> micromatch -> braces` |
| `braces` | Root advisory GHSA-vfj7-8cjw-p6xm |

These are five affected entries for one root advisory, not five unrelated bugs.
`braces` 3.0.3 is the latest published version and the advisory lists no patched
version. Do not suppress the audit or apply `npm audit fix --force`.

The vulnerable code parses glob patterns during build/development. Existing
Tailwind content patterns come from repository configuration, not uploaded
receipts or expense data. Do not accept user-provided Tailwind/glob patterns.
Run CI only on trusted code and do not expose development servers publicly.
The full audit intentionally still exits nonzero; this is not a zero-risk claim.

PNZ's production-workspace audit with dev dependencies omitted reports zero
known vulnerabilities. Its Docker build installs only that workspace, and the
final image serves static files without the Node dependency tree.

## Verification

- `npm ci --ignore-scripts`
- `npm run prepare` (existing Husky hooks still install)
- `npx --no-install biome check .`
- `npm run lint:boundaries`
- `npm run build:all` (Telegram, web, marketing)
- `npm run build:pnz` (client, SSR, 17 prerendered public pages)
- `npm run test:money --workspace apps/poka-ne-zabyl` (115 tests)
- `npx playwright test --config playwright.pnz.config.ts --workers=1` (4 tests)
- `npm audit --workspace apps/poka-ne-zabyl --include-workspace-root=false --omit=dev`

The generated CSS for Telegram, web and marketing was compared before/after
the dependency update and was byte-for-byte identical. Existing Vite chunk-size
warnings are unrelated to the npm security advisories.

`npm run security:scan` reported zero findings, but three rules timed out on
the existing large `MiniApp.tsx`; this is incomplete static-analysis coverage,
not a clean full security audit. That file was not changed in this update.

## Follow-Up

Owner: Frontend with QA review. Recheck for a patched `braces` release. If the
legacy interfaces remain in use and no patch is released, migrate Tailwind 4
separately with visual regression tests and an explicit browser-support review.
Tailwind 4 changes CSS defaults and requires newer browsers, so it is not a
safe automatic audit fix.

References:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://github.com/advisories/GHSA-w9m9-85wc-3x92
- https://tailwindcss.com/docs/upgrade-guide
