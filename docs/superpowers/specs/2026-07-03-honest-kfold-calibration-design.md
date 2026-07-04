# Honest K-fold Weight Calibration — Design

**Date:** 2026-07-03
**Status:** Approved (user delegated approach choice; option B selected)

## Problem

Both CLI optimizers (`scripts/kfold-multistart.ts`, `scripts/kfold-optimize.ts`) claim
k-fold cross-validation but never use `fold.train`. Their `kfoldMRR()` averages
`evaluateWeights(fold.test, w)` over all K folds — which is mathematically identical to
scoring on the entire dataset. Coordinate descent then optimizes that number directly,
so every "CV" result to date is **in-sample** and overfit. Reported win% is optimistic
and weight selection does not target generalization to future race days.

The browser-side `weightOptimizer.ts` is healthier (L2 regularization, optional held-out
`testDataset`) but the CLI multistart flow never adopted either.

## Goal

Weights selected by the CLI should maximize **out-of-sample** winner MRR, with an honest
final number measured on dates the optimizer never saw. Better generalization = better
predictions on race day.

## Design (Approach B)

### 1. Reusable split helpers — `src/services/calibration/datasetSplits.ts`

- `chronologicalHoldout(dataset, fraction, minDates)` — sort dates ascending, reserve the
  most recent `max(fraction × N, minDates)` dates as holdout; return `{ train, holdout }`.
  Chronological (not random) because deployment reality is "calibrate on the past, bet on
  tomorrow".
- `createDateFolds(dataset, k, seed)` — seeded-shuffle date-level k-fold producing
  `{ train, test }[]` with no overlap; every date in exactly one test fold.
- Unit-tested (no leakage, chronology, fold coverage).

### 2. Optimizer options — `src/services/calibration/weightOptimizer.ts`

`optimizeWeights(...)` gains an optional `opts` parameter (backwards compatible):
`{ saSteps?, maxPasses?, optimizeCurves? }`. CLI fold runs use reduced budgets
(SA + CD are run K+1 times per start); browser behavior unchanged by default.
L2 regularization already lives here and is reused as-is.

### 3. Honest multistart protocol — rework `scripts/kfold-multistart.ts`

1. Load dataset, split: chronological holdout (latest ~20% of dates, min 6) — **never**
   touched until the final report.
2. On the training window, build K=4 date-level folds.
3. For each start (DEFAULT, curated preset shortlist, V37 jitters): for each fold,
   `optimizeWeights(fold.train)` → evaluate on `fold.test`. Score the start by mean
   out-of-fold MRR (± std across folds).
4. Select the start with best mean out-of-fold MRR.
5. Refit: `optimizeWeights` on the **full training window** from the winning start.
6. Report: evaluate refit weights AND current-production weights on the holdout.
   Print honest deltas (MRR, win%, top3) and the final weights JSON.
   If the refit does not beat baseline on holdout, say so — keep baseline.

Budget knobs as CLI flags: `--k`, `--sa`, `--passes`, `--curves`, `--holdout`.
Runtime is sized after measuring `evaluateWeights` wall-time on the real dataset.

### 4. Out of scope / follow-ups

- `kfold-optimize.ts` carries the same flaw — deprecation note added, not reworked.
- Plackett–Luce full-finish-order objective: promising but needs validation time;
  documented as a follow-up experiment, not built now.
- Fresh dataset collection (browser cache currently ends 2026-05-09).

## Success criteria

- Split helpers unit-tested; full suite green.
- End-to-end run on `calibration-dataset-6mo.json` (39 dates, 312 races) completes and
  reports holdout MRR/win% for new weights vs current weights.
- Deliverable: weights JSON usable as an app preset, adopted only if it beats the
  current weights on the untouched holdout.

## Baseline reference (2026-07-03 bundle, in-sample, 312 races)

Current production weights: win 41.0%, MRR 0.577, winner-top3 67.3%, rankMAE 7.79.
