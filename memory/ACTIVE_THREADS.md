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

### MAE corpus — 10 dates, 78 races (updated Run 65)
| Dates | Races | V1 MAE | V2 MAE | V3 MAE | Delta (V3 vs V2) |
|---|---|---|---|---|---|
| 2026-03-14, 2026-03-07, 2026-04-05, 2026-03-21, 2026-02-14, 2026-01-31 | 48 | 2.716 | 2.690 | 2.653 | −0.037 (V3 best) |
| 2026-04-04, 2026-04-11, 2026-04-18, 2026-04-25 | 30 | 3.055 | 3.093 | 3.074 | — |
| **Full corpus (10 dates)** | **78** | **2.846** | **2.845** | **2.815** | **V3 best** |

V3 is current baseline via MAE evaluation. Production uses V10 calibration (Win 40%).

### [x] V4 corpus evaluation — DONE (Run 70)
Ran `eval-mae.mjs` on 4 April dates (30 races). **V4 = V3 exactly (delta +0.000)**.
Driver×horse win-rate coverage: 0/N across every race — harness drivers rarely partner same horse 2+ starts.
The production pipeline uses field-relative driverForm (different implementation) which IS active.
Report: `reports/mae-auto-2026-04-04.json` (V4 data included).
**Verdict: driver×horse concept provides no benefit. Field-relative version already implemented.**

---

## LANE 2 — DONE

### [x] atgHistoricalApi.ts console cleanup — DONE (Run 54)
### [x] H1 — galloped race dates invisible to form calculator — DONE (Run 51)
### [x] U2 — Surface polish — DONE (Run 51)
### [x] C1 — noDriverStats chip missing — DONE (Run 66)
### [x] C2 — enhancedAtgApi.ts console cleanup — DONE (Run 67)

---

## LANE 3 — UI (scoring-neutral, runs independently)

### [x] U1 — Dark foundation — DONE (Run 50/MUTATE)
### [x] U3 — Accent propagation — DONE (Run 52)

### C3 — Equipment change flag — deferred
SEED.md direction 2: "equipment this race differs from last race". Not implemented — `HorseRawKmTime` stores no prior-race equipment data, comparison not possible. Would require adding last-race shoe/sulky fields to `HorseRawKmTime` and populating in `horseProcessing.ts`. Low-priority.

---

## Closed (Run 70 batch)

### [x] T1 — trainerWinPercentage missing from raw km path — DONE (Run 69)
Added `trainerWinPercentage` to raw-km path factors. 6 tests added. tsc clean, 163/163 pass.

### [x] F1 — fieldStartPoints never populated — DONE (pre-Run 70, commit b54b3fc)
`fieldStartPoints` and `fieldDriverWinRates` both collected and threaded into both paths of `horseNormalizationProcessor.ts`. Field-aware start-points calculator and field-relative driver form both now active.

### [x] D1 — driverForm weight dead in production — DONE (pre-Run 70, commit b54b3fc)
`calculateDriverFormAdjustment` (field-relative: compares driver vs field median/IQR) added to `index.ts:112-117`. Activated when `fieldDriverWinRates.length >= 3`. V4 eval confirmed driver×horse approach has 0 coverage → field-relative is the correct implementation.

### [x] stale-docs — Form calculator docstring incorrect — DONE (Run 70)
`performanceCalculators.ts:161-165` — corrected: "6th–10th" → "6th–8th", "11th+" → "9th+ (FORM_POOR_THRESHOLD)", range "−0.05s…+0.03s" → "−0.40s…+0.24s".

---

## Open — next priority

### MAE corpus expansion — LOW PRIORITY
Run `eval-mae.mjs` on new V85 dates (2026-04-26 and later) as they complete to expand the evaluation corpus. Current corpus: 10 dates, 78 races. V3 MAE 2.815 is the benchmark for LANE 1.

---

## Closed
*Archived to `memory/CLOSED_THREADS.md` — 33 items through Run 49.*
