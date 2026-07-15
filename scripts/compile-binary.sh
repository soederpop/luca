#!/usr/bin/env bash
# Compiles the luca binary, baking git SHA/branch/date into src/cli/build-info.ts
# via `bun build --define` — no generated files, the repo stays clean.
#
# Usage:
#   bash scripts/compile-binary.sh                                  # dist/luca for the host
#   bash scripts/compile-binary.sh --target=bun-linux-arm64 --outfile dist/luca-linux-arm64
set -euo pipefail

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

TARGET=""
OUTFILE="dist/luca"
while [ $# -gt 0 ]; do
  case "$1" in
    --target=*) TARGET="$1"; shift ;;
    --outfile) OUTFILE="$2"; shift 2 ;;
    --outfile=*) OUTFILE="${1#--outfile=}"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

exec bun build ./src/cli/cli.ts --compile ${TARGET:+"$TARGET"} \
  --outfile "$OUTFILE" \
  --external node-llama-cpp \
  --define "process.env.LUCA_BUILD_SHA=\"$SHA\"" \
  --define "process.env.LUCA_BUILD_BRANCH=\"$BRANCH\"" \
  --define "process.env.LUCA_BUILD_DATE=\"$DATE\""
