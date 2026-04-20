# Ceits Frontend (`cofi_client`)

Frontend monorepo with two separate products:

- `apps/telegram-webapp`: Telegram-embedded product
- `apps/web`: public browser product

Shared cross-product modules:

- `packages/ui`
- `packages/api`
- `packages/domain`

## Install

```bash
npm install
```

## Run

```bash
npm run dev:telegram
npm run dev:web
```

## Build

```bash
npm run build:telegram
npm run build:web
npm run build:all
```

## Lint and Format

```bash
npm run lint
npm run format
```

## Boundaries

See `docs/frontend-boundaries.md` for strict app/shared layer rules.
