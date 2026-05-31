$ErrorActionPreference = "Stop"

npx biome format . --write
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

npx biome check .
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
semgrep scan --config auto --error .
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

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
