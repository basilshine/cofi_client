#!/bin/sh
npx --no-install openapi-typescript ../cofi_infra/shared/openapi.yaml --output src/types/api-types.ts
