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

### MAE corpus — 6 dates, 48 races (updated Run 58)
| Dates | Races | V1 MAE | V2 MAE | Delta |
|---|---|---|---|---|
| 2026-03-14, 2026-03-07, 2026-02-28 | 24 | 4.779 | 4.733 | −0.046 (V2 better) |
| 2026-04-05, 2026-03-28, 2026-03-21 | 24 | 5.233 | 5.279 | +0.046 (V1 better) |
| **Combined** | **48** | **5.006** | **5.006** | **0.000 — tied** |

V2 remains current. Delta is noise-level; V2 design philosophy (form-heavy, reduced career-stat overlap) is sound. Need 72+ races for statistical signal.

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

### H4 — Layoff threshold 21d → 14d — READY TO EXECUTE (researched Run 59)

**Rationale:** Typical V85 rest = 10–14d. 21d threshold is too forgiving — horses with 15–21d rest (common after a normal double-rest week) are currently penalty-free. 14d threshold correctly separates regular weekly rhythm from genuine layoffs.

**Step 1 DONE (Run 55):** 9 tests added to `normalizationPipeline.test.ts` covering all key cases. 153 tests total, all pass.

**Step 2 — execute (4 changes, 1 run):**
1. `normalizationConstants.ts` line 178: `LAYOFF_THRESHOLD_DAYS = 21` → `14`
2. `eval-mae.mjs` line 93: `LAYOFF_THRESH = 21` → `14` **(critical — mirrors H3 sync pattern from Run 58)**
3. Update test (line 609): `'returns 0 at exactly the threshold (21 days)'` → assert `calculateLayoffAdjustment(21)` ≈ 0.080s (was 0). Description: "21 days is above new 14d threshold".
4. Update tests (lines 622, 629): rewrite "just above threshold" as 15d (excess=1, penalty≈0.012s) and "one scale unit" as 44d = 14+30 (excess=30, penalty≈0.267s).

**Net scoring impact:** A horse with 21d rest gets +0.080s raw × 0.6 weight = **+0.048s net penalty** (was 0). Meaningful separation in tight fields.

**MAE evaluator note:** eval-mae.mjs varies weight vectors only — it cannot A/B test the threshold constant. After the change, run eval on existing dates (2026-03-14, 2026-03-07, 2026-02-28) to confirm no regression.

### MAE corpus expansion
Run eval-mae.mjs on 2–3 more dates to reach 72 races. More statistical power needed before V1/V2 direction is clear. Candidate dates: try 2026-02-21, 2026-02-14, 2026-01-31.

### MAE-driven weight presets
Use accumulated MAE data to surface tuning suggestions in WeightManager. Requires more MAE data to be useful; consider after more evaluations are done.

## Closed
*Archived to `memory/CLOSED_THREADS.md` — 33 items through Run 49.*
