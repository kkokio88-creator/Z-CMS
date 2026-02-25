#!/bin/bash
# Ralph Wiggum v2 - Autonomous AI Agent Loop
# Enhanced with: dual-condition exit, rate limiting, circuit breaker, session tracking
#
# Usage: ./ralph/ralph.sh [--tool amp|claude] [--max N] [--delay N] [--dry-run]
#
# Based on: snarktank/ralph + frankbria/ralph-claude-code best practices

set -euo pipefail

# ─── Configuration Defaults ───────────────────────────────────────────
TOOL="claude"
MAX_ITERATIONS=10
DELAY_BETWEEN=5          # seconds between iterations
DRY_RUN=false
VERBOSE=false

# ─── Parse Arguments ──────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)       TOOL="$2"; shift 2 ;;
    --tool=*)     TOOL="${1#*=}"; shift ;;
    --max)        MAX_ITERATIONS="$2"; shift 2 ;;
    --max=*)      MAX_ITERATIONS="${1#*=}"; shift ;;
    --delay)      DELAY_BETWEEN="$2"; shift 2 ;;
    --delay=*)    DELAY_BETWEEN="${1#*=}"; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    --verbose)    VERBOSE=true; shift ;;
    -h|--help)
      echo "Usage: ./ralph/ralph.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --tool amp|claude   AI tool to use (default: claude)"
      echo "  --max N             Max iterations (default: 10)"
      echo "  --delay N           Seconds between iterations (default: 5)"
      echo "  --dry-run           Show what would run without executing"
      echo "  --verbose           Show detailed output"
      echo "  -h, --help          Show this help"
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# ─── Validate ─────────────────────────────────────────────────────────
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp' or 'claude'."
  exit 1
fi

# ─── Paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
SESSION_LOG="$SCRIPT_DIR/.session-$(date +%Y%m%d-%H%M%S).log"

# ─── Circuit Breaker State ────────────────────────────────────────────
CONSECUTIVE_FAILURES=0
MAX_CONSECUTIVE_FAILURES=3

# ─── Helper Functions ─────────────────────────────────────────────────
log() {
  local msg="[$(date '+%H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$SESSION_LOG"
}

log_verbose() {
  if [[ "$VERBOSE" == true ]]; then
    log "$1"
  fi
}

check_prd_exists() {
  if [ ! -f "$PRD_FILE" ]; then
    echo "Error: No prd.json found at $PRD_FILE"
    echo "Run 'superpowers' or create prd.json first."
    exit 1
  fi
}

count_remaining() {
  jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "?"
}

count_total() {
  jq '[.userStories[]] | length' "$PRD_FILE" 2>/dev/null || echo "?"
}

all_stories_pass() {
  local result
  result=$(jq '[.userStories[] | .passes] | all' "$PRD_FILE" 2>/dev/null || echo "false")
  [[ "$result" == "true" ]]
}

get_next_story() {
  jq -r '[.userStories[] | select(.passes == false)] | sort_by(.priority) | .[0] | "\(.id): \(.title)"' "$PRD_FILE" 2>/dev/null || echo "unknown"
}

