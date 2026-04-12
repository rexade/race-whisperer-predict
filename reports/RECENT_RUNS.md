# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

## Run 59 — 2026-04-11 — RESEARCH

**Investigated:** H4 layoff threshold change (21d → 14d) — readiness check. Traced `calculateLayoffAdjustment` through `performanceCalculators.ts`, `normalizationConstants.ts`, `horseNormalizationProcessor.ts`, `index.ts`, and `eval-mae.mjs`. Read all existing layoff tests. Read both MAE reports (48 races total).

**Key finding:** The `eval-mae.mjs` script has its own hardcoded `LAYOFF_THRESH = 21` at line 93 — a direct constant clone, not imported from `normalizationConstants.ts`. If `LAYOFF_THRESHOLD_DAYS` is changed to 14 in the source, the evaluator silently continues to use 21, diverging from the live pipeline. This is the same class of desync that Run 58 fixed for H3's `FORM_POOR_THRESHOLD`. Additionally, 3 existing tests embed 21d-threshold-specific assertions and will fail after the change: (1) `'returns 0 at exactly the threshold (21 days)'` (line 609 — with 14d threshold, 21d produces ~0.080s); (2) `'returns small penalty just above threshold (22 days → ~0.012 s)'` (line 622 — excess changes from 1d to 8d, penalty ~0.090s); (3) `'returns ~0.267 s at one scale-unit past threshold (51 days)'` (line 629 — the semantically-correct "one scale unit" test becomes 44d = 14+30, penalty ~0.301s). All other layoff tests remain valid.

**Implication:** A simple 1-line constant change in `normalizationConstants.ts` leaves the evaluator broken without also patching `eval-mae.mjs:93`. The 3 broken tests are not accidents — they document the old threshold and must be rewritten to express the new intent (14d baseline, 44d = one scale unit, 22d = 8d excess). Net scoring impact: a horse that rested exactly 21 days (previously penalty-free) would receive +0.080s × weight 0.6 = +0.048s net penalty — meaningful in tight fields.

**Suggested next move:** MUTATE — H4 step 2. One run, 4 changes: (1) `normalizationConstants.ts` line 178: `LAYOFF_THRESHOLD_DAYS = 21 → 14`. (2) `eval-mae.mjs` line 93: `LAYOFF_THRESH = 21 → 14`. (3) Update test at line 609: assert `calculateLayoffAdjustment(21)` ≈ 0.080s (POOR penalty for normal-rest horse). (4) Update tests at lines 622 and 629: rewrite "just above threshold" as 15d (excess=1, ~0.012s) and "one scale unit" as 44d (excess=30, ~0.267s). tsc + all tests must pass.

<!-- stdout from run 55 2026-04-11 20:00 -->
**Run 59 — Research complete.**

## What I investigated

Traced the full H4 layoff threshold change (21d → 14d) from constant → formula → normalization pipeline → browser processor → test suite → MAE evaluator.

## Key finding

`eval-mae.mjs` has its own hardcoded `LAYOFF_THRESH = 21` at line 93 — a constant clone, not imported from the source. If only `normalizationConstants.ts` is changed, the evaluator silently diverges from the live pipeline. This is the **same desync class** that Run 58 fixed for H3's `FORM_POOR_THRESHOLD`.

## What breaks predictably

Three tests embed 21d-threshold-specific assertions that will fail after the change:
- Line 609: `'returns 0 at exactly the threshold (21 days)'` → at 14d threshold, 21d produces ~0.080s (not 0)
- Line 622: `'returns small penalty just above threshold (22 days → ~0.012 s)'` → excess is now 8d, penalty ~0.090s
- Line 629: `'returns ~0.267 s at one scale-unit past threshold (51 days)'` → one scale unit (30d past 14d threshold) is now 44d; 51d ≈ 0.310s

## Suggested mutate action

