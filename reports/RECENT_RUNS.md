# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

## Run 47 — 2026-04-10 — MUTATE

**Goal:** Surface MAE accuracy panel (MAEPanel was built in Run 32 but never mounted — invisible to users). Add compact accuracy badge to header toolbar. Fix kmTimeProcessor test noise.
**Done:**
- `src/components/V75Analyzer.tsx` — lazy-import `MAEPanel`; import `getAggregateMAEStats`; add `maeStats` state (lazy-init from localStorage on mount); add `useEffect` to refresh stats when cache drawer closes; add `±X.X` accuracy badge in header left section (clicking it opens cache drawer); mount `MAEPanel` below `V75CacheManager` when `showCacheManager` is true
- `src/services/kmTimeProcessor.ts:113` — `log.warn` → `log.debug` for "NO HISTORICAL DATA" (expected fallback path, not an error, was cluttering test output)
**Result:** pass — tsc clean, 127/127 tests pass
**Next:** Evaluate Run 46 weight rebalance — run MAE evaluator on recent dates via the now-visible MAEPanel, compare Rank MAE and win% vs baseline (MAE 5.289, win 30.6%). Record actual numbers and update status.json accuracy field.

<!-- stdout from run 37 2026-04-10 14:00 -->
Run 47 complete. Here's what changed:

**Problem:** `MAEPanel` was built in Run 32 but never actually mounted anywhere — users had no way to see model accuracy data.

**Fixed in `V75Analyzer.tsx`:**
- Lazy-imported `MAEPanel`
- Added `maeStats` state (lazy-init from localStorage on mount, refreshes when cache drawer closes)
- Added compact `±X.X` accuracy badge in the header left section — visible at all times when MAE data exists, clicking it opens the cache drawer
- `MAEPanel` now mounts below `V75CacheManager` when the cache drawer is open

**Bonus fix in `kmTimeProcessor.ts:113`:**
- `log.warn("NO HISTORICAL DATA…")` → `log.debug(…)` — this path is an expected fallback, not an error, and was cluttering test output

**Result:** tsc clean, 127/127 tests pass.


<!-- stdout from run 38 2026-04-10 15:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 6pm (Europe/Stockholm)


<!-- stdout from run 38 2026-04-10 16:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 6pm (Europe/Stockholm)


<!-- stdout from run 38 2026-04-10 17:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 6pm (Europe/Stockholm)


---

---

## Run 48 — 2026-04-10 — MUTATE

**Goal:** Lane 2 research — produce 5 falsifiable hypotheses on baseline prediction errors. Opportunistic: console cleanup in `horseProcessing.ts` + dead `horseForm` removal.
**Done:**
- `memory/decisions.md` — added `## Research: baseline investigation — Run 48` with 5 hypotheses (H1–H5 ranked by impact): gallop-invisible-to-form, single-best-time-bias, field-size-blind-form, layoff-threshold-miscalibrated, fallback-form-scale-mismatch.
- `src/services/horseProcessing.ts` — added `import { log } from '@/lib/logger'`; replaced all ~20 raw `console.log/warn/error` calls with `log.debug/warn/error`. These fired for every horse on every analysis run.
- `src/components/v75/utils/horseNormalizationProcessor.ts` — removed dead `horseForm: horse.statistics.winPercentage` excess property from both `factors` objects (the `horseForm` field was deleted from `ModernNormalizationFactors` in Run 13; these two lines had zero effect but were misleading).
**Result:** pass — tsc clean, 131/131 tests pass
**Next:** Lane 1 (evaluate Run 46 weights) is unblocked by MAEPanel being visible (Run 47). User needs to run MAE evaluator on recent V75 dates in the browser and record Rank MAE + win% vs baseline (MAE 5.289, win 30.6%). If improved → update status.json accuracy field. If not → revert to v1 weights per ACTIVE_THREADS. After evaluation, consider implementing H1 or H2 from decisions.md.

<!-- stdout from run 38 2026-04-10 18:00 -->
Run 48 complete. Here's what changed:

---

## Summary

**Lane 2 research — 5 hypotheses written to `memory/decisions.md`:**

- **H1 [high]** Gallop/DQ races are invisible to the form calculator — `recentRaces` is built from `processedTimes` which already excludes them. A horse that galloped last race has zero form penalty from that event (gallopRisk is a career-rate signal, not a last-race signal). Fix: pass these races as place=15.
- **H2 [high]** Single best time (most optimistic) biases the model toward boom-or-bust horses over consistent ones. `consistencyFactor` max impact is 0.075s — too small to compensate. Fix: average top-2 times.
- **H3 [med]** Form scoring uses absolute finish positions; 6th in a 7-horse race = 6th in a 16-horse race. Fix: percentile-based bands.
- **H4 [med]** Layoff threshold of 21 days is miscalibrated for the active V75 season where typical rest is 10–14 days. Fix: reduce to 14d.
- **H5 [low]** Fallback form scale (0.01) is 40× smaller than the main form path (0.40) — no-history horses are systematically undervalued.

