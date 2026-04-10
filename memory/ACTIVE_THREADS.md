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

## LANE 2 — RESEARCH (RESEARCH run)

### Investigate baseline improvement opportunities
**Do not mutate any scoring code in this thread.** Output is hypotheses only.
**Baseline:** Rank MAE 5.289, win% 30.6%, top-3% 52.5% over 49 races / 17 dates.
The core question: **What repeated prediction mistake is not explained by the current weights?**

Investigate by reading source code, cached race data, and MAE results already stored:
- Where do rank errors cluster? By race type (auto vs volt)? By distance band? By field size?
- Is the model consistently good at rank 1 but random at ranks 4–8? Or does it fail at specific race shapes?
- Which factors most often push a horse to rank 1 when it finishes 5th or worse? (false favorites)
- Does form help more in auto starts than volt? Does post-position dominate in volt fields?
- Are there horses where gallopRisk is 0 but they galloped — data gaps?
- Does driver weight correlate with actual winner in the logged MAE data, or is it noise?

**Output must be exactly 3–5 concrete hypotheses, ranked by estimated impact, in this format:**
```
H1 [high/med/low impact]: [claim]. Evidence: [what you saw]. Proposed test: [specific weight/constant change to try].
```
Example of acceptable output:
`H1 [high]: form hurts volt races because volt km-times reflect starting position more than current fitness. Evidence: [cite races/data]. Proposed test: form weight 0.8 for auto, 0.3 for volt.`

Do NOT write vague suggestions like "improve form signal." Write a falsifiable hypothesis with a proposed experiment.
Write findings to `memory/decisions.md` under a new heading `## Research: baseline investigation — Run [N]`.

## Open — low priority

### MAE-driven weight presets
Use accumulated MAE data to surface tuning suggestions in WeightManager. Requires more MAE data to be useful; consider after more evaluations are done.

## Closed
- [x] **Understand scoring** — done (Run 1). Pipeline fully mapped, see SEED.md.
- [x] **Console pollution in equipment calculators** — fixed (Run 1).
- [x] **Assess test coverage** — done (Run 2).
- [x] **Write normalization unit tests** — done (Run 2). 52 tests covering `performanceCalculators`, `adjustmentCalculators`, `driverCalculators`.
- [x] **Fix jsdom ESM incompatibility** — fixed (Run 3). 59 tests pass.
- [x] **ATG API call in kmTimeProcessor test** — fixed (Run 4). Zero real network calls in test suite.
- [x] **Mobile UX audit** — done (Run 5).
- [x] **Fix sticky tab offset** — fixed (Run 6).
- [x] **Delete dead component `V75HorseRow.tsx`** — done (Run 6).
- [x] **WeightManager mobile layout overflow** — fixed (Run 7).
- [x] **Audit dead post-race analysis cluster** — done (Run 8). 15 files deleted.
- [x] **Evaluate v85-briefing-engine features for porting** — done (Run 9).
- [x] **Clean console pollution in `horseProcessing.ts`** — done (Run 10).
- [x] **Thread `postPosition` through `ProcessedKmTime`** — done (Run 11).
- [x] **Clean `horseDebugger.ts` console pollution** — done (Run 13).
- [x] **Delete stale `ModernKmNormalizedResult` from `kmTimeTypes.ts`** — done (Run 13).
- [x] **Remove `horseForm` dead property** — done (Run 13).
- [x] **Port trip dependency as volte-penalty modifier** — done (Run 14). 12 new tests, 71/71 pass.
- [x] **Clean console pollution in `kmTimeProcessor.ts`** — done (Run 15).
- [x] **Clean console pollution in `atgHistoricalApi.ts`** — done (Run 16).
- [x] **Delete `src/utils/raceAnalysis.ts` + `src/services/timeProcessor.ts`** — done (Run 18). Dead code confirmed Run 17.
- [x] **Clean console pollution in `raceAnalysisCache.ts`** — done (Run 18). 31 calls replaced.
- [x] **Delete dead `fetchEnhancedRaceData` from `enhancedAtgApi.ts`** — done (Run 19). ~328 lines deleted.
- [x] **Clean console pollution in `raceDataValidator.ts` (17 calls)** — done (Run 21). All 17 replaced. tsc clean, 71/71 tests pass.
- [x] **Gallop reliability factor** — done (Run 22). `calculateGallopReliabilityPenalty` ported from v85 reliability.py; wired into pipeline with weight 0.8; 10 new tests; 81/81 pass.
- [x] **Per-horse confidence and sanity flags** — done (Run 23). `computeConfidenceFlags()` in `confidenceFlags.ts`; 5 flags (noKmTime, lowSampleSize, noDriverStats, gallopRisk, staleForm); wired in `horseResultBuilder.ts`; rendered as `ConfidenceFlagStrip` in `CompactHorseRow.tsx` with icon + tooltip chips; 25 new tests; 106/106 pass.
- [x] **MAE infrastructure** — done (Run 32). Fixed `predictedTime` storage bug; `RaceMAEResult` type; `raceMAEService.ts` with `fetchAndComputeMAEForRace` + `getAggregateMAEStats`; `MAEPanel.tsx` with per-race compute buttons + aggregate badge; wired into `V75Analyzer`; cleaned lone `console.error` in `raceResultProcessor.ts`; 10 new tests; 116/116 pass.
- [x] **Multi-dimensional score display** — done (Run 33). `computeReliabilityScore()` in `confidenceFlags.ts` (1–5 from timeSource/uncertain/historySource/confidenceMultiplier/flags); `ReliabilityDot` component rendered next to "Pred" label in `CompactHorseRow.tsx`; 11 new tests; 127/127 pass.
- [x] **Clean console pollution in `v75DataConsistencyValidator.ts` (21 calls)** — done (Run 34). All `console.log` → `log.debug`, all `console.error` → `log.error`. tsc clean, 127/127 pass.
- [x] **Missing `await` in `raceMAEService.ts`** — fixed (Run 36). `getRaceAnalysis` is `static async`; missing `await` made `stored` always a truthy Promise, breaking MAE compute. Also fixed 3 stale `calculateFormAdjustment` tests whose expected values referenced old `FORM_SCALE_S = 0.05` (current value: 0.30). tsc clean, 127/127 pass.
- [x] **MAE UI prominence — surface MAEPanel + header badge** — done (Run 47). MAEPanel now mounts below V75CacheManager when cache drawer is open. Compact `±X.X` accuracy badge in header toolbar (lazy-init from localStorage, refreshes on drawer close). `log.warn` → `log.debug` for "NO HISTORICAL DATA" in `kmTimeProcessor.ts`. tsc clean, 127/127 pass.
