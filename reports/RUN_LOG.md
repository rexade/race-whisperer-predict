# Run Log

Each entry = one Pi Pulse session on this project.

Format:
```
## Run N — YYYY-MM-DD
**Goal:** what was attempted
**Done:** what actually changed
**Result:** pass / fail / partial
**Next:** recommended follow-up
```

---

## Run 0 — 2026-04-08
**Goal:** Bootstrap project management scaffolding
**Done:** Created `memory/SEED.md`, `memory/FEEDBACK.md`, `memory/ACTIVE_THREADS.md`, `reports/RUN_LOG.md`, `status.json`
**Result:** pass
**Next:** Run 1 — read `useV75Analysis` and `modernKm/` index, document scoring flow in SEED.md

## Run 1 — 2026-04-08
**Goal:** Read `useV75Analysis` + full `modernKm/` pipeline, document scoring, identify weakness
**Done:**
- Mapped entire normalization pipeline (13 adjustment factors, all documented in SEED.md)
- Documented all DEFAULT_WEIGHTS with their rationale
- Found: `console.log`/`console.error` calls with emoji firing on **every horse** in production (bypassing `IS_DEBUG` gate)
- Fixed: replaced all raw console calls in `robustEquipmentCalculators.ts` and `equipmentCalculators.ts` with `log.debug`/`log.warn`
- Updated ACTIVE_THREADS: closed 2 threads, opened 2 new ones
**Result:** pass
**Next:** Run 2 — write unit tests for `performanceCalculators.ts` and `adjustmentCalculators.ts` (zero coverage today)

## Run 2 — 2026-04-08 — MUTATE

**Goal:** Write normalization pipeline unit tests — highest-priority open thread. Zero test coverage existed for the core scoring calculators.
**Done:**
- Created `src/services/modernKm/__tests__/normalizationPipeline.test.ts` (52 tests, all passing)
- Covers all exported functions across 3 modules: `performanceCalculators`, `adjustmentCalculators`, `driverCalculators`
- Tests verify: baselines, bonuses/penalties, saturation bounds, fallback paths, edge cases (NaN, empty, missing), symmetry, and recency weighting
- Added `// @vitest-environment node` to bypass broken jsdom ESM incompatibility (pre-existing issue, not introduced here; affects all test files including the original `kmTimeProcessor.test.ts`)
**Result:** pass — 52/52 tests green
**Next:** Fix the jsdom ESM incompatibility so `kmTimeProcessor.test.ts` also runs (currently broken for all test files using jsdom environment)

## Run 3 — 2026-04-08 — MUTATE

**Goal:** Fix jsdom ESM incompatibility — highest-priority open thread. `kmTimeProcessor.test.ts` was crashing the test worker due to `html-encoding-sniffer` attempting `require()` of an ESM module when loaded in jsdom environment.
**Done:**
- Changed `vitest.config.ts` global `environment` from `'jsdom'` to `'node'` (one-line change)
- All 59 tests now pass: 52 normalization pipeline tests + 7 kmTimeProcessor tests
- No test in the project uses DOM APIs; `node` is the correct global default
- Side observation: `kmTimeProcessor.test.ts` makes a real ATG API call in the "no historical data" test (fails gracefully with Bad Request); queued as new open thread to mock this
**Result:** pass — 59/59 tests green, 0 errors
**Next:** Mock `fetchHorseHistoricalData` in `kmTimeProcessor.test.ts` to eliminate real ATG API traffic from the test suite

<!-- stdout from run 4 2026-04-08 22:06 -->
Done. Here's what happened in this run:

**Created:** `src/services/modernKm/__tests__/normalizationPipeline.test.ts`

**52 tests, 52 passing** covering the full normalization pipeline:

| Module | Functions covered | Tests |
|---|---|---|
| `performanceCalculators` | `calculateStartPointsAdjustment`, `calculateStartPointsAdjustmentFieldAware`, `calculatePlacePercentageAdjustment`, `calculateHorseWinPercentageAdjustment`, `calculateEarningsPerStartAdjustment`, `calculateFormAdjustment` | 27 |
| `adjustmentCalculators` | `calculateDistanceAdjustment`, `calculateRaceDistanceAdjustment`, `calculateTrackFamiliarityAdjustment`, `calculateVolteStartDistancePenalty` | 14 |
| `driverCalculators` | `calculateDriverAdjustment` | 11 |

Tests cover: baseline neutrality, bonus/penalty direction, saturation bounds, fallback paths, edge cases (NaN, empty, missing data), symmetry properties, and recency weighting in the form calculator.

**Side note discovered:** The existing `kmTimeProcessor.test.ts` is also broken (pre-existing) due to a jsdom ESM incompatibility with `html-encoding-sniffer`. The new tests work around this with `// @vitest-environment node`. That fix is queued as the next open thread.


<!-- stdout from run 5 2026-04-08 22:41 -->
**Run 3 complete.**

**What changed:** `vitest.config.ts:9` — `environment: 'jsdom'` → `environment: 'node'`. One line.

**Result:** 59/59 tests pass, 0 errors. `kmTimeProcessor.test.ts` now runs cleanly alongside the 52 normalization tests.

**Root cause:** The global `jsdom` environment loaded `html-encoding-sniffer`, which CJS-requires an ESM module (`@exodus/bytes/encoding-lite.js`). No test in this project uses DOM APIs, so `node` is the correct default.

**Side observation flagged:** One test in `kmTimeProcessor.test.ts` calls the real ATG API (fake ID → 400, passes gracefully). That's queued as the next open thread — add a `vi.mock` for `fetchHorseHistoricalData` to keep tests fully offline.


<!-- stdout from run 6 2026-04-08 23:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 2am (Europe/Stockholm)


<!-- stdout from run 6 2026-04-09 00:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 2am (Europe/Stockholm)


<!-- stdout from run 6 2026-04-09 01:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 2am (Europe/Stockholm)


## Run 4 — 2026-04-09 — MUTATE

**Goal:** Mock ATG API functions in `kmTimeProcessor.test.ts` — highest-priority open thread. The "no historical data" test was hitting the real ATG.se API on every test run (fake raceId → 400, gracefully handled, but still a real network call).
**Done:**
- Added `vi.mock('../atgHistoricalApi', ...)` with `importActual` — keeps `processHistoricalRecords` and all pure logic real; mocks only `fetchHorseHistoricalData` → returns null
- Added `vi.mock('../utils/extendedFallbackHandler', ...)` with `importActual` — keeps `extractRecordsFromExtended` etc. real; mocks only `fetchExtendedRaceData` → returns null
- File: `src/services/__tests__/kmTimeProcessor.test.ts`
**Result:** pass — 59/59 tests green, 0 network calls in test suite
**Next:** Mobile UX audit of V75Analyzer.tsx — check layout on small screens (last open thread)

<!-- stdout from run 6 2026-04-09 02:00 -->
Done. Here's the summary:

**Thread closed:** ATG API call in `kmTimeProcessor.test.ts`

**What changed:** `src/services/__tests__/kmTimeProcessor.test.ts` — added two `vi.mock` blocks at the top:
- `vi.mock('../atgHistoricalApi', importActual)` → mocks only `fetchHorseHistoricalData` to return `null`; keeps `processHistoricalRecords` and all other pure logic real
- `vi.mock('../utils/extendedFallbackHandler', importActual)` → mocks only `fetchExtendedRaceData` to return `null`

**Result:** 59/59 tests pass, zero real network calls. The test output confirms the mock path: `fetchHorseHistoricalData` → null → stats fallback → empty → `fetchExtendedRaceData` → null → "NO HISTORICAL DATA" → zero-time entry pushed (as expected by the test).

**Next open thread:** Mobile UX audit of `V75Analyzer.tsx`.

---

## Run 5 — 2026-04-09 — RESEARCH

**Investigated:** Full mobile UX audit — `V75Analyzer.tsx`, `V75Results.tsx`, `CompactHorseRow.tsx`, `CompactV75ResultsTable.tsx`, `WeightManager.tsx`, `V75TimeCalculationDebug.tsx`, `V75DatePicker.tsx`, `AnalyzerLayout.tsx`, `use-mobile.tsx`. Also inspected dead code via import tracing.

**Key finding:** Three distinct mobile issues found, plus a dead-code cluster that's larger than expected:

1. **Sticky tab strip offset mismatch** (`V75Results.tsx:48`): `sticky top-[52px]` but toolbar `h-14` = 56px + 1px border-bottom = 57px total. On scroll, the tab bar sticks 4-5px *inside* the toolbar — its top is hidden under the toolbar. Since toolbar is `z-30` and tabs `z-10`, the toolbar paints over the tabs' top slice. Visually: tab content is clipped at the seam. Easy 1-line fix: `top-[57px]`.

2. **WeightManager action button row overflows on mobile** (`WeightManager.tsx:320-375`): `flex justify-between items-start gap-4` places a text paragraph left + button column right, no flex-wrap. The right side has a second row of 3 full-label buttons ("Save as Default", "Export", "Import") at ~125px each ≈ 375px combined — exactly filling a 375px screen with no room for the left text. On 360px this overflows. Fix: wrap buttons into a `flex-wrap` row or restructure as full-width column on mobile.

3. **WeightManager factor range badges overflow on mobile** (`WeightManager.tsx:406-430`): Each factor card has `flex justify-between items-start` with input + Badge (showing e.g. "0.0 to +1.0s per position") on the right. The badge text is 20-25 chars wide with no truncation, crushing the label column on small screens.

4. **Dead code — 5+ unreferenced component files**: `V75HorseRow.tsx` (240-line old table implementation, replaced by `CompactHorseRow.tsx`), `V75RaceHeader.tsx`, `V75RaceOverview.tsx`, `V75DataQuality.tsx`, `V75Input.tsx` — zero import references anywhere in the codebase. Additionally the entire post-race analysis cluster (`V75PostRaceAnalysis.tsx` + `postRace/` subdir with 5 files + `useV75PostRaceAnalysis.ts` + `v75PredictionComparator.ts`) is orphaned from the render tree.

**Implication:**
- Toolbar/tab seam bug is visible to every mobile user who scrolls results (all users).
- WeightManager overflow breaks power-user settings on mobile.
- Dead `V75HorseRow.tsx` is ~240 lines of unmaintained code that could confuse future changes (e.g., its `colSpan={14}` on the debug row is wrong for current column count).

**Suggested next move:**
- **Mutate (priority 1):** Fix sticky offset in `V75Results.tsx:48`: change `top-[52px]` → `top-[57px]`.
- **Mutate (priority 2):** Delete `src/components/v75/components/V75HorseRow.tsx` (dead code, no imports).
- **Mutate (priority 3):** Restructure WeightManager action button area to stack full-width on mobile: add `flex-col sm:flex-row` or move buttons above/below the description, and hide the typicalRange badge on mobile or truncate it.


<!-- stdout from run 7 2026-04-09 03:00 -->
Research complete. Here's what I found:

---

## Mobile UX Audit — Results

