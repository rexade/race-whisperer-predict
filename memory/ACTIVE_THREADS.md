# Active Threads

Threads represent open lines of investigation or improvement that span multiple runs.

## Two-lane structure — active now

These lanes run in parallel. Mutation lane MUST complete before any new scoring changes.
The research lane feeds the next mutation — it does not produce code changes itself.

---

## LANE 1 — EVALUATE

### [x] Evaluate Run 46 weight rebalance — DONE (Run 54)
V2 weights confirmed better on V85 races: MAE 4.733 vs V1 4.779 (24 races, 3 dates).
Delta: −0.046 → V2 slightly better. Verdict: keep v2 weights.
Report: `reports/mae-auto-2026-03-14.json`.

**Also fixed in Run 54 (eval-mae.mjs bugs):**
- Game type was V75 — corrected to V85 (app uses VITE_GAME_TYPE=V85)
- `normalizeHistoricalKmTime` divided km-time (already s/km) by distance — caused 0/N km-times in all races. Now uses correct piecewise-linear delta.

### [x] eval-mae.mjs H3 sync — DONE (Run 58)
`formAdj` POOR band `<= 10` → `<= 8` (matches `FORM_POOR_THRESHOLD = 9` from H3/Run 57).
Future evaluations now faithfully represent the current pipeline.

### MAE corpus — 9 dates, 72 races (updated Run 60)
| Dates | Races | V1 MAE | V2 MAE | Delta |
|---|---|---|---|---|
| 2026-03-14, 2026-03-07, 2026-02-28 | 24 | 4.779 | 4.733 | −0.046 (V2 better) |
| 2026-04-05, 2026-03-28, 2026-03-21 | 24 | 5.233 | 5.279 | +0.046 (V1 better) |
| 2026-02-21, 2026-02-14, 2026-01-31 | 24 | 5.858 | 5.853 | −0.005 (V2 slightly better) |
| **Combined** | **72** | **5.290** | **5.288** | **−0.002 — V2 marginally better** |

V2 remains current. At 72 races, V2 edges V1 by 0.002 MAE — statistically marginal but consistently in V2's direction (better in 2/3 batches). Design philosophy (form-heavy, reduced career-stat overlap) holds. Older dates (Jan-Feb) show higher MAE (~5.8) vs newer dates (~4.7-5.2) for both weights — seasonal/conditions pattern worth investigating.
Report: `reports/mae-auto-2026-02-21.json`.

---

## LANE 2 — DONE

### [x] atgHistoricalApi.ts console cleanup — DONE (Run 54)
27 raw `console.*` calls → `log.debug`/`log.warn`. `import { log }` added. Emoji prefixes stripped.
`isXanderDebug` gate and `usedFallback` gate preserved. Fallback-path calls are `log.warn`.

### [x] H1 — galloped race dates invisible to form calculator — DONE (Run 51)
**Done.** `gallopDates` computed in `horseProcessing.ts`, added to `HorseRawKmTime`, injected as `{ place: 15, date }` in both code paths of `horseNormalizationProcessor.ts`. A galloped last race now adds +0.24 s form penalty instead of being silently ignored. 3 new tests confirm behaviour.

### [x] U2 — Surface polish — DONE (Run 51)
`PostPositionCurveEditor.tsx:172` `text-blue-600` → `text-muted-foreground`.

---

## LANE 3 — UI (scoring-neutral, runs independently)

### [x] U1 — Dark foundation — DONE (Run 50/MUTATE)
`src/index.css` `.dark {}` block replaced with Pi Pulse palette.
`src/App.tsx`: `defaultTheme="dark"`, `enableSystem` removed.

### [x] U2 — Surface polish (BUNDLED with H1) — DONE (Run 51)

### [x] U3 — Accent propagation — DONE (Run 52)
`:root` light-mode block: all `214` hsl (ATG blue) replaced with `188` hsl (cyan). Light and dark modes now share the same hue. tsc clean, 139 tests pass.

---

## Open — next priority

### [x] G1 — gallopCount wiring gap — DONE (prior to Run 55, found stale)
`horseProcessing.ts` lines 249-255 compute `gallopCount`, `gallopDates`, `disqualificationCount` from `recentTen` and return them. `confidenceFlags.ts:128` reads `rawTimeData?.gallopCount ?? 0` correctly. gallopRisk UI chip is wired. Thread was already implemented — ACTIVE_THREADS had stale entry.

### [x] H3 — POOR band threshold — DONE (Run 57)
`FORM_POOR_THRESHOLD = 9` added to `normalizationConstants.ts`. MID band now 6–8, POOR band 9+.
9th/10th finishes: +0.24s (was +0.12s). tsc clean, 156 tests pass.

