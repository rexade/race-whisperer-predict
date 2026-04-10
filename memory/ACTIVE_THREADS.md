# Active Threads

Threads represent open lines of investigation or improvement that span multiple runs.

## Two-lane structure — active now

These lanes run in parallel. Mutation lane MUST complete before any new scoring changes.
The research lane feeds the next mutation — it does not produce code changes itself.

---

## LANE 1 — EVALUATE (MUTATE run)

### Evaluate Run 46 weight rebalance — compare vs baseline
Run 46 changed: form weight 0.5→0.8, FORM_SCALE_S 0.30→0.40, FORM_MAX_RECENT_RACES 8→5, recency weighting linear→exponential (2^n). Also: horseWinPct 0.4→0.2, earningsPerStart 0.2→0.1, consistencyFactor 0.3→0.5.
**Baseline:** Rank MAE 5.289, win% 30.6%, top-3% 52.5% (49 races, 17 dates).
**Goal:** lower Rank MAE, raise win% without picking false favorites.
**Action:** MAEPanel is now visible in the Cache drawer (Run 47). Run the MAE evaluator on at least the same date range, record actual numbers.
- If improved → update `accuracy` in status.json with new measurements, label "v2 weights", keep changes.
- If worse → revert DEFAULT_WEIGHTS to v1 in `modernKm/types.ts`, revert constants in `normalizationConstants.ts`, document in failures.md what did not work and why.
**Hard rule:** No new weight changes until this evaluation is complete and recorded.

---

## LANE 2 — RESEARCH ✓ DONE (Run 49)

### gallopCount wiring gap — confirmed production bug
**Done.** Full data-flow trace from `horseProcessing.ts` → `HorseRawKmTime` → `confidenceFlags.ts` completed.

**Finding:** `gallopCount` and `disqualificationCount` are in the `HorseRawKmTime` interface (`kmTimeTypes.ts:45-47`) and read by `confidenceFlags.ts:128`, but **`horseProcessing.ts` never sets them**. The `gallopRisk` confidence flag is always `false` in production. Unit tests pass because they inject `gallopCount` manually — the wiring gap is invisible to tests.

**Secondary finding:** `calculateGallopReliabilityPenalty` (`adjustmentCalculators.ts:173`) is dead code. Run 22 noted it as "wired into pipeline" but it is not — `modernKm/index.ts:156` uses `calculateGallopRiskAdjustment` (career rate) instead.

---

## NEXT MUTATE — Lane 3 U1 (dark foundation) or H1 (gallop-to-form)

### [x] BUG: gallopCount never populated in horseProcessing.ts — FIXED (Run 49/MUTATE)
`gallopCount` and `disqualificationCount` now computed from last-10 starts in `processHorseKmTimes`. 5 new tests pass. `gallopRisk` confidence chip now receives real data.

Unblocked by this fix:
1. "Gallop ×N" chip fires correctly in production UI
2. H1 — inject galloped race dates into form calculator as place=15 penalty
3. Future: swap `calculateGallopRiskAdjustment` (career rate) for `calculateGallopReliabilityPenalty` (count-based) in `modernKm/index.ts`

---

## LANE 3 — UI (scoring-neutral, runs independently)

UI changes do not touch scoring. Can run in any mutate slot where LANE 1 is blocked or complete.
Do one step per run. Do not mix with logic changes.

### U1 — Dark foundation (FIRST)
**Files:** `src/index.css` (dark mode token block), `src/App.tsx` (ThemeProvider `defaultTheme`)
**What:** Replace dark mode CSS variables with Pi Pulse palette. Set `defaultTheme="dark"`.
**Reference:** Read `/home/admin/lab/src/pi-pulse/src/index.css` for exact values before editing.
Key tokens to set in `.dark {}`:
- `--background: #080808`, `--card: #0f0f0f`, `--popover: #0f0f0f`
- `--border: rgba(255,255,255,0.07)`, `--input: rgba(255,255,255,0.07)`
- `--foreground: #f1f5f9`, `--muted-foreground: #475569`
- `--primary: #22d3ee`, `--primary-foreground: #080808`
- `--accent: #22d3ee`, `--accent-foreground: #080808`
- `--ring: #22d3ee`
**Done when:** App opens dark by default, background is near-black, buttons are cyan.

### U2 — Surface polish (after U1)
Audit the main panels (V75Analyzer header, tabs, WeightManager, MAEPanel) for lingering blue tints or white backgrounds leaking through. Patch at the component level where tokens aren't enough.

### U3 — Accent propagation (after U2)
Find any hardcoded ATG blue (`214` hsl or `#1a56db` etc) in component files. Replace with `hsl(var(--primary))` or `hsl(var(--accent))`.

---

## Open — lower priority (implement after gallopCount fix + LANE 1 evaluation)

### H1 — Galloped races invisible to form calculator (from Run 48)
A horse that galloped last race has that race absent from `recentRaces`. No form penalty fires.
Requires: return `gallopDates` (array of dates of galloped/DQ races) from `horseProcessing.ts`, then inject as `{ place: 15, date }` into `recentRaces` in `horseNormalizationProcessor.ts`.
Prerequisite: gallopCount fix above (same file, same pass possible).

### H2 — Single best time bias (from Run 48)
`horseProcessing.ts:214` always takes `processedTimes[0]` (fastest single time).
Fix: use average of top-2 when ≥2 times available.
Expected: reduces false-favorite rate for boom-or-bust horses.

### H3 — Field-size-blind form (from Run 48)
`calculateFormAdjustment` uses absolute bands (1st/2nd/3rd/etc) regardless of field size.
Fix: percentile-based bands. 6th in 7 ≠ 6th in 16.

### H4 — Layoff threshold miscalibrated (from Run 48)
`LAYOFF_THRESHOLD_DAYS = 21` misses peak-season rest intervals of 10–14 days.
Fix: reduce to 14d.

### MAE-driven weight presets
Use accumulated MAE data to surface tuning suggestions in WeightManager. Requires more MAE data to be useful; consider after more evaluations are done.

## Closed
*Archived to `memory/CLOSED_THREADS.md` — 33 items through Run 49.*
