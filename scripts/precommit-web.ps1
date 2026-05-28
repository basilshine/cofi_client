$ErrorActionPreference = "Stop"

npm run lint:boundaries
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

npm run build:web
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

npm run build:marketing
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