# ─── Archive Previous Run ────────────────────────────────────────────
archive_if_needed() {
  if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    local current_branch last_branch
    current_branch=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    last_branch=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$current_branch" ] && [ -n "$last_branch" ] && [ "$current_branch" != "$last_branch" ]; then
      local date_str folder_name archive_folder
      date_str=$(date +%Y-%m-%d)
      folder_name=$(echo "$last_branch" | sed 's|^ralph/||')
      archive_folder="$ARCHIVE_DIR/$date_str-$folder_name"

      log "Archiving previous run: $last_branch → $archive_folder"
      mkdir -p "$archive_folder"
      [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$archive_folder/"
      [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$archive_folder/"

      echo "# Ralph Progress Log" > "$PROGRESS_FILE"
      echo "Started: $(date)" >> "$PROGRESS_FILE"
      echo "---" >> "$PROGRESS_FILE"
    fi
  fi

  # Track current branch
  if [ -f "$PRD_FILE" ]; then
    local current_branch
    current_branch=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    if [ -n "$current_branch" ]; then
      echo "$current_branch" > "$LAST_BRANCH_FILE"
    fi
  fi
}

# ─── Initialize ───────────────────────────────────────────────────────
check_prd_exists
archive_if_needed

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

# ─── Pre-flight Check ────────────────────────────────────────────────
TOTAL=$(count_total)
REMAINING=$(count_remaining)
FEATURE=$(jq -r '.description // "unknown"' "$PRD_FILE" 2>/dev/null)

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Ralph Wiggum v2 — Autonomous Agent Loop                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Feature:    $(printf '%-46s' "$FEATURE" | head -c 46) ║"
echo "║  Tool:       $(printf '%-46s' "$TOOL")║"
echo "║  Stories:    $(printf '%-46s' "$REMAINING remaining of $TOTAL")║"
echo "║  Max Iter:   $(printf '%-46s' "$MAX_ITERATIONS")║"
echo "║  Delay:      $(printf '%-46s' "${DELAY_BETWEEN}s between iterations")║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if all_stories_pass; then
  echo "All stories already pass! Nothing to do."
  exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Would execute $MAX_ITERATIONS iterations with $TOOL"
  echo "[DRY RUN] Next story: $(get_next_story)"
  exit 0
fi

log "Session log: $SESSION_LOG"

# ─── Main Loop ────────────────────────────────────────────────────────
for i in $(seq 1 $MAX_ITERATIONS); do
  REMAINING=$(count_remaining)
  NEXT_STORY=$(get_next_story)

  echo ""
  echo "┌──────────────────────────────────────────────────────────────┐"
  echo "│  Iteration $i/$MAX_ITERATIONS — $REMAINING stories remaining"
  echo "│  Next: $NEXT_STORY"
  echo "└──────────────────────────────────────────────────────────────┘"

  log "Starting iteration $i — Target: $NEXT_STORY"

  # ─── Execute Agent ──────────────────────────────────────────────
  ITER_START=$(date +%s)

  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  fi

  ITER_END=$(date +%s)
  ITER_DURATION=$((ITER_END - ITER_START))
  log "Iteration $i completed in ${ITER_DURATION}s"

  # ─── Dual-Condition Exit Gate ───────────────────────────────────
  # Both conditions must be true to confirm completion:
  # 1. Agent output contains COMPLETE signal
  # 2. prd.json actually has all stories passing
  SIGNAL_FOUND=false
  ALL_PASS=false

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    SIGNAL_FOUND=true
  fi

  if all_stories_pass; then
    ALL_PASS=true
  fi

  if [[ "$SIGNAL_FOUND" == true && "$ALL_PASS" == true ]]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ✓ Ralph completed all $TOTAL stories!                      ║"
    echo "║  Finished at iteration $i of $MAX_ITERATIONS                ║"
    echo "║  Session log: $SESSION_LOG                                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    log "COMPLETE — All stories pass. Signal confirmed."
    exit 0
  fi

  if [[ "$SIGNAL_FOUND" == true && "$ALL_PASS" == false ]]; then
    log "WARNING: Agent claimed COMPLETE but prd.json shows incomplete stories. Continuing."
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
  elif [[ "$ALL_PASS" == true && "$SIGNAL_FOUND" == false ]]; then
    log "All stories pass in prd.json but agent didn't signal. Verifying..."
    if all_stories_pass; then
      echo ""
      echo "╔══════════════════════════════════════════════════════════════╗"
      echo "║  ✓ Ralph completed all stories (verified via prd.json)!    ║"
      echo "╚══════════════════════════════════════════════════════════════╝"
      log "COMPLETE — Verified via prd.json check."
      exit 0
    fi
  fi

  # ─── Circuit Breaker ────────────────────────────────────────────
  # Check if progress was actually made
  NEW_REMAINING=$(count_remaining)
  if [[ "$NEW_REMAINING" == "$REMAINING" ]]; then
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    log "WARNING: No progress made. Consecutive failures: $CONSECUTIVE_FAILURES/$MAX_CONSECUTIVE_FAILURES"

    if [[ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES ]]; then
      echo ""
      echo "╔══════════════════════════════════════════════════════════════╗"
      echo "║  ✗ Circuit breaker triggered!                              ║"
      echo "║  $MAX_CONSECUTIVE_FAILURES consecutive iterations with no progress.       ║"
      echo "║  Check progress.txt and prd.json for stuck stories.        ║"
      echo "╚══════════════════════════════════════════════════════════════╝"
      log "CIRCUIT BREAKER — $MAX_CONSECUTIVE_FAILURES consecutive failures."
      exit 2
    fi
  else
    CONSECUTIVE_FAILURES=0
    log "Progress made: $REMAINING → $NEW_REMAINING remaining"
  fi

  # ─── Delay Between Iterations ───────────────────────────────────
  if [[ $i -lt $MAX_ITERATIONS ]]; then
    log_verbose "Waiting ${DELAY_BETWEEN}s before next iteration..."
    sleep "$DELAY_BETWEEN"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Ralph reached max iterations ($MAX_ITERATIONS) without completing.  ║"
echo "║  $(count_remaining) stories remaining of $TOTAL.                     ║"
echo "║  Check: $PROGRESS_FILE                                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
log "MAX ITERATIONS reached. $(count_remaining) stories remaining."
exit 1
