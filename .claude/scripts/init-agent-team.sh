#!/bin/bash
# init-agent-team.sh — Initialize multi-agent tmux session
# Usage: bash .claude/scripts/init-agent-team.sh [project-name]
set -euo pipefail

PROJECT_NAME="${1:-$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")}"
SESSION_NAME="${PROJECT_NAME}-dev"
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CLAUDE_DIR="$PROJECT_DIR/.claude"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Multi-Agent Team Initialization                           ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Project:  $(printf '%-47s' "$PROJECT_NAME")║"
echo "║  Session:  $(printf '%-47s' "$SESSION_NAME")║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo ""
  echo "⚠  Session '$SESSION_NAME' already exists."
  read -p "   Attach to existing session? (y/n): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    tmux attach-session -t "$SESSION_NAME"
    exit 0
  else
    echo "   Aborting. Kill existing session first:"
    echo "   tmux kill-session -t $SESSION_NAME"
    exit 1
  fi
fi

# Create directory structure
mkdir -p "$CLAUDE_DIR"/{context,handoffs,results,locks,scripts}

# Take context snapshot
echo "→ Creating context snapshot..."
bash "$CLAUDE_DIR/scripts/snapshot-context.sh"

# Create tmux session with Leader window
echo "→ Creating tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -n "leader" -c "$PROJECT_DIR"

# Set window title and start Leader
tmux send-keys -t "$SESSION_NAME:leader" \
  "echo '═══ Leader Agent (Opus) ═══' && echo 'Project: $PROJECT_NAME' && echo 'Snapshot: $(cat "$CLAUDE_DIR/context/.snapshot-id" 2>/dev/null || echo "none")' && echo '' && echo 'Start Claude with: claude'" Enter

# Create current-task placeholder
cat > "$CLAUDE_DIR/context/current-task.md" << 'TASK'
# Current Task

> 아직 작업이 지정되지 않았습니다. Leader가 사용자 요청을 분석한 후 업데이트됩니다.

## Status: PENDING
TASK

echo ""
echo "✓ Team initialized successfully!"
echo ""
echo "  Attach:    tmux attach -t $SESSION_NAME"
echo "  Spawn sub: bash .claude/scripts/spawn-subagent.sh <name> <task>"
echo "  Snapshot:  bash .claude/scripts/snapshot-context.sh"
echo ""
echo "  Next: attach to tmux and start Claude in the leader window"
