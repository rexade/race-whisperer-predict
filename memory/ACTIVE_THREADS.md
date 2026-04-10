# Active Threads

Threads represent open lines of investigation or improvement that span multiple runs.

## CRITICAL — fix immediately

### Missing `await` in `raceMAEService.ts` — MAE compute is broken in production
**File:** `src/services/raceMAEService.ts:19`
**Bug:** `const stored = RaceAnalysisCache.getRaceAnalysis(raceId);` — missing `await`.
`getRaceAnalysis` is declared `static async` and returns `Promise<RaceAnalysisData | null>`.
Without `await`, `stored` is a Promise object (always truthy). The `if (!stored)` guard never fires.
`stored.horses` at line 43 is `undefined` → `for (const predicted of stored.horses)` throws `TypeError: undefined is not iterable`.
**Why tests pass:** The mock at `raceMAEService.test.ts:25` returns synchronously (`_analysisStore[raceId] ?? null`), so tests see actual data, not a Promise.
**Fix:** Add `await` to line 19. One-line change. Existing null-guard already correct.
```
const stored = await RaceAnalysisCache.getRaceAnalysis(raceId);
```
Verify: `tsc --noEmit`, then `vitest run` (127/127 must still pass).

## Open — low priority

### MAE UI prominence — aggregate badge hidden behind Cache drawer
MAEPanel only mounts when `showCacheManager` is true (`V75Analyzer.tsx:265`). Users who haven't opened the Cache drawer never see the model accuracy data. Consider: read `getAggregateMAEStats()` at the top level of `V75Analyzer` and render a compact badge in the header toolbar when data exists.

### Stderr noise in kmTimeProcessor tests
`log.warn(` at `kmTimeProcessor.ts:113` ("NO HISTORICAL DATA") is not gated behind IS_DEBUG. In tests, the mock returns null for historical data, triggering this warn on every run. The `log.warn` function always calls `console.warn` regardless of debug mode. Fix: gate this specific call with `log.debug` instead, since "no data" is expected and handled gracefully by the fallback chain — the zero-time result is already the correct output, the warn just adds noise.

### MAE-driven weight presets
Use accumulated MAE data to surface tuning suggestions in WeightManager. Requires more MAE data to be useful; consider after the async bug is fixed so the feature actually collects data.

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
