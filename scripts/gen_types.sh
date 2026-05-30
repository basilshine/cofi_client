#!/bin/sh
npx --no-install openapi-typescript ../cofi_infra/shared/openapi.yaml --output packages/api/src/openapi-types.ts
