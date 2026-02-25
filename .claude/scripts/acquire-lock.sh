#!/bin/bash
# acquire-lock.sh — Acquire a file lock to prevent concurrent modification
# Usage: bash .claude/scripts/acquire-lock.sh <file-path> <agent-name>
set -euo pipefail

FILE_PATH="${1:?Error: file-path required. Usage: acquire-lock.sh <file> <agent>}"
AGENT_NAME="${2:?Error: agent-name required. Usage: acquire-lock.sh <file> <agent>}"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOCKS_DIR="$PROJECT_DIR/.claude/locks"
mkdir -p "$LOCKS_DIR"

# Normalize file path to create lock file name
LOCK_NAME=$(echo "$FILE_PATH" | sed 's|/|__|g' | sed 's|^__||')
LOCK_FILE="$LOCKS_DIR/${LOCK_NAME}.lock"

MAX_WAIT=30  # seconds
WAITED=0

while [ -f "$LOCK_FILE" ]; do
  HOLDER=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    echo "✗ Lock timeout after ${MAX_WAIT}s. File '$FILE_PATH' held by: $HOLDER"
    exit 1
  fi
  if [[ $WAITED -eq 0 ]]; then
    echo "⏳ Waiting for lock on '$FILE_PATH' (held by: $HOLDER)..."
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

# Acquire lock
echo "$AGENT_NAME $(date -Iseconds)" > "$LOCK_FILE"
echo "✓ Lock acquired: $FILE_PATH → $AGENT_NAME"
