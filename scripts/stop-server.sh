#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PIDS=$(lsof -i :3000 -t 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "Stopping server on port 3000 (PIDs: $PIDS)..."
    kill -9 $PIDS
    echo "Server stopped."
else
    echo "No server running on port 3000."
fi
