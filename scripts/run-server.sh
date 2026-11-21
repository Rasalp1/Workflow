#!/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

BUILD_ID_FILE="$PROJECT_DIR/.next/BUILD_ID"

needs_build() {
    if [ ! -f "$BUILD_ID_FILE" ]; then
        return 0
    fi
    if [ "$PROJECT_DIR/package.json" -nt "$BUILD_ID_FILE" ] || \
       [ "$PROJECT_DIR/next.config.ts" -nt "$BUILD_ID_FILE" ] || \
       [ "$PROJECT_DIR/tsconfig.json" -nt "$BUILD_ID_FILE" ] || \
       [ "$PROJECT_DIR/postcss.config.mjs" -nt "$BUILD_ID_FILE" ]; then
        return 0
    fi
    if [ -n "$(find "$PROJECT_DIR/src" "$PROJECT_DIR/public" -type f -newer "$BUILD_ID_FILE" -print -quit 2>/dev/null)" ]; then
        return 0
    fi
    return 1
}

if needs_build; then
    echo "[Workflow] Source changes detected — building production bundle..."
    npm run build
    # Remove stale dev artifacts if present to keep .next lean
    rm -rf "$PROJECT_DIR/.next/dev"
fi

# Cap V8 old space to keep long-lived memory usage bounded while running production server.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=256}"
exec "$PROJECT_DIR/node_modules/.bin/next" start --hostname 127.0.0.1
