#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

LISTEN_PIDS=$(lsof -ti :3000 -sTCP:LISTEN 2>/dev/null)

if [ -n "$LISTEN_PIDS" ]; then
    ALL_PIDS=""
    for pid in $LISTEN_PIDS; do
        ALL_PIDS="$ALL_PIDS $pid"
        PPID_VAL=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$PPID_VAL" ] && [ "$PPID_VAL" -gt 1 ]; then
            ALL_PIDS="$ALL_PIDS $PPID_VAL"
        fi
    done

    UNIQUE_PIDS=$(echo $ALL_PIDS | tr ' ' '\n' | sort -u | tr '\n' ' ')
    echo "Stopping server on port 3000 (PIDs: $UNIQUE_PIDS)..."
    kill -9 $UNIQUE_PIDS 2>/dev/null
    echo "Server stopped."
else
    echo "No server running on port 3000."
fi
