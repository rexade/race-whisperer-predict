# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

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

---

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

---

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