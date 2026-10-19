# Dependency Security Review

Status: locally verified, not deployed
Owner: Frontend + QA
Last validated: 2026-10-19

Current result: Tailwind 4.3.3 migration on `codex/tailwind4-maintenance`.
The full-workspace npm audit reports zero known vulnerabilities. The initial
compatible update and its five remaining entries are retained below as history.

## Initial Compatible Update

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

## Initial Audit Result Before The Tailwind 4 Migration

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

## Tailwind 4 Migration

The user approved the modern browser baseline: Safari 16.4+, Chrome 111+,
Firefox 128+. This is maintenance of legacy interfaces, not renewed Ceits
product work. No API, financial data, production configuration or PNZ product
styles are changed.

- Pin `tailwindcss` and `@tailwindcss/postcss` to 4.3.3. Keep the existing
  PostCSS build integration and rename the CommonJS shared config to `.cjs`.
- Load the existing theme explicitly via `@config`. Disable automatic source
  discovery and retain the existing per-app content boundaries.
- Use `.pcss` entrypoints for Tailwind-specific import syntax, which Vite
  handles but the existing Biome 1.9 CSS parser does not understand. The
  formatter and lint gates remain enabled for the rest of the source.
- Preserve the previously used v3 palette, placeholder/border colors, button
  cursor and container configuration in `packages/ui/src/tailwind-compat.css`.
- Mechanically migrate class literals for renamed shadow, blur, gradient and
  outline utilities. Preserve the custom `rounded-sm` theme token; replace
  bare `rounded` with its previous explicit 4px radius.
- Remove unused `tailwind-merge` (no source imports) and move the build-only
  animation plugin out of runtime dependencies. Do not replace the animation
  library or change application behavior.
- Correct two verified landing-page differences: responsive line heights and
  conflicting horizontal CTA padding classes now explicitly match v3 output.
- Add `test:styles` and extend Web CI to build all three legacy workspaces and
  run the stylesheet regression checks in Chromium, Firefox and WebKit.

## Migration Verification

- Clean `npm ci --ignore-scripts`: passed, zero known vulnerabilities.
- Full `npm audit`: zero known vulnerabilities. `npm ls` confirms that
  `braces`, `chokidar`, `fast-glob` and `micromatch` are absent from the project
  dependency tree.
- `npm run build:all` and `npm run build:pnz`: passed.
- Biome, boundary checks and `npm run lint:web`: passed.
- Typecheck of the new Playwright configuration and stylesheet tests: passed.
- PNZ node tests: 115 passed. PNZ browser tests: 4 passed.
- Existing mocked capture/review browser flows: 4 passed.
- Stylesheet tests: 12 passed, across desktop Chromium, 320px Chromium,
  mobile WebKit and desktop Firefox. These cover real login/feedback screens,
  landing layout and the separately compiled Telegram base stylesheet.
- All five built PNZ JS/CSS assets have the same SHA-256 values as before the
  migration, including the Mini App chunks.
- Semgrep: zero findings, with two rules timing out on the unchanged large
  `MiniApp.tsx`. Static-analysis coverage remains incomplete.

Local before/after screenshots are in `.tmp/tailwind-visual`. Enable comparison
with `TAILWIND_VISUAL_COMPARE=1 npm run test:styles`; capture references before a
future styling change using the same command with `-- --update-snapshots`.
References are local and platform-specific, not automatically regenerated in
CI. CI runs the behavioral and computed-style assertions without pixel goldens.
External services/fonts are blocked in these deterministic browser tests.

The visual tolerance is 0.1% differing pixels, except for the approximately
10,000px mobile WebKit landing screenshot, where it is 0.2%. A differential
comparison against original v3 CSS identified cumulative subpixel line-box
rounding below 0.2px. Input geometry, heading line height and CTA padding also
have explicit assertions. This is not a claim of exact pixel equality on every
browser or coverage of every authenticated legacy screen.

## GitHub Actions Runtime Maintenance

On 2026-10-20, replace the Node 20-based action pins with checkout 7.0.1,
setup-node 7.1.0 and upload-artifact 7.0.2, each pinned to its verified release
commit. Their action manifests declare Node 24. Both CI workflows now also use
Node 24 for npm commands; hosted Ubuntu runners support the required runtime.
Existing cache settings, tests, deployment commands and artifact retention stay
unchanged. No authentication, registry publishing or cross-workflow artifact
consumers depend on the changed major-version behavior.

Verify both workflow runs and their complete logs, including post-job cleanup,
for the absence of the Node 20 action-runtime deprecation warning. Then check
the deployed health/readiness endpoints and the authenticated app screens.
Application dependencies and Docker build runtimes are outside this change.

## Known Pre-Existing Legacy Issues

`apps/telegram-webapp/src/main.tsx` mounts the shared `WebApp` without a
`BrowserRouter`. Its login route already failed before any dependency update.
The Telegram Tailwind content glob also excludes the reused `apps/web/src`
components. Neither issue was introduced or silently repaired by this migration;
the Telegram check validates its compiled base CSS, not a working full app.
The active PNZ Telegram/PWA client is a separate entrypoint and is unaffected.

## Handoff And Rollback

Next owner: Frontend + QA. Local migration gates passed, and the user approved
committing and pushing to `main` for deployment through GitHub Actions. Keep the
migration in a dedicated commit so it can be reverted without touching unrelated
work. There are no database changes. Check CI, deployment logs and production
smoke tests after the push; use the existing image rollback if those smoke
checks fail. Do not reset the dirty worktree.

References:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf
- https://github.com/advisories/GHSA-w9m9-85wc-3x92
- https://tailwindcss.com/docs/upgrade-guide
