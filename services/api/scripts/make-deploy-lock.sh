#!/usr/bin/env bash
# Regenerates services/api/deploy/package-lock.json (standalone lock shipped in the API dist tgz).
# Run from anywhere after changing services/api/package.json dependencies and the root lock.
set -euo pipefail
API="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$API/../.." && pwd)"
S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S/vendor/gotcha-shared"
cp "$ROOT/packages/shared/package.json" "$S/vendor/gotcha-shared/"
node "$API/scripts/make-deploy-manifest.mjs" "$S" --seed-lock "$ROOT/package-lock.json"
( cd "$S" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null )
cp "$S/package-lock.json" "$API/deploy/package-lock.json"
echo "wrote $API/deploy/package-lock.json"
