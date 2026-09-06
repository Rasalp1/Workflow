#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PROJECT_DIR="/Users/rasmusalpsten/Drive C/Projects/Workflow"
LOG_FILE="/tmp/workflow-dev.log"

if lsof -ti :3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Workflow dev server is already running on http://localhost:3000"
else
    echo "Starting Workflow dev server in background..."
    cd "$PROJECT_DIR" || exit 1
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    echo "Started. Logs available at $LOG_FILE"
fi

# Ensure Mac menu bar item is running
if [ "$(uname)" = "Darwin" ]; then
    if ! pgrep -f "workflow-menubar" >/dev/null 2>&1; then
        "$PROJECT_DIR/scripts/build-menubar.sh" >/dev/null 2>&1
        LISTEN_PID=$(lsof -ti :3000 -sTCP:LISTEN 2>/dev/null | head -n 1)
        if [ -n "$LISTEN_PID" ]; then
            nohup "$PROJECT_DIR/scripts/workflow-menubar" --port 3000 --parent-pid "$LISTEN_PID" >/dev/null 2>&1 &
        else
            nohup "$PROJECT_DIR/scripts/workflow-menubar" --port 3000 >/dev/null 2>&1 &
        fi
        echo "Workflow menu bar item launched."
    else
        echo "Workflow menu bar item is already active."
    fi
fi

