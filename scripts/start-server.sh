#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PROJECT_DIR="/Users/rasmusalpsten/Drive C/Projects/Workflow"
LOG_FILE="/tmp/workflow-dev.log"

if lsof -i :3000 -t >/dev/null 2>&1; then
    echo "Workflow dev server is already running on http://localhost:3000"
else
    echo "Starting Workflow dev server in background..."
    cd "$PROJECT_DIR" || exit 1
    nohup npm run dev > "$LOG_FILE" 2>&1 &
    echo "Started. Logs available at $LOG_FILE"
fi
