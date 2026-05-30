# Ceits Frontend (`cofi_client`)

Frontend monorepo with three separate products:

- `apps/telegram-webapp`: Telegram-embedded product
- `apps/web`: authenticated browser workspace product
- `apps/marketing`: public marketing/landing pages

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

See `../cofi_brain/repository-docs/cofi_client/deployment-and-boundaries.md` for strict app/shared layer rules and deployment notes.
