#!/bin/bash
# generate-brief.sh — build MEMORY_BRIEF.md before a race-whisperer run
# Queries MemPalace for task-relevant context. Target: ~400 chars / ~100 tokens.
# Usage: ./generate-brief.sh [run_type]

set -euo pipefail

PROJECT_DIR=/home/admin/race-whisperer-predict
LOG_FILE=$PROJECT_DIR/reports/RUN_LOG.md
PALACE=/home/admin/.local/bin/mempalace
RUN_TYPE=${1:-mutate}
RUN_COUNT=$(grep -c "^## Run " "$LOG_FILE" 2>/dev/null || echo 0)
NEXT_RUN=$((RUN_COUNT + 1))

# Helper: run mempalace search, return clean content only
palace_search() {
  local query="$1" room="${2:-}" results="${3:-2}" maxc="${4:-200}"
  python3 - "$query" "$room" "$results" "$maxc" << 'PYEOF'
import subprocess, re, sys
query, room, results, maxc = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
cmd = ['/home/admin/.local/bin/mempalace', 'search', query, '--wing', 'race-whisperer', '--results', results]
if room:
    cmd += ['--room', room]
try:
    raw = subprocess.run(cmd, capture_output=True, text=True, timeout=10).stdout
except Exception:
    sys.exit(0)
clean = re.sub(r'\x1b\[[0-9;]*[mGKH]', '', raw)
out, after = [], False
for line in clean.split('\n'):
    t = line.strip()
    if re.match(r'^[=─]{5,}', t) or re.match(r'^\[\d+\]\s+\w', t):
        after = False; continue
    if t.startswith(('Results for:', 'Source:', 'Match:')):
        after = t.startswith('Match:')
        continue
    if after and t:
        out.append(t)
print('\n'.join(out[:5]).strip()[:maxc])
PYEOF
}

# Seed direction — first meaningful paragraph from SEED.md
DIRECTION=$(python3 -c "
try:
    lines = open('$PROJECT_DIR/memory/SEED.md').read().strip().split('\n')
    # Take first non-heading, non-empty content (~150 chars)
    content = [l.strip() for l in lines if l.strip() and not l.startswith('#')]
    print('\n'.join(content[:3])[:200])
except: pass" 2>/dev/null)

# User feedback — highest priority; skip if file is empty/template-only
FEEDBACK=$(python3 -c "
import os, re
path = '$PROJECT_DIR/memory/FEEDBACK.md'
if os.path.exists(path):
    lines = [l for l in open(path) if l.strip() and not l.strip().startswith(('#', '<!--', 'Format:'))]
    if lines: print(''.join(lines).strip()[:200])
" 2>/dev/null)

# Active thread — first open checkbox from ACTIVE_THREADS.md
ACTIVE=$(python3 -c "
try:
    lines = open('$PROJECT_DIR/memory/ACTIVE_THREADS.md').read().split('\n')
    open_items = [l.strip() for l in lines if '- [ ]' in l][:2]
    print('\n'.join(open_items)[:250])
except: pass" 2>/dev/null)

# Failures and constraints from MemPalace room searches
FAILURES=$(palace_search "failed broken bug test api" "failures" 2 220)
CONSTRAINTS=$(palace_search "constraint rule never always decision" "decisions" 2 220)

cat > "$PROJECT_DIR/memory/MEMORY_BRIEF.md" << BRIEF
# Memory Brief — ${RUN_TYPE^^} #${NEXT_RUN}
*$(date '+%Y-%m-%d %H:%M') — pre-run context from MemPalace*

## Project direction
${DIRECTION:-"(read SEED.md)"}

## User feedback (highest priority)
${FEEDBACK:-"(none)"}

## Open thread
${ACTIVE:-"(check ACTIVE_THREADS.md)"}

## Prior failures to avoid
${FAILURES:-"(none recalled)"}

## Hard constraints
${CONSTRAINTS:-"(check memory/decisions.md)"}
BRIEF

echo "[brief] MEMORY_BRIEF.md → $(wc -c < "$PROJECT_DIR/memory/MEMORY_BRIEF.md") bytes"
