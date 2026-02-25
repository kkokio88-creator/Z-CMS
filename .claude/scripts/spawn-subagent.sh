#!/bin/bash
# spawn-subagent.sh — Create a new sub-agent in a tmux window
# Usage: bash .claude/scripts/spawn-subagent.sh <agent-name> <task-description>
set -euo pipefail

AGENT_NAME="${1:?Error: agent-name required. Usage: spawn-subagent.sh <name> <task>}"
TASK_DESC="${2:?Error: task-description required. Usage: spawn-subagent.sh <name> <task>}"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
SESSION_NAME="${PROJECT_NAME}-dev"
CLAUDE_DIR="$PROJECT_DIR/.claude"
HANDOFF_DIR="$CLAUDE_DIR/handoffs/$AGENT_NAME"
RESULT_DIR="$CLAUDE_DIR/results/$AGENT_NAME"

# Validate session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Error: tmux session '$SESSION_NAME' not found."
  echo "Run init-agent-team.sh first."
  exit 1
fi

# Check max sub-agents (4)
WINDOW_COUNT=$(tmux list-windows -t "$SESSION_NAME" 2>/dev/null | wc -l)
if [[ $WINDOW_COUNT -ge 5 ]]; then
  echo "Error: Maximum 4 sub-agents reached ($(( WINDOW_COUNT - 1 )) active)."
  echo "Terminate an existing sub-agent first."
  exit 1
fi

# Check if agent name already in use
if tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -q "^${AGENT_NAME}$"; then
  echo "Error: Agent '$AGENT_NAME' already exists."
  exit 1
fi

# Create directories
mkdir -p "$HANDOFF_DIR" "$RESULT_DIR"

# Create assignment file
cat > "$HANDOFF_DIR/assignment.md" << EOF
# 작업: $TASK_DESC

## 에이전트: $AGENT_NAME
## 생성 시각: $(date '+%Y-%m-%d %H:%M:%S')

## 목표
$TASK_DESC

## 프로젝트 규칙 (발췌)
- TypeScript strict mode
- UI 텍스트 한국어
- shadcn/ui 컴포넌트, Lucide 아이콘
- Tailwind CSS, dark mode 지원
- cn() 유틸리티 사용

## 성공 기준
\`\`\`bash
npx tsc --noEmit && npm run build
\`\`\`

## 완료 시
1. $RESULT_DIR/summary.md 작성
2. $RESULT_DIR/DONE 파일 생성
3. 대기 (Leader가 종료)

## 제한 사항
- 시간: 30분 이내
- 파일 락: 공유 파일 수정 시 acquire-lock.sh 사용
- 범위: 이 작업에 명시된 파일만 수정
EOF

echo "→ Assignment created: $HANDOFF_DIR/assignment.md"

# Create tmux window
tmux new-window -t "$SESSION_NAME" -n "$AGENT_NAME" -c "$PROJECT_DIR"

# Start sub-agent with Sonnet model
tmux send-keys -t "$SESSION_NAME:$AGENT_NAME" \
  "echo '═══ Sub-Agent: $AGENT_NAME (Sonnet) ═══' && echo 'Task: $TASK_DESC' && echo '' && echo 'Assignment: $HANDOFF_DIR/assignment.md' && echo '' && echo 'Start with: claude --model sonnet'" Enter

echo ""
echo "✓ Sub-agent '$AGENT_NAME' spawned!"
echo ""
echo "  Window:     tmux select-window -t $SESSION_NAME:$AGENT_NAME"
echo "  Assignment: $HANDOFF_DIR/assignment.md"
echo "  Results:    $RESULT_DIR/"
echo ""
echo "  Sub-agent should read assignment.md and begin work."
