# Race Whisperer Predict — Durable Decisions

## ATG API (CRITICAL — never violate)
- The app calls the real ATG.se production API — only from the browser, triggered by user action
- Never add polling, scheduled fetches, auto-refresh, or any code that calls ATG automatically
- Never call ATG endpoints from tests, build scripts, or CI — use mocked/cached data only
- Violation = real traffic to a production API without user consent

## Architecture
- React Query for all data fetching (useGameInfo, useRaceData)
- `useV75Analysis` hook owns the scoring/normalization pipeline — do not break its data flow
- `src/lib/logger.ts` (log.debug/log.warn/log.error) — never use raw console.* in service files
- All scoring logic lives in src/services/ — keep it there
- `src/services/modernKm/` is the core km-time normalization logic — treat as sensitive

## Code quality
- `tsc --noEmit` must pass after every change — no type errors allowed
- 71 tests must pass after every mutate — run `npx vitest run` to verify
- Never touch /home/admin/lab/ — that is Pi Pulse, a separate project
- One meaningful change per run — not three small tweaks

## Accuracy direction (the point of the project)
- Primary goal: trustworthy results backed by data, not just a clean pipeline
- MAE is the mechanism: store predictions → compare to actual results → measure error → inform weight tuning
- Confidence flags are annotation, not scoring — they tell the user how much to trust a result, not change the result itself
- Gallop reliability is the biggest missing factor — a horse that breaks stride 30% of the time is dangerous regardless of km time
- Do not add features that don't serve accuracy or UX clarity — no cosmetic runs

## Process
- SEED.md is law — do what it says, not what seems obvious
- FEEDBACK.md is highest priority — user feedback overrides open threads
- Never add dependencies without a strong reason
- Console cleanup is opportunistic — do it when touching a file, not as a dedicated run
