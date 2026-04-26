# Memory Brief — MUTATE #62
*2026-04-26 17:13 — pre-run context*

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
### [x] Evaluate Run 46 weight rebalance — DONE (Run 54)
### [x] eval-mae.mjs H3 sync — DONE (Run 58)
### MAE corpus — 9 dates, 72 races (updated Run 60)
### [x] atgHistoricalApi.ts console cleanup — DONE (Run 54)
