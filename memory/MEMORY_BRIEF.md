# Memory Brief — MUTATE #46
*2026-04-11 09:00 — pre-run context*

## Palace context (L0+L1)
Lab: Pi Pulse incubator — Raspberry Pi 5 (testpi), /home/admin/lab
Active project: race-whisperer-predict (V75 horse race analysis, mounted in incubator)
Pi Pulse loop: winding down — lab-runner.timer to be disabled after narrator restart
Race-whisperer loop: active hourly via race-whisperer.timer
Current phase: visual retheme (Pi Pulse dark aesthetic) + gallopCount fix + LANE 1 weight eval
Owner: admin

## L1 — ESSENTIAL STORY

[decisions]
  - # Race Whisperer Predict — Durable Decisions  ## ATG API (CRITICAL — never violate) - The app calls the real ATG.se production API — only from the browser, triggered by user action - Never add poll...  (decisions.md)
  - CI — use mocked/cached data only - Violation = real traffic to a production API without user consent  ## Architecture - React Query for all data fetching (useGameInfo, useRaceData) - `useV75Analysi...  (decisions.md)
  - eep it there - `src/services/modernKm/` is the core km-time normalization logic — treat as sensitive  ## Code quality - `tsc --noEmit` must pass after every change — no type errors allowed - 71 tes...  (decisions.md)

[failures]
  - # Race Whisperer Predict — Failure Patterns  ## Scheduling - Claude Code rat

## User feedback (highest priority)
(none)

## Open threads
### Evaluate Run 46 weight rebalance — compare vs baseline
### [x] H1 — galloped race dates invisible to form calculator — DONE (Run 51)
### [x] U2 — Surface polish — DONE (Run 51)
### [x] U1 — Dark foundation — DONE (Run 50/MUTATE)