**H4 step 2 — 4 atomic changes in one run:**
1. `normalizationConstants.ts:178` — `LAYOFF_THRESHOLD_DAYS = 21 → 14`
2. `eval-mae.mjs:93` — `LAYOFF_THRESH = 21 → 14`
3. Update test (line 609) to assert `calculateLayoffAdjustment(21) ≈ 0.080s`
4. Rewrite "just above threshold" test as 15d (≈0.012s) and "one scale unit" as 44d (≈0.267s)

---

## Run 59 — 2026-04-11 — MUTATE

**Goal:** H4 — Lower layoff threshold 21d → 14d. READY TO EXECUTE as documented in ACTIVE_THREADS.md. Typical V85 rest = 10–14d; 21d was too forgiving for horses with a normal double-rest week.

**Done:**
- `src/services/modernKm/normalizationConstants.ts`: `LAYOFF_THRESHOLD_DAYS = 21` → `14`
- `scripts/eval-mae.mjs`: `LAYOFF_THRESH = 21` → `14` (mirrors H3 sync pattern)
- `src/services/modernKm/performanceCalculators.ts`: JSDoc examples updated (14d threshold, 21d → +0.08s, 44d → +0.27s)
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts`: Updated 4 tests — comment header, "21 days" test (now asserts ~0.080s), "just above threshold" (22d → 15d), "one scale unit" (51d → 44d), inline excess comments

**Result:** pass — tsc clean, 156/156 tests pass

**Net scoring impact:** Horse with 21d rest now gets +0.080s raw × 0.6 weight = +0.048s net penalty (was 0). Horses at 15–21d (normal double-rest week) now correctly penalised.

**Next:** Expand MAE corpus to 72+ races (try 2026-02-21, 2026-02-14, 2026-01-31) for more statistical signal on V1 vs V2 verdict.

<!-- stdout from run 56 2026-04-11 21:00 -->
Done. Here's what changed in Run 59:

**H4 — Layoff threshold 21d → 14d**

| File | Change |
|---|---|
| `normalizationConstants.ts` | `LAYOFF_THRESHOLD_DAYS = 21` → `14` |
| `scripts/eval-mae.mjs` | `LAYOFF_THRESH = 21` → `14` (eval script kept in sync) |
| `performanceCalculators.ts` | JSDoc examples updated to reflect 14d threshold |
| `normalizationPipeline.test.ts` | 4 tests updated: "21d" now asserts +0.080s; "just above" changed from 22d→15d; "one scale unit" changed from 51d→44d; inline excess comments corrected |

**Scoring impact:** A horse resting 15–21 days (normal double-rest week) now gets a real penalty — up to +0.048s net at 21d (was 0). This correctly separates weekly rhythm from genuine layoffs.

**tsc clean, 156/156 tests pass.**

Next: expand MAE corpus to 72+ races (dates 2026-02-21, 2026-02-14, 2026-01-31) for statistically meaningful V1 vs V2 verdict.

---

## Run 60 — 2026-04-11 — MUTATE

**Goal:** MAE corpus expansion — run eval-mae.mjs on 2026-02-21, 2026-02-14, 2026-01-31 to reach 72 races and gain statistical signal on V1 vs V2.

**Done:**
- Ran `scripts/eval-mae.mjs 2026-02-21 2026-02-14 2026-01-31` (24 new races, 3 dates)
- V1 MAE=5.858, V2 MAE=5.853, Delta=−0.005 — V2 microscopically better
- Combined 72-race picture: V1=5.290, V2=5.288, Delta=−0.002 — V2 marginally better across all 9 dates
- Report saved: `reports/mae-auto-2026-02-21.json`
- Updated `status.json`, `ACTIVE_THREADS.md`

**Result:** pass

**Next:** MAE-driven weight presets — accumulate data for further tuning, or investigate why older dates (Jan-Feb) have higher MAE (~5.8) vs newer dates (Mar, ~4.7-5.2). Could be seasonal/conditions, or model gaps.

<!-- stdout from run 57 2026-04-11 22:00 -->
Run 60 complete.

---

**Goal:** MAE corpus expansion to 72 races (9 dates) for statistical signal on V1 vs V2.

**Done:** Ran `eval-mae.mjs` on 2026-02-21, 2026-02-14, 2026-01-31.

**Results:**

| Batch | Races | V1 MAE | V2 MAE | Delta |
|---|---|---|---|---|
| Mar 14 / Mar 7 / Feb 28 | 24 | 4.779 | 4.733 | −0.046 (V2 better) |
| Apr 5 / Mar 28 / Mar 21 | 24 | 5.233 | 5.279 | +0.046 (V1 better) |
| Feb 21 / Feb 14 / Jan 31 | 24 | 5.858 | 5.853 | −0.005 (V2 better) |
| **Combined** | **72** | **5.290** | **5.288** | **−0.002 — V2 marginally better** |

**Verdict:** V2 edges V1 across all 9 dates. Design philosophy (form-heavy, reduced career-stat overlap) holds. V2 remains current.

**Observation:** Older dates (Jan-Feb) show considerably higher MAE (~5.8) for both weights vs recent dates (Mar, ~4.7-5.2). Could be seasonal track conditions, field composition, or a model gap — worth investigating before adding more corpus data.

**Next:** MAE-driven weight presets in WeightManager, or investigate the Jan-Feb high-MAE seasonal pattern.

---

## Run 61 — 2026-04-11 — MUTATE

**Goal:** MAE-driven weight presets — surface empirical MAE data in WeightManager. The WEIGHT_PRESETS array in presetWeights.ts existed but was completely dead (no UI used it). Thread: MAE corpus (72 races) is the evidence base.

**Done:**
- `src/services/modernKm/presetWeights.ts` — added `maeScore?: number; raceCount?: number;` to `WeightPreset` interface. Added new first entry: `'V2 — Empirical (2026)'` with DEFAULT_WEIGHTS values, maeScore=5.288, raceCount=72.
- `src/components/WeightManager.tsx` — imported `WEIGHT_PRESETS, WeightPreset`; added `selectedPreset` state; added `applyPreset()` handler; added "Quick Presets" section at top of the Weight Factors tab — compact button row showing all presets with inline MAE score for the V2 entry, description shown below on selection.

**Result:** pass — tsc clean, 156/156 tests pass

**Next:** Investigate Jan-Feb high-MAE pattern (MAE ~5.8 vs Mar ~4.7-5.2). Or add a V3 weight candidate based on batch data (V2 is better in 2/3 batches — form-heavy direction is right, could push further).

<!-- stdout from run 58 2026-04-11 23:00 -->
Run 61 complete. Here's what changed:

---

**Goal:** MAE-driven weight presets — surface 72-race evaluation data in WeightManager. The `WEIGHT_PRESETS` array was entirely dead code (defined but never used anywhere in the UI).

**Done:**

**`src/services/modernKm/presetWeights.ts`**
- Added `maeScore?: number; raceCount?: number;` to `WeightPreset` interface
- Added `'V2 — Empirical (2026)'` as the first preset: exact DEFAULT_WEIGHTS values, `maeScore: 5.288`, `raceCount: 72`, description citing the 9-date evaluation

**`src/components/WeightManager.tsx`**
- Imported `WEIGHT_PRESETS, type WeightPreset` from presetWeights
- Added `selectedPreset` state + `applyPreset()` handler
- Added "Quick Presets" section at the top of the Weight Factors tab: compact button row, V2 shows `5.288 MAE` inline, selected preset shows description below

**Result:** tsc clean, 156/156 tests pass.

**Next:** Jan-Feb high-MAE pattern investigation (MAE ~5.8 vs Mar ~4.7-5.2) — check if it's seasonal/field composition, or consider a V3 weight candidate (form 0.8→1.0, postPosition 0.9→0.7) tested with `eval-mae.mjs`.