The main component flow is already reasonably mobile-aware (`CompactHorseRow` with tap-to-expand, responsive tab grid, truncated date format). Three concrete bugs were found:

### Bug 1: Sticky tab strip offset (affects every user who scrolls)
**`V75Results.tsx:48`** — `sticky top-[52px]` but the toolbar is `h-14` (56px) + 1px `border-bottom` = 57px. On scroll, the race tab strip sticks 5px inside the toolbar, with its top sliced off under the toolbar. **Fix: `top-[57px]`.**

### Bug 2: WeightManager buttons overflow on mobile
**`WeightManager.tsx:320-375`** — `flex justify-between items-start` puts a text paragraph and a button block side-by-side with no wrap. The button block includes a row of three full-label buttons ("Save as Default", "Export", "Import") ≈ 375px combined — exactly filling a 375px screen before the text paragraph even gets space. Overflows on 360px devices. Also, factor range badges ("0.0 to +1.0s per position") in each factor card have no truncation and crush the label column.

### Dead code — larger than expected
`V75HorseRow.tsx` (240 lines, replaced by `CompactHorseRow`, zero import references) is the immediate cleanup target. Separately, an entire post-race analysis feature cluster (8+ files in `postRace/`) and 4 other standalone components (`V75RaceHeader`, `V75RaceOverview`, `V75DataQuality`, `V75Input`) are all orphaned from the render tree.

**Recommended mutate order:**
1. `V75Results.tsx:48` — change `top-[52px]` → `top-[57px]` (1-line, highest user impact)
2. Delete `V75HorseRow.tsx` (safe, no imports)
3. Fix WeightManager button layout for mobile

---

## Run 6 — 2026-04-09 — MUTATE

**Goal:** Fix sticky tab offset (top 2 open threads: tab seam bug + dead file deletion). Highest user-impact item: tab strip clipped under toolbar on mobile scroll.
**Done:**
- `src/components/v75/components/V75Results.tsx:48` — changed `top-[52px]` → `top-[57px]` (toolbar is `h-14` = 56px + 1px border-bottom = 57px total)
- Deleted `src/components/v75/components/V75HorseRow.tsx` — 240-line dead component, zero import references in source; replaced long ago by `CompactHorseRow.tsx`
- 59/59 tests still pass
**Result:** pass
**Next:** Fix WeightManager mobile layout overflow — `flex justify-between` without wrap on 375px screen with 3 full-label buttons overflows; fix: restructure action buttons to `flex-col sm:flex-row` or full-width column on mobile


<!-- stdout from run 8 2026-04-09 04:00 -->
Run 6 complete.

**What changed:**

1. **`V75Results.tsx:48`** — `top-[52px]` → `top-[57px]`. The toolbar is `h-14` (56px) + 1px `border-bottom` = 57px total. The race tab strip was sticking 5px *inside* the toolbar on scroll, with its top slice hidden behind the toolbar's `z-30`. Now it aligns flush below the toolbar edge.

2. **Deleted `src/components/v75/components/V75HorseRow.tsx`** — 240 lines of dead code. Zero import references in the source tree; it was replaced by `CompactHorseRow.tsx`. Gone.

**Test suite:** 59/59 pass, no regressions.

**Next:** `WeightManager.tsx` mobile layout overflow — 3 full-label buttons in a non-wrapping `flex justify-between` row overflow 375px screens.


## Run 7 — 2026-04-09 — MUTATE

**Goal:** Fix WeightManager mobile layout overflow — highest-priority open thread. Two bugs: action header row overflows on 375px, and per-factor range badges crush label column on small screens.
**Done:**
- `src/components/WeightManager.tsx:320` — changed outer action container from `flex justify-between items-start gap-4` to `flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4`. On mobile, description text now stacks above the button block instead of fighting for horizontal space. Added `sm:flex-1` to description and `shrink-0` to button column for clean desktop layout.
- `src/components/WeightManager.tsx:430` — added `hidden sm:inline-flex` to the range Badge in each factor card. The badge ("0.0 to +1.0s per position" etc.) was unconstrained width and crushed the label column on small screens. Now hidden on mobile, visible from 640px up.
- 59/59 tests still pass, no regressions.
**Result:** pass
**Next:** Audit dead post-race analysis cluster — confirm `V75PostRaceAnalysis.tsx` + `postRace/` subdir are truly orphaned and safe to delete. 9 files, ~500+ lines of dead code.

<!-- stdout from run 9 2026-04-09 05:00 -->
**Run 7 complete.** Two mobile fixes in `WeightManager.tsx`:

1. **Action header (line 320):** `flex justify-between items-start gap-4` → `flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4`. On mobile (<640px), the description text now stacks above the button block instead of competing for horizontal space. The button block has `shrink-0` so it won't compress on desktop.

2. **Range badges (line 430):** Added `hidden sm:inline-flex`. The `"0.0 to +1.0s per position"` badges were unconstrained-width and crushed the label column on small screens. They now appear only from 640px up; on mobile, the input field alone is shown.

**59/59 tests pass.** One open thread remains: audit the dead post-race analysis cluster (~9 files, 500+ lines of orphaned code).


## Run 8 — 2026-04-09 — MUTATE

**Goal:** Audit and delete dead post-race analysis cluster — highest-priority open thread. 9+ files orphaned from render tree since audit in Run 5.
**Done:**
- Confirmed all 15 files are truly orphaned: internal imports only reference each other; nothing in the live render tree imports any of them
- Kept alive: `postRaceAnalysisTypes.ts` (used by `kmtidAtgx.ts`, `parseKmtidPayload.ts`, `useKmtidByHorse.ts`, `raceResultTypes.ts`), `raceResultTypes.ts` (widely used), `raceReanalysisService.ts` (used by `useV75ResultsProcessor.ts`)
- Deleted 11 post-race cluster files: `V75PostRaceAnalysis.tsx`, `postRace/V75PostRaceDetails.tsx`, `postRace/V75PostRaceHeader.tsx`, `postRace/V75PostRaceInsights.tsx`, `postRace/V75PostRaceOverview.tsx`, `postRace/KmtidAnalyticsCard.tsx`, `postRace/PerformanceGraph.tsx`, `hooks/useV75PostRaceAnalysis.ts`, `services/v75PredictionComparator.ts`, `services/v75ResultsFetcher.ts`, `utils/postRaceUtils.ts`
- Deleted 4 standalone dead components: `V75RaceHeader.tsx`, `V75DataQuality.tsx`, `V75Input.tsx`, `V75RaceOverview.tsx`
- Removed now-empty `postRace/` directory
- `tsc --noEmit`: zero errors. 59/59 tests pass.
**Result:** pass
**Next:** No open threads remain. Candidates for next run: investigate scoring quality (compare predicted vs actual win rates if race results data is available), or explore the v85-briefing-engine's pace model / lead chance features as candidates for porting to the TypeScript scoring pipeline.

## Run 9 — 2026-04-09 — RESEARCH

**Investigated:** v85-briefing-engine `pace.py`, `lead.py`, `trip.py`, `start.py` vs TypeScript pipeline data flow — `ProcessedKmTime`, `ModernNormalizationFactors`, `horseProcessing.ts`, `horseNormalizationProcessor.ts`, `atgHistoricalApi.ts`. Also surveyed console pollution across the full `src/` tree.

**Key finding:** None of the three v85 features (pace model, lead chance, trip dependency) are directly portable. All three depend on historical `postPosition` per race, which is **dropped from `ProcessedKmTime`** during horse processing — `startMethod` and `finishOrder` are stored, but `postPosition` is not. Without this field, only prior-only lead chance estimates are possible, and those duplicate information already captured by `postPositionCalculator.ts`. Separately: 364 raw `console.log/warn/error` calls across 25 source files fire unconditionally in production. `horseProcessing.ts` alone has 40; Run 1 only fixed 2 files.

**Implication:**
- The v85 thread is *blocked by data plumbing*: `ProcessedKmTime` must gain a `postPosition?: number` field and it must be threaded through `horseNormalizationProcessor.ts` before any lead/trip logic can be written. The pace model additionally needs race-level context passed alongside `fieldStartPoints`.
- Console pollution is a live regression: a 7-leg V75 race with ~10 horses/leg triggers ~400–700 console calls. This degrades browser devtools for anyone debugging the app, and was only partially addressed in Run 1.
- `horseForm` is a dead property: set in `horseNormalizationProcessor.ts` (lines 159, 212) and `raceReanalysisService.ts` (line 41) but not present in the `ModernNormalizationFactors` interface. Silently ignored because `tsconfig.app.json` has `"strict": false`. Not a bug but is misleading dead code.

**Suggested next move:** Clean console calls in `src/services/horseProcessing.ts` (40 calls → `log.debug`/`log.warn`). This is purely mechanical, follows the exact pattern established in Run 1, and has the highest per-file impact. After that: thread `postPosition` through `ProcessedKmTime` as the prerequisite for v85 porting.

<!-- stdout from run 10 2026-04-09 06:00 -->
**Run 8 complete.**

Deleted **15 dead files** — the entire post-race analysis cluster plus 4 standalone orphaned components:

| Group | Files |
|---|---|
| Post-race cluster | `V75PostRaceAnalysis.tsx`, 6× `postRace/*`, `useV75PostRaceAnalysis.ts`, `v75PredictionComparator.ts`, `v75ResultsFetcher.ts`, `postRaceUtils.ts` |
| Standalone orphans | `V75RaceHeader.tsx`, `V75DataQuality.tsx`, `V75Input.tsx`, `V75RaceOverview.tsx` |

**Kept alive:** `postRaceAnalysisTypes.ts` (still used by kmtid services + `useKmtidByHorse`), `raceResultTypes.ts` (widely used), `raceReanalysisService.ts` (used by `useV75ResultsProcessor`). The `postRace/` directory itself is gone too.

**Result:** `tsc --noEmit` zero errors. 59/59 tests pass. No regressions.

**Next open thread:** Evaluate the v85-briefing-engine's pace model, lead chance, and trip dependency feature extractors as candidates to port into the TypeScript scoring pipeline.


<!-- stdout from run 11 2026-04-09 07:00 -->
---

## Run 9 — Research complete

**Thread investigated:** Port a scoring feature from v85-briefing-engine

**What I found:**

### v85 features are all blocked by a data plumbing gap

`pace.py`, `lead.py`, and `trip.py` all need **historical `postPosition` per race** — which lane did the horse draw in each past start? The TypeScript `ProcessedKmTime` struct stores `startMethod`, `finishOrder`, and `raceDate` but **drops `postPosition`** when converting ATG records in `horseProcessing.ts:158`. The data is fetched from ATG but immediately thrown away.

Without it:
- **Lead chance** can only use the structural prior (current post + start method) — which is essentially already captured by `postPositionCalculator.ts`. No new signal.
- **Trip dependency** (inside vs outside placement rate) needs historical postPosition split — impossible without it.
- **Pace model** additionally needs all horses' start speeds as race-level context, which the per-horse `applyModernKmNormalization` doesn't accept.

