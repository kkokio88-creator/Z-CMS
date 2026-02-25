#!/bin/bash
# release-lock.sh — Release a file lock
# Usage: bash .claude/scripts/release-lock.sh <file-path>
set -euo pipefail

FILE_PATH="${1:?Error: file-path required. Usage: release-lock.sh <file>}"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOCKS_DIR="$PROJECT_DIR/.claude/locks"

LOCK_NAME=$(echo "$FILE_PATH" | sed 's|/|__|g' | sed 's|^__||')
LOCK_FILE="$LOCKS_DIR/${LOCK_NAME}.lock"

if [ -f "$LOCK_FILE" ]; then
  HOLDER=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
  rm -f "$LOCK_FILE"
  echo "✓ Lock released: $FILE_PATH (was: $HOLDER)"
else
  echo "⚠ No lock found for: $FILE_PATH"
fi
