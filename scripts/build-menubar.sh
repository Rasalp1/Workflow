#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWIFT_FILE="$SCRIPT_DIR/workflow-menubar.swift"
BIN_FILE="$SCRIPT_DIR/workflow-menubar"

# Check if swiftc is available
if ! command -v swiftc >/dev/null 2>&1; then
    echo "swiftc not found. Skipping menubar compilation."
    exit 1
fi

# Recompile if binary doesn't exist or Swift source is newer
if [ ! -f "$BIN_FILE" ] || [ "$SWIFT_FILE" -nt "$BIN_FILE" ]; then
    echo "Compiling workflow-menubar..."
    swiftc -O -framework Cocoa "$SWIFT_FILE" -o "$BIN_FILE"
    chmod +x "$BIN_FILE"
    echo "workflow-menubar built successfully at $BIN_FILE"
else
    echo "workflow-menubar is already up to date."
fi