### Larger console pollution problem discovered

Run 1 fixed 2 files. The full scope is **364 raw console calls across 25 files**. `horseProcessing.ts` alone has 40. Every V75 race load (~70 horse processing cycles) fires hundreds of unconditional console calls in production. This is higher-priority maintenance.

### Three concrete actionable threads opened:

1. **Immediate mutate:** Clean `horseProcessing.ts` console calls (40 calls, same `log.debug/log.warn` pattern as Run 1)
2. **Data plumbing:** Add `postPosition` to `ProcessedKmTime` — unblocks all v85 features
3. **Feature port:** Trip dependency as volte-penalty modifier — implementable once #2 is done
4. **Dead code:** Remove `horseForm` property set in 3 places but not in the interface (silently ignored due to `"strict": false`)


## Run 10 — 2026-04-09 — MUTATE

**Goal:** Clean console pollution in `horseProcessing.ts` — highest-priority open thread. 40 raw `console.log/warn/error` calls firing unconditionally on every horse processed (every V75 race load = ~400–700 console calls in production).
**Done:**
- Added `import { log } from '@/lib/logger'` to `src/services/horseProcessing.ts`
- Replaced all 40 raw console calls: `console.log` → `log.debug`, informational `console.warn` → `log.debug`, `console.error` for invalid km time and caught exceptions → `log.warn`
- Zero raw console calls remain in the file
- 59/59 tests pass, no regressions
**Result:** pass
**Next:** Thread `postPosition` through `ProcessedKmTime` — add `postPosition?: number` to the type, populate it in `horseProcessing.ts` push block, expose it in `horseNormalizationProcessor.ts`. This unblocks all three v85 feature ports.

## Run 11 — 2026-04-09 — MUTATE

**Goal:** Thread `postPosition` through `ProcessedKmTime` — highest-priority open thread. Data plumbing prerequisite for all v85 feature ports (trip dependency, lead chance, pace model).
**Done:**
- `src/services/types/kmTimeTypes.ts` — added `postPosition?: number` to `ProcessedKmTime` interface
- `src/services/horseProcessing.ts` push block (~line 159) — added `postPosition: race.postPosition` so historical lane data is preserved instead of dropped
- `src/services/modernKm/types.ts` — extended `recentRaces` array element type from `{ place, date }` to `{ place, date, postPosition? }` in `ModernNormalizationFactors`
- `src/components/v75/utils/horseNormalizationProcessor.ts` — updated `rawTimeData` parameter type + both `recentRaces` extraction blocks (fallback and normal paths) to map `t.postPosition` into the array
- `tsc --noEmit`: zero errors. 59/59 tests pass.
**Result:** pass
**Next:** Implement trip dependency as volte-penalty modifier — compute per-horse inside/outside place rate from `recentRaces[].postPosition`, use it to scale the `volteStartDistancePenalty` weight. New calculator in `adjustmentCalculators.ts`.

<!-- stdout from run 13 2026-04-09 08:00 -->
Run 10 complete.

**What changed:** `src/services/horseProcessing.ts`

- Added `import { log } from '@/lib/logger'`
- Replaced all **40 raw console calls** with gated equivalents:
  - `console.log` → `log.debug` (fires only when `IS_DEBUG`)
  - Informational `console.warn` (no historical data, no valid times, outliers, skip reasons) → `log.debug`
  - `console.error` for actual data problems (invalid km time shape, caught processing exception) → `log.warn` (always surfaces)

A 7-leg V75 race with ~10 horses/leg was triggering ~400–700 unconditional console calls per load. All suppressed in production now, available when debugging with `IS_DEBUG`.

**59/59 tests pass.**

**Next thread:** Add `postPosition?: number` to `ProcessedKmTime` — the data plumbing prerequisite that unblocks trip dependency, lead chance, and pace model from the v85 engine.


<!-- stdout from run 14 2026-04-09 09:00 -->
Done. Here's the summary:

---

**Run 11 — `postPosition` threading complete**

Four targeted changes, all clean:

| File | Change |
|---|---|
| `src/services/types/kmTimeTypes.ts` | Added `postPosition?: number` to `ProcessedKmTime` |
| `src/services/horseProcessing.ts` | Added `postPosition: race.postPosition` to push block — field was in `ATGHistoricalRace` but dropped on every horse |
| `src/services/modernKm/types.ts` | Extended `recentRaces` element type to `{ place, date, postPosition? }` in `ModernNormalizationFactors` |
| `src/components/v75/utils/horseNormalizationProcessor.ts` | Updated parameter type + both map calls to carry `postPosition` into the `recentRaces` array |

**Result:** `tsc --noEmit` zero errors. 59/59 tests pass.

**What this unblocks:** The trip dependency modifier (next thread) can now read `recentRaces[].postPosition` to compute a per-horse inside/outside place rate and scale the `volteStartDistancePenalty` weight accordingly. No new dependencies or architectural changes needed — the data is just finally there.


## Run 12 — 2026-04-09 — RESEARCH

**Investigated:** `horseDebugger.ts` console pollution scope and loop amplification; stale duplicate `ModernKmNormalizedResult` in `kmTimeTypes.ts`; trip dependency data coverage; `horseForm` dead-property locations.

**Key finding:** `horseDebugger.ts` is the single worst remaining console pollution source and was missing from the current cleanup priority list. It has **57 raw console calls in source** but most are inside methods that loop per historical race record — `logHistoricalData` fires 1 call per record (avg 12 records/horse), `logHistoricalNormalization` fires 7 calls per record called 10-15× per horse = ~100 calls alone, `logProcessedTimes` loops similarly. With `debugAllHorses = true` (the hardcoded default), **every method fires for every horse** — estimated **~9,500 console calls per V75 race load** from this file alone. Additionally found a stale duplicate `ModernKmNormalizedResult` type in `src/services/types/kmTimeTypes.ts` (lines 42-61) with phantom fields `raceType` and `timeOfDay` that don't exist in the authoritative type in `modernKm/types.ts` — nobody imports this type from `kmTimeTypes.ts` (only `KmTime`, `ProcessedKmTime`, `HorseRawKmTime` are imported). `horseDebugger.ts` reads `adjustments.raceType` and `adjustments.timeOfDay` at lines 255-256, which are always `undefined` at runtime.

**Implication:**
- `horseDebugger.ts` must be promoted to #1 console cleanup priority above `kmTimeProcessor.ts` and `enhancedAtgApi.ts`. The loop amplification makes it ~200× worse than its static call count implies.
- The stale `ModernKmNormalizedResult` in `kmTimeTypes.ts` can be safely deleted (zero consumers) — removes the misleading phantom fields and the only interface with `raceType`/`timeOfDay`.
- Trip dependency is fully implementable: `recentRaces[].postPosition` is real ATG data for all normal records (statistics-fallback records get `postPosition: 1` as neutral). No additional data plumbing needed. Algorithm: new `calculateTripDependencyModifier(recentRaces)` in `adjustmentCalculators.ts` — filter records with defined `postPosition`, find "outside" races (`postPosition ≥ 7`), if ≥ 2 outside races compute `outsidePlaceRate` (place ≤ 3 / total outside), return multiplier `clamp(1.0 − outsidePlaceRate × 0.5, 0.6, 1.0)` — applied as scalar on `volteStartDistancePenalty` in `index.ts`. Fall back to `1.0` (no change) if fewer than 2 outside races.

**Suggested next move:** MUTATE — Clean `horseDebugger.ts` (57 source calls → `log.debug/warn`; corruption `console.error` → `log.warn`). In the same run: delete stale `ModernKmNormalizedResult` from `kmTimeTypes.ts` and remove 3 `horseForm` dead-property assignments. All in one cleanup pass — no behavior change, maximum pollution reduction.


<!-- stdout from run 15 2026-04-09 10:00 -->
Research complete. Here's what I found:

---

## Run 12 Research Summary

### Thread investigated: Console pollution scope + trip dependency data readiness

**Biggest new finding — `horseDebugger.ts` is the worst remaining pollution source**

The active thread listed `kmTimeProcessor.ts` (47 calls) as the next cleanup target, but missed `horseDebugger.ts` which has **57 raw console calls in source** with severe loop amplification:

- `logHistoricalData` fires 1 `console.log` per historical record (avg 12 records/horse)
- `logHistoricalNormalization` fires **7 calls per historical race record**, called 10-15× per horse = ~100 calls from this method alone per horse
- `logProcessedTimes` also loops per processed time

With `debugAllHorses = true` hardcoded (the class default), every method fires for every horse. Estimated **~9,500 console calls per full V75 race load** from this single file.

**Secondary finding — ghost type in `kmTimeTypes.ts`**

`src/services/types/kmTimeTypes.ts` exports a second `ModernKmNormalizedResult` (lines 42-61) with phantom fields `raceType` and `timeOfDay`. Nobody imports this type — only `KmTime`, `ProcessedKmTime`, `HorseRawKmTime` are imported from that file. The authoritative type lives in `modernKm/types.ts`. `horseDebugger.ts` reads `adjustments.raceType` and `adjustments.timeOfDay` (lines 255-256) — always `undefined` at runtime.

**Trip dependency algorithm — ready to implement**

`recentRaces[].postPosition` is populated from real ATG data (`start.postPosition`) for all normal records. Statistics-fallback records use `postPosition: 1`. The algorithm is fully specced in ACTIVE_THREADS.md: new `calculateTripDependencyModifier()` in `adjustmentCalculators.ts`, modifier range [0.6, 1.0], applied to `volteStartDistancePenalty` in `index.ts`.

**Suggested next mutate:** Clean `horseDebugger.ts` (57 calls → `log.debug/warn`) + delete stale `ModernKmNormalizedResult` from `kmTimeTypes.ts` + remove 3 `horseForm` dead-property assignments. All mechanical, all in one pass.


<!-- stdout from run 17 2026-04-09 11:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 12pm (Europe/Stockholm)


## Run 13 — 2026-04-09 — MUTATE

