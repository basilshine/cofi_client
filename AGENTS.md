# Ceits Frontend Execution Guardrails

Scope: `cofi_client` (`apps/web`, `apps/telegram-webapp`, `packages/*`).

## Dependency boundaries

```text
app      -> pages, widgets, features, entities, shared
pages    -> widgets, features, entities, shared
widgets  -> features, entities, shared
features -> entities, shared
entities -> shared
shared   -> nothing above
```

## Forbidden import patterns

- `apps/* -> ../../../src/*` root-level runtime coupling.
- `apps/web -> packages/*/src/*` deep source imports.
- `shared -> features` imports.
- `features/A -> features/B/components/*` deep cross-feature imports.

## Required import style

- Use public entrypoints only:
  - `@cofi/api`
  - `widgets/*` public barrels
  - `entities/*` public barrels
- Do not import package internals such as `packages/api/src/types`.

## Slice handoff requirement

Each completed architecture slice must provide:

```text
HANDOFF
- Task ID: ...
- Summary: ...
- Files touched: ...
- How to verify: ...
- Risks / follow-ups: ...
- Suggested next owner: Frontend | QA
END HANDOFF
```
