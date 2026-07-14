#!/usr/bin/env bash
set -euo pipefail

# CI-style test: cross-compile luca for Linux and verify it runs in a Docker
# container by having the binary smoke-test ITSELF via `luca test-binaries
# --smoke`. The assertion set lives in src/commands/test-binaries.ts, so this
# script and the CI matrix and local `luca test-binaries` all check the same
# things — no drift.
#
# Usage: bash scripts/test-linux-binary.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
LINUX_BINARY="$DIST_DIR/luca-linux-arm64"
PLATFORM="linux/arm64" # matches Docker on Apple Silicon; runs natively there

echo "=== Cross-compiling luca for linux-arm64 ==="
cd "$PROJECT_DIR"

# Pre-compile codegen (introspection, scaffolds, etc.) so the bundle is faithful.
bun run build:introspection
bun run build:scaffolds
bun run build:bootstrap
bun run build:python-bridge
bash scripts/stamp-build.sh

bun build ./src/cli/cli.ts --compile --target=bun-linux-arm64 --outfile "$LINUX_BINARY" --external node-llama-cpp

echo ""
echo "=== Built: $(file "$LINUX_BINARY") ==="
echo ""
echo "=== Self-smoke in Docker ($PLATFORM) ==="
echo ""

# Mount the binary and let it run its own smoke spec. The container exit code
# is the verdict; the per-test breakdown is printed by the binary itself.
STATUS=0
docker run --rm --platform "$PLATFORM" \
  -v "$DIST_DIR":/app -w /app \
  debian:bookworm-slim \
  /app/luca-linux-arm64 test-binaries --smoke || STATUS=$?

# Cleanup
rm -f "$LINUX_BINARY"

echo ""
if [ "$STATUS" -ne 0 ]; then
  echo "FAILED"
  exit 1
fi
echo "ALL TESTS PASSED"
