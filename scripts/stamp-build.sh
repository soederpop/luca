#!/usr/bin/env bash
# Stamps git SHA, branch, and date into src/cli/build-info.ts before compile
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > src/cli/build-info.ts <<EOF
// Generated at compile time — do not edit manually
export const BUILD_SHA = '${SHA}'
export const BUILD_BRANCH = '${BRANCH}'
export const BUILD_DATE = '${DATE}'
EOF
