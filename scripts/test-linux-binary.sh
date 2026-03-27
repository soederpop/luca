#!/usr/bin/env bash
set -euo pipefail

# CI-style test: cross-compile luca for Linux and verify it runs in a Docker container
# Usage: bash scripts/test-linux-binary.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
LINUX_BINARY="$DIST_DIR/luca-linux"

echo "=== Cross-compiling luca for linux-arm64 ==="
cd "$PROJECT_DIR"

# Run the pre-compile build steps (introspection, scaffolds, etc.)
bun run build:introspection
bun run build:scaffolds
bun run build:bootstrap
bun run build:python-bridge
bash scripts/stamp-build.sh

# Cross-compile for linux arm64 (matches Docker on Apple Silicon)
bun build ./src/cli/cli.ts --compile --target=bun-linux-arm64 --outfile "$LINUX_BINARY" --external node-llama-cpp

echo ""
echo "=== Built linux binary: $(file "$LINUX_BINARY") ==="
echo ""

# Create a minimal Dockerfile inline
DOCKER_TAG="luca-linux-test"

docker build -t "$DOCKER_TAG" -f - "$DIST_DIR" <<'DOCKERFILE'
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY luca-linux /usr/local/bin/luca
RUN chmod +x /usr/local/bin/luca
DOCKERFILE

echo ""
echo "=== Running smoke tests in Docker container ==="
echo ""

PASS=0
FAIL=0

run_test() {
  local description="$1"
  shift
  echo -n "  TEST: $description ... "
  if output=$(docker run --rm "$DOCKER_TAG" "$@" 2>&1); then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    echo "    Output: $output"
    FAIL=$((FAIL + 1))
  fi
}

# Basic smoke tests
run_test "binary executes"          luca --version
run_test "help flag works"          luca --help
run_test "eval runs JS expression"  luca eval "1 + 1"
run_test "describe features"        luca describe features
run_test "container basics via eval" luca eval "container.uuid"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

# Cleanup
docker rmi "$DOCKER_TAG" > /dev/null 2>&1 || true
rm -f "$LINUX_BINARY"

if [ "$FAIL" -gt 0 ]; then
  echo "FAILED"
  exit 1
fi

echo "ALL TESTS PASSED"