**Opportunistic cleanup (same pass):**
- `src/services/horseProcessing.ts` — added `log` import; replaced ~20 raw `console.*` calls with `log.debug/warn/error`. These fired on every horse for every analysis run.
- `src/components/v75/utils/horseNormalizationProcessor.ts` — removed dead `horseForm: horse.statistics.winPercentage` from both `factors` objects (property removed from the type in Run 13; these assignments were silently ignored for 35 runs).

**Result:** tsc clean, 131/131 tests pass.

**Lane 1 is still open** — it requires the user to run the MAE evaluator in the browser and compare Rank MAE vs the 5.289 baseline.


<!-- stdout from run 39 2026-04-10 19:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 11pm (Europe/Stockholm)


<!-- stdout from run 39 2026-04-10 20:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 11pm (Europe/Stockholm)


<!-- stdout from run 39 2026-04-10 21:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 11pm (Europe/Stockholm)


<!-- stdout from run 39 2026-04-10 22:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 11pm (Europe/Stockholm)

---

## Run 49 — 2026-04-10 — RESEARCH

**Investigated:** Full gallop signal tracing — `horseProcessing.ts` → `HorseRawKmTime` → `horseNormalizationProcessor.ts` → `confidenceFlags.ts` → `modernKm/index.ts`

**Key finding:** `gallopCount` and `disqualificationCount` are declared in the `HorseRawKmTime` interface (`kmTimeTypes.ts:45-47`) and read by `confidenceFlags.ts:128` (`rawTimeData?.gallopCount ?? 0`), but **`horseProcessing.ts` never populates either field**. It computes `gallopRate` (career float) but omits the integer counts from its return object. Result: `gallopRisk` confidence flag is permanently `false` in production — the "Gallop ×N" UI chip never fires. All four unit tests for this flag pass because they manually inject `gallopCount` via `makeRawTimeData`, masking the wiring gap entirely. Separately, `calculateGallopReliabilityPenalty` (`adjustmentCalculators.ts:173`) — added in Run 22 and documented as "wired into pipeline" — is **dead code**: `modernKm/index.ts` uses `calculateGallopRiskAdjustment` (rate-based, line 156) instead.

**Implication:** Every horse with 2+ gallops in their last 10 starts is silently missing the "Gallop ×N" warning chip. The reliability score for these horses is inflated by 0.5 points (no gallop deduction). Users see no flag for horses that are genuine reliability concerns. The scoring itself is unaffected (career rate penalty still applies), but the annotation system is broken.

**Suggested next move:** Mutate `horseProcessing.ts` only — add two lines to the return object:
```
gallopCount: sortedRecent10.filter(r => r.galloped).length,
disqualificationCount: sortedRecent10.filter(r => r.disqualified).length,
```
where `sortedRecent10` is `historicalRaces` sorted descending by date, sliced to 10. No interface changes needed (fields already exist). No scoring changes. Test: the existing 4 `gallopRisk` tests should still pass; add 1 integration test verifying `gallopCount > 0` when input has a galloped race in the last 10. After this is merged, `calculateGallopReliabilityPenalty` can replace `calculateGallopRiskAdjustment` in `modernKm/index.ts` for a more granular recent-count-based penalty (separate run).


<!-- stdout from run 39 2026-04-10 23:00 -->
---

---

## Run 49 Research Summary

**Thread investigated:** `gallopCount` wiring — traced the full gallop signal from data ingestion to UI flag.

### What I found

**Production bug — `gallopRisk` confidence flag is permanently silent:**

The chain breaks at `horseProcessing.ts`. It computes `gallopRate` (career float) and returns it, but the `HorseRawKmTime` interface also declares `gallopCount` and `disqualificationCount` (integer counts for last 10 starts). These are never populated. `confidenceFlags.ts:128` reads `rawTimeData?.gallopCount ?? 0` — always gets `0` — so `gallopRisk` is always `false`.

The UI chip `"Gallop ×N"` in `CompactHorseRow.tsx` and the −0.5 reliability score deduction never fire for any horse in production. Four unit tests pass only because they manually inject `gallopCount` via `makeRawTimeData` — they test the function in isolation, masking the wiring gap entirely.

**Secondary finding — `calculateGallopReliabilityPenalty` is dead code:**

Run 22 notes say "wired into pipeline" but `modernKm/index.ts:156` uses `calculateGallopRiskAdjustment` (career rate, from `performanceCalculators.ts`) instead. `calculateGallopReliabilityPenalty` (count-based, from `adjustmentCalculators.ts`) is exported, tested (10 tests), but never called in the pipeline.

### Recommended next MUTATE

**File:** `src/services/horseProcessing.ts` — one change, no interface modifications needed:

Compute from `historicalRaces` sorted descending by date, sliced to 10:
```
gallopCount: recentTen.filter(r => r.galloped === true).length,
disqualificationCount: recentTen.filter(r => r.disqualified === true).length,
```

This fixes the silent flag, doesn't touch scoring, and opens the door for replacing `calculateGallopRiskAdjustment` with the count-based `calculateGallopReliabilityPenalty` in a follow-up run.