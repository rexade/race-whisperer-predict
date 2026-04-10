# Closed Threads — Race Whisperer Predict

Archive of completed work. Not loaded during runs.

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
- [x] **Clean console pollution in `raceDataValidator.ts` (17 calls)** — done (Run 21). All 17 replaced. tsc clean, 71/71 pass.
- [x] **Gallop reliability factor** — done (Run 22). `calculateGallopReliabilityPenalty` ported from v85 reliability.py; wired in as `calculateGallopRiskAdjustment` in pipeline; 10 new tests; 81/81 pass.
- [x] **Per-horse confidence and sanity flags** — done (Run 23). `computeConfidenceFlags()` in `confidenceFlags.ts`; 5 flags (noKmTime, lowSampleSize, noDriverStats, gallopRisk, staleForm); wired in `horseResultBuilder.ts`; rendered as `ConfidenceFlagStrip` in `CompactHorseRow.tsx` with icon + tooltip chips; 25 new tests; 106/106 pass.
- [x] **MAE infrastructure** — done (Run 32). Fixed `predictedTime` storage bug; `RaceMAEResult` type; `raceMAEService.ts` with `fetchAndComputeMAEForRace` + `getAggregateMAEStats`; `MAEPanel.tsx` with per-race compute buttons + aggregate badge; wired into `V75Analyzer`; cleaned lone `console.error` in `raceResultProcessor.ts`; 10 new tests; 116/116 pass.
- [x] **Multi-dimensional score display** — done (Run 33). `computeReliabilityScore()` in `confidenceFlags.ts` (1–5 from timeSource/uncertain/historySource/confidenceMultiplier/flags); `ReliabilityDot` component rendered next to "Pred" label in `CompactHorseRow.tsx`; 11 new tests; 127/127 pass.
- [x] **Clean console pollution in `v75DataConsistencyValidator.ts` (21 calls)** — done (Run 34). tsc clean, 127/127 pass.
- [x] **Missing `await` in `raceMAEService.ts`** — fixed (Run 36). tsc clean, 127/127 pass.
- [x] **MAE UI prominence — surface MAEPanel + header badge** — done (Run 47). tsc clean, 127/127 pass.
- [x] **Baseline investigation hypotheses** — done (Run 48). 5 hypotheses written to `memory/decisions.md`.
- [x] **gallopCount wiring gap investigation** — done (Run 49). Confirmed production bug: `gallopCount` never populated → `gallopRisk` flag always false.
