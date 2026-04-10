#!/bin/bash
# generate-brief.sh — build MEMORY_BRIEF.md before a race-whisperer run
# Uses mempalace wake-up (L0+L1 ~170 tokens) + targeted search for run-type context.
# Usage: ./generate-brief.sh [run_type]

set -euo pipefail

PROJECT_DIR=/home/admin/race-whisperer-predict
LOG_FILE=$PROJECT_DIR/reports/RUN_LOG.md
PALACE=/home/admin/.local/bin/mempalace
RUN_TYPE=${1:-mutate}
RUN_COUNT=$(grep -c "^## Run " "$LOG_FILE" 2>/dev/null || echo 0)
NEXT_RUN=$((RUN_COUNT + 1))

# L0+L1 from palace wake-up — structured identity + critical facts (~170 tokens)
WAKEUP=$($PALACE wake-up --wing race-whisperer 2>/dev/null | \
  python3 -c "
import sys, re
text = sys.stdin.read()
# Strip ANSI, decorative lines, token count header
text = re.sub(r'\x1b\[[0-9;]*[mGKH]', '', text)
text = re.sub(r'^Wake-up text.*\n', '', text, flags=re.MULTILINE)
text = re.sub(r'^={10,}\n', '', text, flags=re.MULTILINE)
print(text.strip()[:1200])
" 2>/dev/null)

# User feedback — highest priority; skip if file is empty/template-only
FEEDBACK=$(python3 -c "
import os
path = '$PROJECT_DIR/memory/FEEDBACK.md'
if os.path.exists(path):
    lines = [l for l in open(path) if l.strip() and not l.strip().startswith(('#', '<!--', 'Format:'))]
    if lines: print(''.join(lines).strip()[:300])
" 2>/dev/null)

# Open threads — first 3 open checkboxes from ACTIVE_THREADS.md (source of truth, updated each run)
ACTIVE=$(python3 -c "
try:
    lines = open('$PROJECT_DIR/memory/ACTIVE_THREADS.md').read().split('\n')
    open_items = [l.strip() for l in lines if '- [ ]' in l or ('###' in l and 'LANE' not in l and 'Open' not in l and 'Closed' not in l)][:4]
    print('\n'.join(open_items)[:400])
except: pass" 2>/dev/null)

cat > "$PROJECT_DIR/memory/MEMORY_BRIEF.md" << BRIEF
# Memory Brief — ${RUN_TYPE^^} #${NEXT_RUN}
*$(date '+%Y-%m-%d %H:%M') — pre-run context*

## Palace context (L0+L1)
${WAKEUP:-"(palace unavailable — read memory/decisions.md and memory/failures.md)"}

## User feedback (highest priority)
${FEEDBACK:-"(none)"}

## Open threads
${ACTIVE:-"(check ACTIVE_THREADS.md)"}
BRIEF

echo "[brief] MEMORY_BRIEF.md → $(wc -c < "$PROJECT_DIR/memory/MEMORY_BRIEF.md") bytes"
