# Active Threads

Threads represent open lines of investigation or improvement that span multiple runs.

## Two-lane structure — active now

These lanes run in parallel. Mutation lane MUST complete before any new scoring changes.
The research lane feeds the next mutation — it does not produce code changes itself.

---

## LANE 1 — EVALUATE (MUTATE run, user-gated)

### Evaluate Run 46 weight rebalance — compare vs baseline
Run 46 changed: form weight 0.5→0.8, FORM_SCALE_S 0.30→0.40, FORM_MAX_RECENT_RACES 8→5, recency weighting linear→exponential (2^n). Also: horseWinPct 0.4→0.2, earningsPerStart 0.2→0.1, consistencyFactor 0.3→0.5.
**Baseline:** Rank MAE 5.289, win% 30.6%, top-3% 52.5% (49 races, 17 dates).
**Goal:** lower Rank MAE, raise win% without picking false favorites.
**Action:** MAEPanel is visible in the Cache drawer. Run the MAE evaluator on at least the same date range, record actual numbers.
- If improved → update `accuracy` in status.json with new measurements, label "v2 weights", keep changes.
- If worse → revert DEFAULT_WEIGHTS to v1 in `modernKm/types.ts`, revert constants in `normalizationConstants.ts`, document in failures.md what did not work and why.
**Hard rule:** No new weight changes until this evaluation is complete and recorded.

---

## LANE 2 — RESEARCH ✓ DONE (Run 51)

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

## Open — lower priority (after LANE 1 evaluation)

### [x] H2 — Single best time bias — DONE (Run 53)
`horseProcessing.ts:208` `processedTimes[0]` → average of top-2 when ≥2 valid times available.
`bestRecordTime` still holds the actual fastest individual record.
`validationStats.best3TimesUsed` updated to reflect actual count (1 or 2).
4 new tests added. tsc clean, 143 tests pass.

### H3 — Field-size-blind form
`calculateFormAdjustment` uses absolute bands (1st/2nd/3rd/etc) regardless of field size.
Fix: percentile-based bands. 6th in 7 ≠ 6th in 16.

### H4 — Layoff threshold miscalibrated
`LAYOFF_THRESHOLD_DAYS = 21` misses peak-season rest intervals of 10–14 days.
Fix: reduce to 14d.

### MAE-driven weight presets
Use accumulated MAE data to surface tuning suggestions in WeightManager. Requires more MAE data to be useful; consider after more evaluations are done.

## Closed
*Archived to `memory/CLOSED_THREADS.md` — 33 items through Run 49.*
