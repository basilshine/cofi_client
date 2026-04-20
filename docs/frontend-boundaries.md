# Frontend Boundaries

This document defines mandatory boundaries for `cofi_client`.

## Repository Layout

- `apps/telegram-webapp`: Telegram WebApp product
- `apps/web`: browser/public web product
- `packages/ui`: shared UI primitives and design tokens
- `packages/api`: shared API clients and request helpers
- `packages/domain`: shared domain models and pure helpers

## Import Rules

- Apps can import from `packages/*`.
- Shared packages can import from other shared packages.
- Shared packages must not import from any app.

## Channel Rules

- Telegram-specific SDK, init data handling, and deep-link logic must stay in `apps/telegram-webapp`.
- Public website route and browser-only UX logic must stay in `apps/web`.
- If logic is channel-specific, keep it in the app layer.
- Move code to `packages/*` only when it is platform-agnostic.

## Practical Guidance

- Start features in app layer.
- Extract to shared package only after seeing reuse across both apps.
- Keep API contracts in `packages/api` and domain types in `packages/domain`.
- Keep shared UI components free from Telegram and router-specific assumptions.