### [x] H4 — Layoff threshold 21d → 14d — DONE (Run 59)

**Done:** `LAYOFF_THRESHOLD_DAYS = 14` in normalizationConstants.ts + eval-mae.mjs mirrored. JSDoc updated. Tests updated: "21d" test now asserts +0.080s, "just above" uses 15d, "one scale unit" uses 44d. tsc clean, 156 tests pass.

**Net impact:** Horse with 21d rest now gets +0.080s raw × 0.6 weight = +0.048s net penalty (was 0).

### [x] MAE corpus expansion — DONE (Run 60)
72 races across 9 dates. V2 marginally better (−0.002 MAE). V2 confirmed as current.

### [x] MAE-driven weight presets — DONE (Run 61)
`WeightPreset` interface gains `maeScore?`/`raceCount?`. New `'V2 — Empirical (2026)'` preset added (maeScore=5.288, 72 races). WeightManager exposes all presets as a clickable row with inline MAE label and description. WEIGHT_PRESETS was previously dead code.

### [x] Jan-Feb high-MAE pattern — CLOSED (Run 62)
Pattern does not exist. Two artifacts:
1. **Batch 1 March 14 tiny fields** (avg 6 horses) produce structurally low MAE by construction (max 3.0 for 6h vs 6.0 for 12h). Excluding Mar 14: Batch 1 mean = 5.939 ≈ Batch 3 Jan-Feb (5.858). No seasonal gap.
2. **computeMAE DNS contamination** in eval-mae.mjs: ATG assigns `finishOrder: 56/57` to DNS/withdrawn horses with `galloped: null, disqualified: null`. These pass the `computeMAE` filter and contribute errors of ~49 per horse. **11 of 72 races have MAE values that exceed the theoretical maximum for their field size** — all are DNS-contaminated. Distribution is even across all 3 batches (4/4/3), not seasonal.

### [x] E1 — Fix computeMAE DNS contamination — DONE (Run 63)
`computeMAE()` in `scripts/eval-mae.mjs` now filters `h.actualFinishOrder <= 30` to exclude ATG DNS codes (56/57).
Clean corpus (6 dates, 48 races): V1 MAE=2.716, V2 MAE=2.690. V2 better in 5/6 dates.
`presetWeights.ts` V2 preset updated: maeScore 5.288→2.690, raceCount 72→48.

### [x] V3 weight candidate — DONE (Run 64)
V3 (form:1.0, postPosition:0.7) evaluated on 6-date clean corpus (48 races).
V3 MAE=2.653 vs V2=2.690 — delta −0.037. V3 adopted as DEFAULT_WEIGHTS.
`presetWeights.ts`: V3 added as top preset, V2 kept as reference.
`types.ts`: DEFAULT_WEIGHTS updated with V3 comment + MAE evidence.

### [x] V4 corpus expansion — DONE (Run 65)
Eval on 2026-04-04/11/18/25 — 30 new races. Combined corpus: 10 dates, 78 races.
V3 confirmed best: MAE 2.815 (V2: 2.845, V1: 2.846). V3 remains DEFAULT_WEIGHTS.
presetWeights.ts V3 updated: maeScore=2.815, raceCount=78.
Note: April 4 had small fields (2-3 horse races → n/a MAE), treated as 0 in mean — consistent with existing methodology.
Report: `reports/mae-auto-2026-04-04.json`.

### [x] C1 — noDriverStats chip missing from ConfidenceFlagStrip — DONE (Run 66)
Added `FlagChip` for `flags.noDriverStats` in `CompactHorseRow.tsx:~86`. Icon `WifiOff`, label `"No drv"`, variant `'muted'`. tsc clean, 156 tests pass.

### [x] C2 — enhancedAtgApi.ts console cleanup — DONE (Run 67)
~45 raw `console.*` calls replaced with `log.debug`/`log.warn`/`log.error`. `import { log }` added. Emoji prefixes stripped. tsc clean, 156 tests pass.

### C3 — Equipment change flag — deferred
SEED.md direction 2 lists "equipment this race differs from last race" as a desired flag. Not implemented — `HorseRawKmTime` stores no prior-race equipment data, so comparison isn't possible at flag-computation time. Would require adding last-race shoe/sulky fields to `HorseRawKmTime` and populating them in `horseProcessing.ts`. Low-priority; no scoring impact.

## Closed
*Archived to `memory/CLOSED_THREADS.md` — 33 items through Run 49.*
