#!/bin/bash
# cost-estimate.sh — Estimate multi-agent cost before execution
# Usage: bash .claude/scripts/cost-estimate.sh <num-subagents> <estimated-minutes>
set -euo pipefail

NUM_SUBS="${1:?Error: num-subagents required. Usage: cost-estimate.sh <subs> <minutes>}"
EST_MINUTES="${2:?Error: estimated-minutes required. Usage: cost-estimate.sh <subs> <minutes>}"

# Pricing assumptions (per 1M tokens, approximate)
# Opus: $15 input, $75 output
# Sonnet: $3 input, $15 output
# Average tokens per minute of agent work: ~2k input, ~1.5k output

OPUS_INPUT_RATE="0.015"   # per 1k tokens
OPUS_OUTPUT_RATE="0.075"
SONNET_INPUT_RATE="0.003"
SONNET_OUTPUT_RATE="0.015"

# Estimated tokens
TOKENS_PER_MIN_IN=2    # k tokens input per minute
TOKENS_PER_MIN_OUT=1.5 # k tokens output per minute

LEADER_IN=$(echo "$EST_MINUTES * $TOKENS_PER_MIN_IN" | bc)
LEADER_OUT=$(echo "$EST_MINUTES * $TOKENS_PER_MIN_OUT" | bc)
LEADER_COST=$(echo "$LEADER_IN * $OPUS_INPUT_RATE + $LEADER_OUT * $OPUS_OUTPUT_RATE" | bc -l)

SUB_IN=$(echo "$EST_MINUTES * $TOKENS_PER_MIN_IN" | bc)
SUB_OUT=$(echo "$EST_MINUTES * $TOKENS_PER_MIN_OUT" | bc)
SINGLE_SUB_COST=$(echo "$SUB_IN * $SONNET_INPUT_RATE + $SUB_OUT * $SONNET_OUTPUT_RATE" | bc -l)
ALL_SUBS_COST=$(echo "$SINGLE_SUB_COST * $NUM_SUBS" | bc -l)

TOTAL_COST=$(echo "$LEADER_COST + $ALL_SUBS_COST" | bc -l)

# Single-agent comparison (Sonnet only)
SINGLE_COST=$(echo "($EST_MINUTES * $NUM_SUBS) * ($TOKENS_PER_MIN_IN * $SONNET_INPUT_RATE + $TOKENS_PER_MIN_OUT * $SONNET_OUTPUT_RATE)" | bc -l)
RATIO=$(echo "$TOTAL_COST / $SINGLE_COST" | bc -l 2>/dev/null || echo "N/A")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Multi-Agent Cost Estimate                                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Agents:      Leader (Opus) + %d Sub (Sonnet)              ║\n" "$NUM_SUBS"
printf "║  Est. Time:   %d minutes (parallel)                        ║\n" "$EST_MINUTES"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Leader:      \$%.2f                                       ║\n" "$LEADER_COST"
printf "║  Subs (×%d):   \$%.2f                                       ║\n" "$NUM_SUBS" "$ALL_SUBS_COST"
printf "║  Total:       \$%.2f                                       ║\n" "$TOTAL_COST"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Single mode: \$%.2f (sequential, ~%d min)               ║\n" "$SINGLE_COST" "$(echo "$EST_MINUTES * $NUM_SUBS" | bc)"
printf "║  Ratio:       %.1fx cost for %.1fx speed                   ║\n" "$(printf '%.1f' "$RATIO")" "$(echo "$NUM_SUBS" | bc)"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Note: Estimates are approximate. Actual costs depend on"
echo "      task complexity and number of iterations."
echo ""
read -p "Proceed with multi-agent mode? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "✓ Approved. Run init-agent-team.sh to start."
else
  echo "→ Switching to single-agent mode."
  echo "  Use: ./ralph/ralph.sh --max 15"
fi
