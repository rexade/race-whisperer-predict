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

---

## Research: baseline investigation — Run 48

Baseline: Rank MAE 5.289, win% 30.6%, top-3% 52.5% (49 races, 17 dates, pre-Run 46 weights).
Run 46 changed form signal (0.5→0.8, scale 0.30→0.40, window 8→5, recency linear→exponential).
Hypotheses are ranked by estimated impact on Rank MAE.

**H1 [high]: Galloped and DQ'd races are invisible to the form calculator, making recently unreliable horses look more formful than they are.**
Evidence: `horseNormalizationProcessor.ts` builds `recentRaces` from `rawTimeData.allTimes` filtered to `finishOrder > 0`. But `allTimes` is `processedTimes` in `horseProcessing.ts`, which explicitly drops galloped (`race.galloped === true`) and disqualified races (lines 110–123). A horse whose last race was a gallop has that race completely absent from the form signal. The gallopRisk factor adds a small career-rate penalty but zero "last race galloped" signal — a first-time galloper gets no form penalty at all.
Proposed test: In `horseNormalizationProcessor.ts`, augment `recentRaces` by also pulling galloped/DQ'd entries from the raw historical data (before processedTimes filtering) and treating them as place=15. This makes the form calculator penalize a recent gallop directly. Run MAE evaluator before and after.

**H2 [high]: Using the single best (most optimistic) normalized time as the base biases the model toward peak performers over consistent ones.**
Evidence: `horseProcessing.ts` line 217: `const fastestRecord = processedTimes[0].normalizedTime` — always takes the single fastest of the last 5 months. A horse with one 1:11.5 and five 1:14+ runs gets the same base as a horse consistently at 1:11.5. The `consistencyFactor` weight (0.5, max impact 0.075s after weighting) is too small to compensate for a 2–3 second advantage from cherry-picking the peak run. This is a likely driver of false favorites: boom-or-bust horses with one great run outranking consistently solid ones.
Proposed test: Use average of top-2 normalized times when ≥2 are available. Expect false-favorite rate to drop and Rank MAE to improve by 0.3–0.5 positions.

**H3 [medium]: Form scoring uses absolute finish positions, ignoring field size — 6th in a 7-horse race gets the same form score as 6th in a 16-horse race.**
Evidence: `calculateFormAdjustment` in `performanceCalculators.ts` assigns fixed band scores: 1st=−1.0, 2–3=−0.5, 4–5=−0.2, 6–10=+0.3, 11+=+0.6. In a 7-horse field, 6th is last but one (poor result) but also gets +0.3 — same score as 6th in a 16-horse field (top 37.5%, a respectable result). Swedish V75 fields vary from 6 to 16 horses, so this systematic error affects a large fraction of form inputs.
Proposed test: Pass field size to `calculateFormAdjustment`. Replace absolute bands with percentile bands: top 15% = WIN tier, 15–35% = PLACE, 35–60% = GOOD, 60–80% = MID, bottom 20% = POOR. This is a backward-compatible interface change since field size is already available in the race data.

**H4 [medium]: Layoff threshold of 21 days is too binary for Swedish harness racing where typical active-season interval is 10–14 days.**
Evidence: `LAYOFF_THRESHOLD_DAYS = 21` means horses returning after 20 days and after 10 days get identical treatment (zero penalty). In the intensive V75 autumn/spring calendar, horses racing every 10–14 days are standard. At 21 days, many "routinely rested" horses never trigger the penalty at all, while those returning at 22 days get a tanh step function. The threshold was likely calibrated to off-season rest intervals, not peak-season ones.
Proposed test: Reduce `LAYOFF_THRESHOLD_DAYS` to 14. Penalty curve becomes: 14d=0, 28d≈+0.14s, 44d≈+0.24s, 90d≈+0.33s. Run MAE on a date set including horses returning from 2–3 week breaks vs. weekly racers.

**H5 [low]: Form fallback (win% proxy) and main form path have different scales — a horse with no recent race history uses the wrong order of magnitude.**
Evidence: `calculateFormAdjustment` fallback uses `(FORM_FALLBACK_BASELINE_PCT − pct) × FORM_FALLBACK_SCALE_S` = `(10 − pct) × 0.01`. For a horse with 20% career win rate: `(10−20)×0.01 = −0.10s`. The main path with a win on the last race returns approximately `−1.0 × FORM_SCALE_S = −0.40s`. So a horse with no recent data and a 20% career win rate gets a −0.10s form bonus while a horse with actual recent wins gets −0.40s. The fallback scale (0.01) is 40× smaller than the main scale (0.40), creating a systematic undervaluing of career-stat-only horses relative to horses with recent history.
Proposed test: Either scale up the fallback to `FORM_FALLBACK_SCALE_S = 0.03` to partially bridge the gap, or add an explicit UI note that horses without recent race data have compressed form signals.
