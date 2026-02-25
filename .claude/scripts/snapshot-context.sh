#!/bin/bash
# snapshot-context.sh — Create a versioned snapshot of project context
# Usage: bash .claude/scripts/snapshot-context.sh
set -euo pipefail

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CLAUDE_DIR="$PROJECT_DIR/.claude"
CONTEXT_DIR="$CLAUDE_DIR/context"
SNAPSHOT_ID="snap-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$CONTEXT_DIR"

# Save snapshot ID
echo "$SNAPSHOT_ID" > "$CONTEXT_DIR/.snapshot-id"

# Snapshot CLAUDE.md
if [ -f "$PROJECT_DIR/CLAUDE.md" ]; then
  cp "$PROJECT_DIR/CLAUDE.md" "$CONTEXT_DIR/project-snapshot.md"
fi

# Record metadata
cat > "$CONTEXT_DIR/snapshot-meta.json" << EOF
{
  "id": "$SNAPSHOT_ID",
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "git_dirty": $(git diff --quiet 2>/dev/null && echo false || echo true),
  "node_version": "$(node --version 2>/dev/null || echo 'unknown')",
  "typescript_version": "$(npx tsc --version 2>/dev/null | awk '{print $2}' || echo 'unknown')"
}
EOF

echo "✓ Context snapshot created: $SNAPSHOT_ID"
echo "  CLAUDE.md → $CONTEXT_DIR/project-snapshot.md"
echo "  Metadata  → $CONTEXT_DIR/snapshot-meta.json"
echo ""
echo "  All agents should reference this snapshot, not the live CLAUDE.md"