**Goal:** Triple cleanup in one pass: clean `horseDebugger.ts` console pollution (#1 priority thread), delete stale `ModernKmNormalizedResult` from `kmTimeTypes.ts`, remove 3 dead `horseForm` property assignments. All mechanical, zero behavior change.
**Done:**
- `src/services/debugging/horseDebugger.ts` — added `import { log } from '@/lib/logger'`; replaced all 57 raw console calls: `console.log` → `log.debug` (gated by `IS_DEBUG`), `console.warn` in catch blocks → `log.warn`, `console.error` for data corruption → `log.warn`. Also removed phantom `raceType` and `timeOfDay` from `adjustmentBreakdown` object in `logModernNormalizationBreakdown` (always `undefined` at runtime — stale reads from the deleted type).
- `src/services/types/kmTimeTypes.ts` — deleted `ModernKmNormalizedResult` interface (lines 42-61). Stale duplicate with phantom `raceType`/`timeOfDay` fields; zero files import it from this path. Authoritative type lives in `modernKm/types.ts`.
- `src/components/v75/utils/horseNormalizationProcessor.ts` — removed `horseForm: horse.statistics.winPercentage` from both `factors` object literals (lines 160 and 214). Field not in `ModernNormalizationFactors` interface — silently ignored at runtime.
- `src/components/v75/services/raceReanalysisService.ts` — removed `horseForm: horse.statistics?.winPercentage || 0` (line 41). Same dead assignment.
**Result:** pass — `tsc --noEmit` clean, 59/59 tests pass, 0 raw console calls remain in `horseDebugger.ts`
**Next:** Port trip dependency as volte-penalty modifier — `calculateTripDependencyModifier()` in `adjustmentCalculators.ts`, applied to `volteStartDistancePenalty` in `index.ts`. Full spec in ACTIVE_THREADS.md.


## Run 14 — 2026-04-09 — MUTATE

**Goal:** Port trip dependency as volte-penalty modifier — highest-priority open thread. Full spec was in ACTIVE_THREADS from Run 12.
**Done:**
- `src/services/modernKm/normalizationConstants.ts` — added 6 trip dependency constants: `TRIP_DEPENDENCY_OUTSIDE_THRESHOLD=7`, `TRIP_DEPENDENCY_MIN_OUTSIDE=2`, `TRIP_DEPENDENCY_MIN_RECORDS=4`, `TRIP_DEPENDENCY_MAX_MODIFIER=1.0`, `TRIP_DEPENDENCY_MIN_MODIFIER=0.6`, `TRIP_DEPENDENCY_OUTSIDE_RATE_SCALE=0.5`
- `src/services/modernKm/adjustmentCalculators.ts` — added `calculateTripDependencyModifier(recentRaces?)`: filters to records with defined postPosition > 0, requires ≥4 positioned records and ≥2 outside races (pos ≥ 7), computes outsidePlaceRate, returns modifier in [0.6, 1.0]
- `src/services/modernKm/index.ts` — multiplied `calculateVolteStartDistancePenalty(...)` result by `calculateTripDependencyModifier(factors.recentRaces)` before applying weight
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — added 12 new tests covering: no data → 1.0, insufficient records → 1.0, no outside races → 1.0, statistics-fallback postPosition=1 excluded from outside, 0% place rate → 1.0, 50% → 0.75, 80% → 0.6 clamped, 100% → 0.6 clamped, boundary at threshold 6 vs 7
**Result:** pass — 71/71 tests green (up from 59)
**Next:** Clean console pollution in `src/services/kmTimeProcessor.ts` (47 raw calls) — next highest-priority open thread


<!-- stdout from run 17 2026-04-09 12:00 -->
**Run 13 complete.** Three items closed in one pass:

---

### What changed

**`horseDebugger.ts`** — Added `import { log } from '@/lib/logger'`. Replaced all 57 raw console calls:
- `console.log` → `log.debug` (gated by `IS_DEBUG`, fires only in debug mode)
- `console.warn` in catch blocks → `log.warn`
- `console.error` for data corruption → `log.warn`
- Also removed phantom `raceType`/`timeOfDay` reads from `logModernNormalizationBreakdown` (always `undefined` — dead reads tied to the deleted type)

With `debugAllHorses = true` and loop amplification, this file was firing an estimated **~9,500 console calls per V75 race load**. All suppressed in production now.

**`kmTimeTypes.ts`** — Deleted the stale `ModernKmNormalizedResult` interface (phantom `raceType`/`timeOfDay` fields, zero consumers). Authoritative type is in `modernKm/types.ts`.

**`horseNormalizationProcessor.ts` + `raceReanalysisService.ts`** — Removed `horseForm: ...` from 3 `factors` object literals. Field not in `ModernNormalizationFactors` interface, silently ignored at runtime due to `"strict": false`.

**Result:** `tsc --noEmit` clean, 59/59 tests pass.

**Next:** Port trip dependency as volte-penalty modifier — `calculateTripDependencyModifier()` in `adjustmentCalculators.ts`. Full spec is in `ACTIVE_THREADS.md`.


<!-- stdout from run 18 2026-04-09 13:00 -->
**Run 14 complete.** Here's what changed:

---

### Trip dependency modifier — ported from v85 spec

**4 files changed, 12 new tests, 71/71 green.**

| File | Change |
|---|---|
| `normalizationConstants.ts` | 6 new constants: `TRIP_DEPENDENCY_OUTSIDE_THRESHOLD=7`, `MIN_OUTSIDE=2`, `MIN_RECORDS=4`, `MAX_MODIFIER=1.0`, `MIN_MODIFIER=0.6`, `OUTSIDE_RATE_SCALE=0.5` |
| `adjustmentCalculators.ts` | New `calculateTripDependencyModifier(recentRaces?)` — returns multiplier in [0.6, 1.0] |
| `modernKm/index.ts` | `volteStartDistancePenalty *= calculateTripDependencyModifier(factors.recentRaces)` |
| `normalizationPipeline.test.ts` | 12 tests: no data, insufficient records, stats-fallback postPosition=1 exclusion, 0%→1.0, 50%→0.75, 80%/100%→0.6 clamped, boundary 6-vs-7 |

**Scoring effect:** A volte back-marker horse that regularly draws post ≥ 7 and places top-3 from those starts now has its +0.40 s penalty reduced — up to 40% damped at an 80%+ outside place rate. Horses with only inside-draw history or insufficient data are unaffected (modifier = 1.0).

**Next thread:** Clean console pollution in `src/services/kmTimeProcessor.ts` (~47 calls).


## Run 15 — 2026-04-09 — RESEARCH

**Investigated:** Console pollution priority audit across all remaining files. Read `kmTimeProcessor.ts` (47 calls), `enhancedAtgApi.ts` (45 calls), `raceAnalysisCache.ts` (31 calls), `atgHistoricalApi.ts` (27 calls) in full. Checked call sites for `fetchEnhancedRaceData`. Verified logger.ts gating behavior.

**Key finding:** The ACTIVE_THREADS priority order is wrong. `enhancedAtgApi.ts` is listed as Priority #2 (45 calls) but `fetchEnhancedRaceData` is **never called anywhere in the source tree** — confirmed by exhaustive grep. Its 45 console calls have zero runtime impact. Only the types (`EnhancedRaceData`, `EnhancedHorseData`) are imported by consumers. Separately, `raceAnalysisCache.ts` has 31 console calls and is live (called by `horseResultBuilder.ts` → `RaceAnalysisCache.storeRaceAnalysis`), but was entirely missing from the cleanup list. Also confirmed: `log.info` in `logger.ts` is NOT gated by `IS_DEBUG` — only `log.debug` is suppressed in production. `log.warn` and `log.error` always fire (intentional).

**Additional findings by file:**
- `kmTimeProcessor.ts`: Standard `log.debug`/`log.warn` pattern. Loop-amplified: per-horse, ~6–8 calls/horse + final ranking loop. ~490 calls/V75 load. Assertion `console.error` block (lines 441–446) should become `log.warn`.
- `atgHistoricalApi.ts`: Uses existing `isXanderDebug` gate for per-record logs (must be preserved). Has 4 unconditional calls (lines 56, 67, 72, 268); fallback-path block (lines 307–320) fires on `isXanderDebug || usedFallback` — the `usedFallback` arm fires for any horse with no recent form. Cleanup must wrap xander calls in `log.debug` without removing the conditional.
- `raceAnalysisCache.ts`: Clean swap — all 31 calls are informational `log.debug` or `console.error` → `log.warn`. No loops over horses. Called once per race analysis.
- `enhancedAtgApi.ts`: `fetchEnhancedRaceData` dead — but contains `JSON.stringify(start, null, 2)` inside a per-horse loop (line 85) and `JSON.stringify(sulkyDataSources, null, 2)` for every horse (line 216). These are stale sulky investigation code from API field discovery work that was never cleaned. If the function is ever activated, it would be expensive. For now, zero production impact.

**Implication:** Corrected priority order for mutate runs: (1) `kmTimeProcessor.ts` — 47 calls, highest loop amplification, called every race load; (2) `atgHistoricalApi.ts` — 27 calls, fallback block fires for real horses, needs xander-gate preservation; (3) `raceAnalysisCache.ts` — 31 calls, not on list, live code; (4) `timeProcessor.ts` — 25 calls; (5) `enhancedAtgApi.ts` — dead function, zero priority for console cleanup specifically.

**Suggested next move:** MUTATE — Clean `kmTimeProcessor.ts` (47 calls → `log.debug`/`log.warn`). All main-path `console.log` → `log.debug`. The `console.warn` fallback-path calls → `log.warn` (data quality signals). The `console.error` assertion block (lines 441–446) → `log.warn` (invariant violation, should always surface). Import `log` from `@/lib/logger`.

<!-- stdout from run 19 2026-04-09 14:00 -->
Done. Here's what I found and documented:

---

## Run 15 Research Summary

**Thread investigated:** Console pollution priority audit

### Key finding: Priority list was wrong

`enhancedAtgApi.ts` was listed as Priority #2 (45 calls) in ACTIVE_THREADS. But `fetchEnhancedRaceData` — the function containing all 45 calls — is **never called anywhere in the codebase** (confirmed by full-source grep). Only its exported types are consumed. Zero runtime impact.

### Corrected priority order

| Priority | File | Calls | Notes |
|---|---|---|---|
| #1 | `kmTimeProcessor.ts` | 47 | Loop-amplified, ~490 calls/V75 load, every race |
| #2 | `atgHistoricalApi.ts` | 27 | Has `isXanderDebug` gate pattern — must be preserved, not removed; fallback block fires for real horses |
| #3 | `raceAnalysisCache.ts` | 31 | Missing from original list, live code, simpler cleanup |
| #4 | `timeProcessor.ts` | 25 | Next |
| #5 | `enhancedAtgApi.ts` | 45 | Dead function — lowest actual priority |

### Two additional findings

1. **`log.info` is not gated** — `logger.ts` only gates `log.debug` behind `IS_DEBUG`. Any cleanup run using `log.info` instead of `log.debug` would still fire in production. Previous runs all used `log.debug` correctly.

2. **`enhancedAtgApi.ts` has stale sulky investigation code** — `JSON.stringify(start, null, 2)` inside a per-horse loop (line 85), plus a 6-path sulky-detection chain that logs full JSON for every horse (line 216). This is leftover API exploration code. If the function is ever activated, it would be expensive. For now: zero impact.

**Immediate next mutate:** Clean `kmTimeProcessor.ts` — 47 calls → `log.debug`/`log.warn`. The assertion `console.error` block (lines 441–446) should be `log.warn` (invariant violation should always surface).


## Run 15 — 2026-04-09 — MUTATE

**Goal:** Clean console pollution in `src/services/kmTimeProcessor.ts` — highest-priority open thread. 47 raw console calls, loop-amplified to ~490 per V75 load.
**Done:**
- Added `import { log } from '@/lib/logger'` to `kmTimeProcessor.ts`
- Replaced all `console.log` → `log.debug` (informational flow tracing, per-horse progress, rankings, fallback summary)
- Replaced `console.warn` fallback warnings → `log.warn` (NO HISTORICAL DATA, INVALID-TIME FALLBACK, EXTENDED SINGLE RECORD)
- Replaced `console.error` in catch block → `log.warn` + `log.debug` for detail lines
- Replaced `console.error` assertion block (lines 441–446) → `log.warn` (invariant violation should always surface)
- Removed emoji prefixes from all log messages (consistent with rest of codebase)
- 71/71 tests pass
**Result:** pass
**Next:** Clean `src/services/atgHistoricalApi.ts` (27 calls) — next in priority order per thread.

<!-- stdout from run 21 2026-04-09 14:32 -->
Done. Here's what changed in Run 15:

**`src/services/kmTimeProcessor.ts`** — 47 raw console calls eliminated:
- Added `import { log } from '@/lib/logger'`
- All `console.log` → `log.debug` (per-horse progress, fallback tracing, final rankings, summary block)
- `console.warn` fallback warnings → `log.warn` (NO HISTORICAL DATA, INVALID-TIME FALLBACK, EXTENDED SINGLE RECORD)  
- `console.error` catch block → `log.warn` + `log.debug` for detail lines
- `console.error` assertion block → `log.warn` (invariant violations should still surface)
- Emoji prefixes stripped from all messages (consistent with rest of codebase)

This was the highest-impact file in the queue: loop-amplified to ~490 console calls per V75 load. **71/71 tests pass.**

**Next:** `src/services/atgHistoricalApi.ts` — 27 calls, partially gated by `isXanderDebug`.


## Run 16 — 2026-04-09 — MUTATE

**Goal:** Clean console pollution in `src/services/atgHistoricalApi.ts` — next in priority order (thread item #2). 27 raw console calls: 3 unconditional in `fetchHorseHistoricalData`, 8 inside `isXanderDebug` gates in `filterRecords`, 4 unconditional in `processHistoricalRecords` body, 12 in summary block gated by `isXanderDebug || usedFallback`.
**Done:**
- Added `import { log } from '@/lib/logger'` to `src/services/atgHistoricalApi.ts`
- Lines 56, 67 (`fetchHorseHistoricalData`): `console.log` → `log.debug` (fetch tracing)
- Line 72 (`fetchHorseHistoricalData` catch): `console.error` → `log.warn` (fetch error, always surfaces)
- 8 calls inside `if (isXanderDebug)` blocks in `filterRecords`: `console.log` → `log.debug` (preserved all `isXanderDebug` conditional logic, only swapped call)
- Line 268 (`processHistoricalRecords` start): `console.log` → `log.debug`
- Lines 279, 288, 291 (fallback path): `console.log` → `log.warn` (data-quality signals: no recent records, FALLBACK ACTIVATED, no records even with fallback)
- Summary block (lines 307–320, gated `isXanderDebug || usedFallback`): all `console.log` → `log.debug` (preserved conditional gate)
- Stripped emoji prefixes from all messages (consistent with rest of codebase)
- 71/71 tests pass, `tsc --noEmit` clean
**Result:** pass
**Next:** Clean `src/services/v75Cache/raceAnalysisCache.ts` (31 calls) — next in priority order. Was missing from original thread list; live code called by `horseResultBuilder.ts`.

<!-- stdout from run 22 2026-04-09 15:00 -->
**Run 16 complete.**

`src/services/atgHistoricalApi.ts` — all 27 raw console calls eliminated:

| Location | Count | Change |
|---|---|---|
| `fetchHorseHistoricalData` (lines 56, 67) | 2 | `console.log` → `log.debug` |
| `fetchHorseHistoricalData` catch (line 72) | 1 | `console.error` → `log.warn` |
| `filterRecords` `isXanderDebug` gates | 8 | `console.log` → `log.debug` (conditional preserved) |
| `processHistoricalRecords` start (line 268) | 1 | `console.log` → `log.debug` |
| Fallback path (lines 279, 288, 291) | 3 | `console.log` → `log.warn` (data-quality signals) |
| Summary block `isXanderDebug || usedFallback` | 12 | `console.log` → `log.debug` (gate preserved) |

Emoji prefixes stripped throughout. The `isXanderDebug` per-horse debug path is preserved — only the call site changed from `console.log` to `log.debug`, so it now respects the `IS_DEBUG` flag.

**71/71 tests pass. `tsc --noEmit` clean.**

**Next:** `src/services/v75Cache/raceAnalysisCache.ts` (31 calls) — live code, clean swap.


<!-- stdout from run 23 2026-04-09 16:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 5pm (Europe/Stockholm)


## Run 17 — 2026-04-09 — RESEARCH

**Investigated:** `src/services/v75Cache/raceAnalysisCache.ts` (the next console-cleanup thread), `src/services/timeProcessor.ts` (thread item #4), and `src/utils/raceAnalysis.ts` (dead-code status of its caller chain).

**Key finding:** `src/services/timeProcessor.ts` and `src/utils/raceAnalysis.ts` are both dead code — zero static import references in the entire source tree. The 25 console calls in `timeProcessor.ts` listed as thread item #4 have zero runtime impact. The active app uses `fetchRaceDataForGame` from `v75CalendarApi.ts` for data fetching (routed through `queries/v75.ts`). `raceAnalysis.ts` duplicated this with its own `fetchRaceData` that was never connected to the render tree. Additionally, `timeProcessor.ts:57` contains a hardcoded `raceId = "2025-01-15_19_7"` (a literal string from January 2025 with comment "This should be passed as a parameter") — left-over debug scaffolding. Both files should be deleted, not console-cleaned.

`raceAnalysisCache.ts` is confirmed live: `storeRaceAnalysis` is called by `horseResultProcessor.ts:76` (via `storeRaceAnalysisData` in `horseResultBuilder.ts:228`) and by `useV75Analysis.tsx:128` (via `V75CacheService.storeRaceAnalysis`). Its 31 console calls are a simple mechanical swap — all informational flow tracing (`console.log` → `log.debug`), error paths (`console.error` → `log.warn`). No per-horse loop amplification; worst case is a 3-horse slice in `storeRaceAnalysis` / `getRaceAnalysis` and a per-entry forEach in `getAllRaceAnalyses` (bounded by total cached races).

**Implication:** The thread list had `timeProcessor.ts` as #4 (25 calls to clean). It should instead be deleted as dead code along with `raceAnalysis.ts`. This removes ~450 lines and makes the console-cleanup queue shorter by one item. The #4 slot drops out entirely.

**Suggested next move:** MUTATE — two actions in one pass:
1. Delete `src/utils/raceAnalysis.ts` and `src/services/timeProcessor.ts` (confirm `tsc --noEmit` clean after)
2. Clean `src/services/v75Cache/raceAnalysisCache.ts` — add `import { log } from '@/lib/logger'`, replace all 31 raw console calls: `console.log` → `log.debug`, `console.error` → `log.warn`


<!-- stdout from run 23 2026-04-09 17:00 -->
Done. Here's what I found in Run 17:

---

## Run 17 Research Summary

**Thread investigated:** `raceAnalysisCache.ts` (the live priority #3 target) + dead-code audit of `timeProcessor.ts` and `raceAnalysis.ts`.

### Key finding: `timeProcessor.ts` thread is moot — delete both files

`src/utils/raceAnalysis.ts` has **zero static import references** anywhere in the source tree. It defines a `fetchRaceData` function that was an abandoned parallel implementation; the live app routes through `fetchRaceDataForGame` in `v75CalendarApi.ts`.

`src/services/timeProcessor.ts` is only dynamically imported from the dead `raceAnalysis.ts`. Its two exported functions (`calculateRawTimesForRace`, `calculateRawTimesForRaceWithId`) are never called from the render tree. It also contains a hardcoded `raceId = "2025-01-15_19_7"` — literally a dated string from Jan 2025 with the comment "This should be passed as a parameter". Never cleaned up, never called.

**Implication:** The "25 console calls in `timeProcessor.ts`" thread item has zero runtime impact. Both files should be deleted (saves ~450 lines). The priority queue loses one item.

### `raceAnalysisCache.ts` — confirmed live, clean swap ready

31 console calls, two live callers:
- `horseResultProcessor.ts:76` → `storeRaceAnalysisData` in `horseResultBuilder.ts:228` → `RaceAnalysisCache.storeRaceAnalysis`  
- `useV75Analysis.tsx:128` → `V75CacheService.storeRaceAnalysis`

All calls are informational (`console.log` → `log.debug`, `console.error` → `log.warn`). No per-horse loop amplification.

### Suggested mutate (one pass):
1. Delete `src/utils/raceAnalysis.ts` + `src/services/timeProcessor.ts`
2. Clean `src/services/v75Cache/raceAnalysisCache.ts` — `import { log }`, 31 raw calls → `log.debug`/`log.warn`


## Run 18 — 2026-04-09 — MUTATE

**Goal:** Three-in-one cleanup pass: clean `raceAnalysisCache.ts` console pollution (priority #3 open thread) + delete `raceAnalysis.ts` and `timeProcessor.ts` (confirmed dead code from Run 17 research).
**Done:**
- `src/services/v75Cache/raceAnalysisCache.ts` — added `import { log } from '@/lib/logger'`; replaced all console calls: `console.log` → `log.debug`, `console.error` → `log.warn`. Stripped all emoji prefixes. 0 raw console calls remain.
- Deleted `src/utils/raceAnalysis.ts` — 255 lines of dead code. `fetchRaceData` was an abandoned parallel implementation never connected to the render tree; only internally dynamic-imports `timeProcessor.ts`.
- Deleted `src/services/timeProcessor.ts` — 274 lines of dead code. Only callee was the dead `raceAnalysis.ts`. Contains hardcoded `raceId = "2025-01-15_19_7"` (debug scaffold from Jan 2025, never cleaned).
- `tsc --noEmit`: zero errors. 71/71 tests pass.
**Result:** pass
**Next:** Clean `src/services/enhancedAtgApi.ts` — dead function body with stale per-horse JSON.stringify loops. Only live exports are the types. Options: (1) delete dead function body, keep types; (2) full file deletion if types can be verified as replaceable. Lowest-impact item remaining in console-cleanup queue.

<!-- stdout from run 25 2026-04-09 18:00 -->
**Run 18 complete.** Three items closed in one pass:

| Action | File | Result |
|---|---|---|
| Console cleanup | `src/services/v75Cache/raceAnalysisCache.ts` | 31 raw calls → `log.debug`/`log.warn`, emoji stripped |
| Deleted dead code | `src/utils/raceAnalysis.ts` | 255 lines gone — abandoned parallel impl, never wired to render tree |
| Deleted dead code | `src/services/timeProcessor.ts` | 274 lines gone — only callee was dead `raceAnalysis.ts`, contained Jan 2025 hardcoded debug raceId |

`tsc --noEmit` clean. **71/71 tests pass.**

One open thread remains: `src/services/enhancedAtgApi.ts` — the dead `fetchEnhancedRaceData` function body with stale per-horse `JSON.stringify` loops. Only its exported types are live. Next run: delete the dead function body (or full file if types can be inlined).


## Run 19 — 2026-04-09 — MUTATE

**Goal:** Delete dead `fetchEnhancedRaceData` function and `calculateEarningsPerStart` helper from `enhancedAtgApi.ts` — the last open console-pollution thread. The two exported interfaces (`EnhancedHorseData`, `EnhancedRaceData`) remain live.

**Done:**
- Deleted `fetchEnhancedRaceData` (~315 lines, 45 raw `console.*` calls including per-horse `JSON.stringify` loops and emoji-prefixed debug dumps)
- Deleted `calculateEarningsPerStart` private helper (~12 lines, 1 `console.log`)
- `src/services/enhancedAtgApi.ts` now contains only the two interfaces (49 lines, down from 385)

`tsc --noEmit` clean. **71/71 tests pass.**

**Result:** pass

**Next:** Open new thread — `src/services/raceDataValidator.ts` has 17 live `console.*` calls (file is in active call chain: `useV75Analysis` → `useV75DataValidation` → `validateRaceData`/`fixRaceDataIssues`). Replace with `log.debug`/`log.warn`.

<!-- stdout from run 26 2026-04-09 19:00 -->
**Run 19 complete.**

**What changed:** `src/services/enhancedAtgApi.ts` went from 385 lines to 49 lines. The dead `fetchEnhancedRaceData` function (a sulky-debugging experiment with per-horse `JSON.stringify` dumps, emoji-prefixed console walls, and a stale API fetch path) was deleted along with the `calculateEarningsPerStart` private helper. The two live interfaces (`EnhancedHorseData`, `EnhancedRaceData`) are untouched — they're still consumed by the active `useV75DataValidation` → `useV75Analysis` path.

`tsc --noEmit` clean. 71/71 tests pass.

**Next:** `raceDataValidator.ts` — 17 live console calls in the active validation chain.


---

## Run 20 — 2026-04-09 — RESEARCH

**Investigated:** `src/services/raceDataValidator.ts` (open thread) + broader console pollution audit

**Key finding:** `raceDataValidator.ts` has exactly 17 raw `console.log` calls, all diagnostic/tracing (scratch detection, duplicate positions, fix progress). All fire on every validation cycle — i.e. on every race in every game load. A second validator file, `src/services/v75DataConsistencyValidator.ts`, has 20 additional raw `console.*` calls (19 `console.log` + 1 `console.error`) that were not yet tracked. Both files are in the active call chain. The logger at `src/lib/logger.ts` is available: `log.debug` (IS_DEBUG-gated), `log.warn`, `log.error`.

**Implication:** Every race load emits 17+ lines of emoji-prefixed diagnostic noise to the console in production. `v75DataConsistencyValidator.ts` adds another ~20 if its validation path is triggered. Users with DevTools open see garbage output; it also obscures real warnings.

**Suggested next move:**
1. Mutate `src/services/raceDataValidator.ts` — replace all 17 `console.log` calls with `log.debug` (import `log` from `../../lib/logger`). Strip emoji prefixes. This is the open thread.
2. After that, open and mutate `src/services/v75DataConsistencyValidator.ts` — same treatment, ~20 calls. Track as a new thread.

<!-- stdout from run 27 2026-04-09 19:11 -->
Done. Here's what I found:

**Investigated:** `raceDataValidator.ts` (the open thread) + broader console pollution audit.

**Key findings:**

1. **`raceDataValidator.ts`** — confirmed 17 raw `console.log` calls, all diagnostic tracing (scratch detection, duplicate fix progress, validation summary). They fire on every race in every game load. All should become `log.debug` — none warrant `log.warn` or `log.error`. The `log` import path is `../../lib/logger`.

2. **New thread discovered:** `src/services/v75DataConsistencyValidator.ts` has 20 more console calls (19 `console.log` + 1 `console.error`), also emoji-prefixed, also in the active validation chain. Not previously tracked — now added as a new open thread.

**Next mutate run** should fix `raceDataValidator.ts` first (17 calls → `log.debug`), then `v75DataConsistencyValidator.ts`. Both files are straightforward — import `log`, swap every `console.log` for `log.debug`, and strip the emoji prefixes.


<!-- stdout from run 28 2026-04-09 20:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 10pm (Europe/Stockholm)


<!-- stdout from run 28 2026-04-09 21:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 10pm (Europe/Stockholm)


## Run 21 — 2026-04-09 — MUTATE

**Goal:** Clean console pollution in `raceDataValidator.ts` — highest-priority open thread. 17 raw `console.log` calls in active code path (`useV75Analysis` → `useV75DataValidation` → `validateRaceData` / `fixRaceDataIssues`) firing on every race load.
**Done:**
- `src/services/raceDataValidator.ts` — added `import { log } from '../lib/logger'`; replaced all 17 `console.log` calls with `log.debug`; stripped emoji prefixes from all messages. Zero `console.*` remaining.
- `tsc --noEmit` clean; 71/71 tests pass.
**Result:** pass
**Next:** Clean console pollution in `v75DataConsistencyValidator.ts` — 20 calls (19 `console.log` + 1 `console.error`), same pattern.

<!-- stdout from run 28 2026-04-09 22:00 -->
Done.

**Run 21 — `raceDataValidator.ts` console cleanup**

- Added `import { log } from '../lib/logger'` to `src/services/raceDataValidator.ts`
- Replaced all 17 `console.log` calls with `log.debug`, stripped emoji prefixes
- `tsc --noEmit` clean, 71/71 tests pass

One open thread remains: `v75DataConsistencyValidator.ts` has 20 more console calls (19 `console.log` + 1 `console.error`) — same pattern, queued for next run.


## Run 22 — 2026-04-09 — MUTATE

**Goal:** Port gallop reliability factor from v85-briefing-engine — highest-priority open thread (first substantive pipeline addition since Run 14). Adds a time penalty proportional to a horse's stride-break (gallop) rate over last 10 starts.
**Done:**
- `src/services/types/kmTimeTypes.ts` — added `gallopCount?: number` and `disqualificationCount?: number` to `HorseRawKmTime`
- `src/services/horseProcessing.ts` — computed gallop/disq counts from last 10 historical starts, populated in returned object
- `src/services/modernKm/normalizationConstants.ts` — added `GALLOP_PENALTY_PER_RACE_S = 0.15`, `DISQ_PENALTY_PER_RACE_S = 0.10`, `GALLOP_RELIABILITY_MAX_PENALTY_S = 0.50`
- `src/services/modernKm/types.ts` — added `gallopReliabilityPenalty` to `ModernKmNormalizedResult.adjustments`; added `gallopCount?` / `disqualificationCount?` to `ModernNormalizationFactors`; added `gallopReliability: 0.8` to `NormalizationWeights` and `DEFAULT_WEIGHTS`
- `src/services/modernKm/adjustmentCalculators.ts` — implemented `calculateGallopReliabilityPenalty(gallopCount, disqCount)`: linear penalty capped at 0.50 s, ported from v85 reliability.py
- `src/services/modernKm/index.ts` — wired `gallopReliabilityPenalty` into pipeline and debug log
- `src/components/v75/utils/horseNormalizationProcessor.ts` — extended `rawTimeData` inline type; threaded `gallopCount`/`disqualificationCount` into both `ModernNormalizationFactors` objects (fallback + raw path)
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — 10 new tests for `calculateGallopReliabilityPenalty`
- `tsc --noEmit` clean; 81/81 tests pass (71 → 81)
**Result:** pass
**Next:** Per-horse confidence flags — sample size, missing data, equipment delta, data age. Does not change scores, only annotates trust.

<!-- stdout from run 29 2026-04-09 22:27 -->
Done. Here's what was delivered in Run 22:

## Gallop reliability factor — ported from v85

**What changed:**

| File | Change |
|---|---|
| `kmTimeTypes.ts` | Added `gallopCount?` and `disqualificationCount?` to `HorseRawKmTime` |
| `horseProcessing.ts` | Computed gallop/disq counts from last 10 historical starts, returned in result |
| `normalizationConstants.ts` | Added 3 new constants: `GALLOP_PENALTY_PER_RACE_S = 0.15`, `DISQ_PENALTY_PER_RACE_S = 0.10`, `GALLOP_RELIABILITY_MAX_PENALTY_S = 0.50` |
| `modernKm/types.ts` | Added `gallopReliabilityPenalty` to adjustments struct; `gallopCount?`/`disqualificationCount?` to `ModernNormalizationFactors`; `gallopReliability: 0.8` weight |
| `adjustmentCalculators.ts` | Implemented `calculateGallopReliabilityPenalty(gallopCount, disqCount)` — linear penalty, hard-capped at 0.50 s |
| `modernKm/index.ts` | Wired the new adjustment into the pipeline and debug log |
| `horseNormalizationProcessor.ts` | Threaded counts through `rawTimeData` → `ModernNormalizationFactors` in both code paths |
| `normalizationPipeline.test.ts` | 10 new tests for `calculateGallopReliabilityPenalty` |

**Effect:** A horse with 3 gallops in its last 10 starts now gets +0.45 s added to its adjusted km time (before the 0.8 weight = +0.36 s net). A horse with 4+ gallops is capped at +0.40 s weighted. Zero gallops = zero penalty — no regression for clean horses.

**Verification:** `tsc --noEmit` clean. 81/81 tests pass (was 71).


<!-- stdout from run 30 2026-04-09 23:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 3am (Europe/Stockholm)


<!-- stdout from run 30 2026-04-10 00:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 3am (Europe/Stockholm)


<!-- stdout from run 30 2026-04-10 01:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 3am (Europe/Stockholm)


<!-- stdout from run 30 2026-04-10 02:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 3am (Europe/Stockholm)


## Run 23 — 2026-04-10 — MUTATE

**Goal:** Per-horse confidence flags — second priority thread from SEED.md. Annotate trust without changing scores.

**Done:**
- `src/components/v75/utils/confidenceFlags.ts` — new file. `HorseConfidenceFlags` type + `computeConfidenceFlags()`. Five flags: `noKmTime`, `lowSampleSize`, `noDriverStats`, `gallopRisk`, `staleForm`. Includes counts (`validTimesCount`, `gallopCount`) for UI label display.
- `src/components/v75/types/raceResultTypes.ts` — added `confidenceFlags?: HorseConfidenceFlags` to `V75HorseResult`.
- `src/components/v75/utils/horseResultBuilder.ts` — calls `computeConfidenceFlags()` and stores result on every horse result.
- `src/components/v75/components/CompactHorseRow.tsx` — renders `ConfidenceFlagStrip` (inline component) below driver/confidence line when `hasAnyFlag(flags)`. Uses `WifiOff`, `BarChart2`, `AlertTriangle`, `Clock` icons with tooltips.
- `src/components/v75/utils/__tests__/confidenceFlags.test.ts` — 25 new tests covering all flags independently plus combined/clean scenarios.

**Result:** pass — tsc clean, 106/106 tests pass (was 81).

**Next:** MAE infrastructure — prediction store + result fetch + error display. This is the remaining high-priority open thread.

<!-- stdout from run 30 2026-04-10 03:00 -->
Run 23 complete.

**What changed:**

- **`src/components/v75/utils/confidenceFlags.ts`** (new) — `HorseConfidenceFlags` type + `computeConfidenceFlags()`. Five binary flags that annotate trust without touching scores: `noKmTime`, `lowSampleSize` (< 5 valid samples), `noDriverStats`, `gallopRisk` (≥ 2 gallops in last 10 starts), `staleForm` (newest race > 90 days ago). Counts embedded in the struct for UI label display.

- **`src/components/v75/types/raceResultTypes.ts`** — `confidenceFlags?: HorseConfidenceFlags` added to `V75HorseResult`.

- **`src/components/v75/utils/horseResultBuilder.ts`** — calls `computeConfidenceFlags()` at result-build time and stores on every horse.

- **`src/components/v75/components/CompactHorseRow.tsx`** — `ConfidenceFlagStrip` inline component renders small icon+label chips (WifiOff / BarChart2 / AlertTriangle / Clock) with tooltips, below the driver line, only when at least one flag is raised.

- **`src/components/v75/utils/__tests__/confidenceFlags.test.ts`** (new) — 25 tests covering every flag independently plus combined and clean-horse scenarios.

**Result:** `tsc --noEmit` clean, **106/106 tests pass** (was 81).


## Run 31 — 2026-04-10 — RESEARCH

**Investigated:** MAE infrastructure — full trace of prediction storage, actual-result availability, and gaps blocking implementation.

**Key finding:** `predictedTime` is NEVER stored in `localStorage`, making km-time MAE impossible without a one-line fix. The main-thread cache path in `useV75Analysis.tsx:125` stores `predictedTime: h.predictedTime`, but `buildHorseResult` never assigns `predictedTime` to the `V75HorseResult` it returns — the field is always `undefined`. The worker-side `storeRaceAnalysisData` in `horseResultBuilder.ts` correctly extracts the time from `modernNormalizedResult.modernNormalizedTime`, but runs inside a Web Worker that has no `localStorage`, so every call throws and is swallowed by the `try/catch`. **Rank MAE is feasible today** — `h.rank` is set by `RaceScoreCalculator.calculateScoresAndRanks` and stored correctly. The ATG `/races/{raceId}` endpoint already returns `start.result.finishOrder` after a race completes — no new endpoint needed.

**Additional findings:**
- One raw `console.error` survives in `src/components/v75/services/raceResultProcessor.ts:58` (inside the catch block). Missed by previous cleanup runs — only 1 call in the file.
- Worker-side storage in `horseResultProcessor.ts:76` (`storeRaceAnalysisData`) is functionally dead code in the worker context — `localStorage` is unavailable in Workers; the call always fails and is swallowed. Main-thread path in `useV75Analysis.tsx` is the only working storage.
- Both paths write to the same key (`v75_race_analysis_${raceId}`) so no deduplication concern.

**Implication:** Rank MAE can be built end-to-end with current stored data. Fix `predictedTime` storage first to also enable km-time delta MAE. The ATG endpoint re-use means no new API surface. All building blocks exist.

**Suggested next move:** MUTATE — MAE infrastructure in 4 steps:
1. Fix `predictedTime` storage: `useV75Analysis.tsx:125` — change `predictedTime: h.predictedTime` to `(h.modernNormalizedResult?.modernNormalizedTime && !(h.modernNormalizedResult as any)?.isEstimated) ? h.modernNormalizedResult.modernNormalizedTime : undefined`
2. Add `RaceMAEResult` type to `src/services/v75Cache/types.ts`; add MAE get/set methods to `src/services/v75Cache/index.ts`
3. Create `src/services/raceMAEService.ts`: `fetchAndComputeMAEForRace(raceId)` re-fetches via existing `fetchRaceById`, reads `start.result.finishOrder`, matches by `horseId` to stored predictions, computes mean |predicted_rank − actual_finish_order|; stores in `localStorage: v75_mae_${raceId}`
4. Small display component (in `WeightManager` or standalone): show avg rank MAE over last N rounds
5. Bonus: clean `raceResultProcessor.ts:58` lone `console.error` → `log.warn`

<!-- stdout from run 31 2026-04-10 04:00 -->
Here's what I found in Run 31:

---

## MAE Infrastructure — Research Complete

### The gap: `predictedTime` is never stored

`buildHorseResult` (`horseResultBuilder.ts`) constructs a `V75HorseResult` but never assigns the `predictedTime` field. The main-thread storage in `useV75Analysis.tsx:125` reads `h.predictedTime` — always `undefined`. km-time delta MAE is therefore blocked.

The worker-side `storeRaceAnalysisData` (also in `horseResultBuilder.ts`) does extract the time correctly from `modernNormalizedResult.modernNormalizedTime`, but it runs inside a Web Worker — `localStorage` is unavailable there, the call always throws, and the `try/catch` swallows it silently. That code path is dead.

### What IS stored correctly

`h.rank` is assigned by `RaceScoreCalculator.calculateScoresAndRanks` before the worker returns, so ranks survive back to the main thread and are persisted. **Rank MAE is feasible today** with no prerequisite fixes.

### No new ATG endpoint needed

`ATGStartInfo.result.finishOrder` is returned by the same `/races/{raceId}` endpoint the app already uses — it's populated after a race completes. A single user-triggered re-fetch via `fetchRaceById` is all that's needed.

### Bonus find

`raceResultProcessor.ts:58` has one raw `console.error` that survived all previous cleanup runs — low-hanging fruit to fold into the mutate.

### Actionable next move

Mutate run implementing MAE end-to-end:
1. Fix `useV75Analysis.tsx:125` — store `modernNormalizedResult.modernNormalizedTime` instead of the missing `predictedTime` field
2. Add `RaceMAEResult` type + cache methods
3. New `raceMAEService.ts` — user-triggered fetch, rank comparison, localStorage store
4. Small accuracy display (in `WeightManager` or standalone)
5. Clean the lone `console.error` in `raceResultProcessor.ts`


## Run 32 — 2026-04-10 — MUTATE

**Goal:** MAE infrastructure — close the prediction→accuracy feedback loop. Highest-priority open thread.

**Done:**
- `src/components/v75/services/raceResultProcessor.ts` — replaced `console.error` with `log.error` (last stray raw console call)
- `src/components/v75/hooks/useV75Analysis.tsx:125` — fixed `predictedTime` storage: derives from `modernNormalizedResult.modernNormalizedTime` instead of the never-set `h.predictedTime` field
- `src/services/v75Cache/types.ts` — added `HorseMAEEntry` + `RaceMAEResult` types
- `src/services/v75Cache/raceAnalysisCache.ts` — added `storeMAEResult`, `getMAEResult`, `getAllMAEResults` (sync localStorage reads)
- `src/services/v75Cache/index.ts` — exposed MAE methods on `V75CacheService`
- `src/services/raceMAEService.ts` — new service: `fetchAndComputeMAEForRace(raceId)` user-triggered ATG re-fetch + rank comparison + store; `getAggregateMAEStats()` aggregate reader
- `src/components/v75/components/MAEPanel.tsx` — new component: lists stored predictions per race, refresh button per race, aggregate mean rank error badge
- `src/components/V75Analyzer.tsx` — lazy-loads `MAEPanel` alongside `V75CacheManager` when cache panel is open
- `src/services/__tests__/raceMAEService.test.ts` — 10 new tests covering null paths, perfect MAE, partial match, gallop exclusion, cache storage, aggregate stats

**Result:** pass — tsc clean, 116/116 tests pass (10 new)

**Next:** Multi-dimensional score display — surface a reliability indicator alongside the main km-time score. Investigate what data the current pipeline already has (gallopRisk flag, confidenceMultiplier, timeSource) to drive a simple 1–5 star or color-coded reliability column.

<!-- stdout from run 32 2026-04-10 05:00 -->
**Run 32 complete. tsc clean, 116/116 tests pass.**

Here's what landed:

**Bug fix**
- `useV75Analysis.tsx:125` — `predictedTime` was always `undefined` because `buildHorseResult` never set it. Now derived directly from `modernNormalizedResult.modernNormalizedTime` (only when not estimated). Stored analyses will have real km-time values going forward.

**MAE infrastructure** (the main thread)
- `v75Cache/types.ts` — `HorseMAEEntry` + `RaceMAEResult` types
- `v75Cache/raceAnalysisCache.ts` — `storeMAEResult`, `getMAEResult`, `getAllMAEResults` (sync localStorage)
- `v75Cache/index.ts` — exposed on `V75CacheService`
- `services/raceMAEService.ts` — `fetchAndComputeMAEForRace(raceId)`: user-triggered ATG re-fetch, matches horses by `horseId`, computes mean |predicted_rank − actual_finish|, stores result. `getAggregateMAEStats()`: reads all stored MAEs.
- `components/v75/components/MAEPanel.tsx` — lists stored predictions, per-race refresh button, aggregate mean rank error badge
- `V75Analyzer.tsx` — lazy-loads `MAEPanel` alongside the cache panel

**Housekeeping**
- `raceResultProcessor.ts:58` — last stray `console.error` replaced with `log.error`

**Tests**: 10 new in `raceMAEService.test.ts` — null paths, perfect MAE, partial reversal, gallop exclusion, cache write, aggregate stats.


## Run 33 — 2026-04-10 — MUTATE

**Goal:** Multi-dimensional score display — surface a reliability indicator (1–5) alongside the main km-time prediction, using only existing pipeline fields (no new data fetching, no score changes).

**Done:**
- `src/components/v75/utils/confidenceFlags.ts` — added `computeReliabilityScore(flags, timeSource, uncertain, historySource, confidenceMultiplier): number`. Deduction table: `timeSource='none'` −3, `uncertain` −1, `historySource='abroad'` −1, `confidenceMultiplier<0.5` −0.5, each flag (gallopRisk, staleForm, lowSampleSize, noDriverStats) −0.5. Floor + clamp to [1,5].
- `src/components/v75/components/CompactHorseRow.tsx` — added `RELIABILITY_DOT_COLOR` map, `buildReliabilityTooltip()`, and `ReliabilityDot` component. Computed `relScore` + `relTooltip` in `CompactHorseRow`; rendered `ReliabilityDot` inline next to the "Pred" label — a small coloured dot (green 4–5 / amber 3 / red 1–2) with tooltip showing score/5 and all active deduction reasons.
- `src/components/v75/utils/__tests__/confidenceFlags.test.ts` — 11 new tests for `computeReliabilityScore` covering: perfect horse (5), no-time (2), cascading clamp to 1, uncertain fallback (4), uncertain+flags (3), abroad (4), low multiplier (4), multiplier boundary (5 at exactly 0.5), worst-case clamp, undefined flags, undefined fields.

**Result:** pass — tsc clean, 127/127 tests pass (was 116)

**Next:** Console cleanup in `v75DataConsistencyValidator.ts` (19 console.log + 1 console.error) — opportunistic housekeeping now that major threads are closed.

<!-- stdout from run 33 2026-04-10 06:00 -->
**Run 33 complete. tsc clean, 127/127 tests pass.**

Here's what landed:

**Multi-dimensional score display**

- `confidenceFlags.ts` — `computeReliabilityScore(flags, timeSource, uncertain, historySource, confidenceMultiplier): number` (1–5). Deduction table:
  - `timeSource === 'none'` → −3 (no usable time)
  - `uncertain` → −1 (best-raw fallback)
  - `historySource === 'abroad'` → −1 (foreign-track data)
  - `confidenceMultiplier < 0.5` → −0.5 (very thin raw data)
  - `gallopRisk` → −0.5, `staleForm` → −0.5, `lowSampleSize` → −0.5, `noDriverStats` → −0.5
  - Result: floored and clamped to [1, 5]

- `CompactHorseRow.tsx` — `ReliabilityDot` component renders a small coloured dot inline with the "Pred" label: green for 4–5, amber for 3, red for 1–2. Tooltip shows `Signal X/5 — <deduction reasons>` or `Signal 5/5 — strong data basis`. Zero changes to layout, no new dependencies.

- **11 new tests** — covering all boundary conditions (perfect horse → 5, no-time → 2, cascading clamp → 1, multiplier boundary at exactly 0.5, worst-case, undefined fields).

The main open threads are now closed. Only housekeeping remains (`v75DataConsistencyValidator.ts` console cleanup).


---

## Run 34 — 2026-04-10 — MUTATE

**Goal:** Console cleanup in `v75DataConsistencyValidator.ts` — the only remaining open thread. 21 `console.log` + 2 `console.error` calls replaced with `log.debug`/`log.error` from `src/lib/logger.ts`.

**Done:**
- `src/services/v75DataConsistencyValidator.ts` — added `import { log }` from `@/lib/logger`; replaced all `console.log` calls with `log.debug` and all `console.error` calls with `log.error`. Removed emoji prefixes from error messages.

**Result:** pass — tsc clean, 127/127 tests pass.

**Next:** All open threads now closed. Next run should identify a new meaningful improvement — candidates: weight grounding via MAE-driven presets, or surfacing MAE stats more prominently in the UI.

<!-- stdout from run 34 2026-04-10 07:00 -->
Done. Run 34 complete.

**What changed:** `src/services/v75DataConsistencyValidator.ts` — added `import { log } from '@/lib/logger'`, replaced all 21 `console.log` calls with `log.debug` and both `console.error` calls with `log.error`. These diagnostic messages now only fire in debug mode (`IS_DEBUG === true`) instead of always polluting the console.

**Result:** tsc clean, 127/127 tests pass.

**All open threads are now closed.** Next meaningful candidates:
- MAE-driven weight presets (use accumulated error data to surface tuning suggestions in WeightManager)
- Surface MAE aggregate badge in the main header so users see accuracy without opening the panel


## Run 35 — 2026-04-10 — RESEARCH

**Investigated:** `raceMAEService.ts` async/await correctness; MAE panel visibility placement in `V75Analyzer.tsx`; stderr noise source in `kmTimeProcessor.test.ts`.

**Key finding:** `fetchAndComputeMAEForRace` in `raceMAEService.ts:19` calls `RaceAnalysisCache.getRaceAnalysis(raceId)` without `await`. The method is declared `static async` and returns `Promise<RaceAnalysisData | null>`. In production, `stored` is therefore a Promise object (always truthy), causing `stored.horses` at line 43 to be `undefined` — the `for` loop throws `TypeError: undefined is not iterable`. The MAE "Compute" button would always fail at runtime. Tests pass because the test mock at `raceMAEService.test.ts:25` returns synchronously (`_analysisStore[raceId] ?? null`), masking the bug entirely. TypeScript does not catch this (loose tsconfig: `strict: false`, project references may use stale cache).

**Secondary finding:** `MAEPanel` is only mounted when `showCacheManager` is true (V75Analyzer.tsx:265). Users see it only if they open the Cache/Trash drawer — there's no persistent accuracy indicator anywhere else in the UI.

**Tertiary finding:** `log.warn(` at `kmTimeProcessor.ts:113` is not gated behind IS_DEBUG. In the test at `kmTimeProcessor.test.ts:26-43`, the mock returns `null` for historical data, triggering the NO HISTORICAL DATA warn path on every test run. `log.warn` always calls `console.warn` regardless of debug mode.

**Implication:** The MAE feature added in Run 32 is silently broken in production. The async/await mismatch is invisible to tests and TypeScript (due to the synchronous test mock and loose tsconfig). Users who click "Compute" for any race would get a "Not finished or no matches" error (from the catch in MAEPanel) or a runtime TypeError — never seeing actual accuracy data even for completed races.

**Suggested next move:** Mutate `src/services/raceMAEService.ts:19` — add `await` before `RaceAnalysisCache.getRaceAnalysis(raceId)`. One-line fix. No type changes needed (the existing `if (!stored)` null-guard already handles the `null` case correctly once the value is actually awaited). Verify with `tsc --noEmit` and `vitest run`.

<!-- stdout from run 35 2026-04-10 08:00 -->
---

**Run 35 complete.**

## Finding: Critical production bug in `raceMAEService.ts`

**Root cause:** `src/services/raceMAEService.ts:19` is missing `await`:

```typescript
// Current (broken in production):
const stored = RaceAnalysisCache.getRaceAnalysis(raceId);

// Fix:
const stored = await RaceAnalysisCache.getRaceAnalysis(raceId);
```

`getRaceAnalysis` is declared `static async` and returns `Promise<RaceAnalysisData | null>`. Without `await`, `stored` is always a truthy Promise object — the null guard never triggers, and `stored.horses` at line 43 is `undefined`, causing `TypeError: undefined is not iterable` every time the user clicks "Compute" in MAEPanel.

**Why it was invisible:** The test mock at `raceMAEService.test.ts:25` returns the data synchronously, so tests see real data instead of a Promise and pass cleanly. TypeScript doesn't catch it either (likely due to project reference cache or the `strict: false` in `tsconfig.app.json`).

**Impact:** The entire MAE feature — the accuracy feedback loop added in Run 32 — is non-functional in production. No user who clicks "Compute" has ever gotten a result.

**Fix for next mutate run:** One-line change at `raceMAEService.ts:19`. Tests should still pass unchanged since the mock behavior is unaffected. `tsc --noEmit` + 127/127 tests should confirm clean.


<!-- stdout from run 36 2026-04-10 09:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 1pm (Europe/Stockholm)


<!-- stdout from run 36 2026-04-10 10:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 1pm (Europe/Stockholm)


<!-- stdout from run 36 2026-04-10 11:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 1pm (Europe/Stockholm)


<!-- stdout from run 36 2026-04-10 12:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 1pm (Europe/Stockholm)


## Run 36 — 2026-04-10 — MUTATE

**Goal:** Fix CRITICAL thread — missing `await` in `raceMAEService.ts` breaking MAE compute in production. Also fix 3 pre-existing test failures caused by `FORM_SCALE_S` changing from 0.05 → 0.30 without test updates.
**Done:**
- `src/services/raceMAEService.ts:19` — added `await` to `RaceAnalysisCache.getRaceAnalysis(raceId)`. Without it, `stored` was always a truthy Promise object, the null-guard never fired, and `stored.horses` threw `TypeError: undefined is not iterable` at runtime.
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — updated 3 `calculateFormAdjustment` test expected values to match current `FORM_SCALE_S = 0.30` (tests were written for 0.05). All 3 now pass with correct formula comments.
**Result:** pass — tsc clean, 127/127 tests pass
**Next:** Surface aggregate MAE accuracy badge in main header (currently hidden behind Cache drawer — see open thread in ACTIVE_THREADS.md)

<!-- stdout from run 36 2026-04-10 13:00 -->
Done. Two fixes in this run:

**1. Critical bug fixed — `raceMAEService.ts:19`**
`getRaceAnalysis` is `static async`. Without `await`, `stored` was always a truthy Promise object — the null-guard never fired and `stored.horses` threw `TypeError: undefined is not iterable` at runtime. One-line fix.

**2. Pre-existing test failures fixed — 3 tests in `normalizationPipeline.test.ts`**
`FORM_SCALE_S` was changed from `0.05` → `0.30` (in a calibration run) but 3 test expected values still referenced the old scale. Updated the expected values and comments to match current constants.

Result: tsc clean, **127/127 tests pass**.


## Run 47 — 2026-04-10 — MUTATE

**Goal:** Surface MAE accuracy panel (MAEPanel was built in Run 32 but never mounted — invisible to users). Add compact accuracy badge to header toolbar. Fix kmTimeProcessor test noise.
**Done:**
- `src/components/V75Analyzer.tsx` — lazy-import `MAEPanel`; import `getAggregateMAEStats`; add `maeStats` state (lazy-init from localStorage on mount); add `useEffect` to refresh stats when cache drawer closes; add `±X.X` accuracy badge in header left section (clicking it opens cache drawer); mount `MAEPanel` below `V75CacheManager` when `showCacheManager` is true
- `src/services/kmTimeProcessor.ts:113` — `log.warn` → `log.debug` for "NO HISTORICAL DATA" (expected fallback path, not an error, was cluttering test output)
**Result:** pass — tsc clean, 127/127 tests pass
**Next:** Evaluate Run 46 weight rebalance — run MAE evaluator on recent dates via the now-visible MAEPanel, compare Rank MAE and win% vs baseline (MAE 5.289, win 30.6%). Record actual numbers and update status.json accuracy field.

<!-- stdout from run 37 2026-04-10 14:00 -->
Run 47 complete. Here's what changed:

**Problem:** `MAEPanel` was built in Run 32 but never actually mounted anywhere — users had no way to see model accuracy data.

**Fixed in `V75Analyzer.tsx`:**
- Lazy-imported `MAEPanel`
- Added `maeStats` state (lazy-init from localStorage on mount, refreshes when cache drawer closes)
- Added compact `±X.X` accuracy badge in the header left section — visible at all times when MAE data exists, clicking it opens the cache drawer
- `MAEPanel` now mounts below `V75CacheManager` when the cache drawer is open

**Bonus fix in `kmTimeProcessor.ts:113`:**
- `log.warn("NO HISTORICAL DATA…")` → `log.debug(…)` — this path is an expected fallback, not an error, and was cluttering test output

**Result:** tsc clean, 127/127 tests pass.


<!-- stdout from run 38 2026-04-10 15:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 6pm (Europe/Stockholm)


<!-- stdout from run 38 2026-04-10 16:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 6pm (Europe/Stockholm)

