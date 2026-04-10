# Memory Brief — MUTATE #38
*2026-04-10 16:00 — pre-run context from MemPalace*

## Project direction
A V75 horse race analysis tool. Users pick a race date, the app fetches ATG race data,
runs normalization/scoring logic across horses in each leg, and surfaces ranked picks.
- React 18 + TypeScript + 

## User feedback (highest priority)
(none)

## Open thread
(check ACTIVE_THREADS.md)

## Prior failures to avoid
# Race Whisperer Predict — Failure Patterns
## Scheduling
- Claude Code rate limit resets at 10pm Europe/Stockholm — runs 28 (twice) failed this way. Schedule outside this window.
## Testing
- jsdom ESM incompatibility: 

## Hard constraints
eep it there
- `src/services/modernKm/` is the core km-time normalization logic — treat as sensitive
## Code quality
- `tsc --noEmit` must pass after every change — no type errors allowed
- 71 tests must pass after every
