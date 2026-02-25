#!/bin/bash
# terminate-subagent.sh — Gracefully terminate a sub-agent
# Usage: bash .claude/scripts/terminate-subagent.sh <agent-name> [--force]
set -euo pipefail

AGENT_NAME="${1:?Error: agent-name required. Usage: terminate-subagent.sh <name> [--force]}"
FORCE="${2:-}"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
SESSION_NAME="${PROJECT_NAME}-dev"
CLAUDE_DIR="$PROJECT_DIR/.claude"
RESULT_DIR="$CLAUDE_DIR/results/$AGENT_NAME"
HANDOFF_DIR="$CLAUDE_DIR/handoffs/$AGENT_NAME"

echo "→ Terminating sub-agent: $AGENT_NAME"

# Check completion status
if [ -f "$RESULT_DIR/DONE" ]; then
  echo "  ✓ Agent completed successfully"
elif [[ "$FORCE" == "--force" ]]; then
  echo "  ⚠ Force terminating (work may be incomplete)"
else
  echo "  ⚠ Agent has not marked DONE. Results may be incomplete."
  read -p "  Force terminate? (y/n): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 1
  fi
fi

# Archive results with timestamp
ARCHIVE_DIR="$CLAUDE_DIR/results/.archive/$(date +%Y%m%d-%H%M%S)-$AGENT_NAME"
if [ -d "$RESULT_DIR" ] && [ "$(ls -A "$RESULT_DIR" 2>/dev/null)" ]; then
  mkdir -p "$ARCHIVE_DIR"
  cp -r "$RESULT_DIR"/* "$ARCHIVE_DIR/" 2>/dev/null || true
  echo "  → Results archived: $ARCHIVE_DIR"
fi

# Release any file locks held by this agent
if [ -d "$CLAUDE_DIR/locks" ]; then
  for lock_file in "$CLAUDE_DIR/locks"/*.lock; do
    [ -f "$lock_file" ] || continue
    if grep -q "$AGENT_NAME" "$lock_file" 2>/dev/null; then
      rm -f "$lock_file"
      echo "  → Released lock: $(basename "$lock_file" .lock)"
    fi
  done
fi

# Kill tmux window
if tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -q "^${AGENT_NAME}$"; then
  tmux kill-window -t "$SESSION_NAME:$AGENT_NAME"
  echo "  → tmux window closed"
else
  echo "  → tmux window not found (may have already closed)"
fi

# Clean up handoff directory
if [ -d "$HANDOFF_DIR" ]; then
  rm -rf "$HANDOFF_DIR"
  echo "  → Handoff directory cleaned"
fi

# Clean up results directory (archived already)
if [ -d "$RESULT_DIR" ]; then
  rm -rf "$RESULT_DIR"
fi

echo ""
echo "✓ Sub-agent '$AGENT_NAME' terminated."

# Show remaining agents
REMAINING=$(tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -v '^leader$' | wc -l)
echo "  Active sub-agents: $REMAINING"
