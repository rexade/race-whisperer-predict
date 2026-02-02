# Data integrity: calculations and no cross-horse leak

## Summary

**Calculations are correct and horse data is not mixed between horses**, as long as each race has unique post positions (no duplicate start numbers).

## How we ensure no data leaks

### 1. Historical fetch is per horse

- **kmTimeProcessor** loops over `starts` (one per horse). For each iteration it uses only:
  - `start.postPosition` → passed to `fetchHorseHistoricalData(raceId, postPosition)`.
  - `start.horse.id` and `start.horse.name` → used for logging and for the result object.
- **atgHistoricalApi**: `fetchHorseHistoricalData(raceId, startNumber)` calls  
  `GET /races/{raceId}/start/{startNumber}`.  
  Cache key is `"${raceId}:${startNumber}"`, so each (race, start) is cached separately.
- So each horse gets historical data for **its own** start number. No shared mutable state between loop iterations.

### 2. Raw times are keyed by horseId

- **kmTimeProcessor** pushes to `rawKmTimes` with `horseId: start.horse.id` and `horseName: start.horse.name` from the **current** `start` only.
- **horseResultProcessor** does **not** assume order. It matches by id:
  - `rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId)`.
- So even if `rawKmTimes` were in a different order than `race.horses`, each horse would still get the correct raw time. No cross-horse assignment.

### 3. Extended fallback is by horseId

- Extended race data is fetched once per race and shared, but we only **read** from it.
- We pick the horse with: `extendedRaceData.starts.find(s => s.horse.id === horseId)?.horse`.
- So extended fallback is also per horse by `horseId`; no mixing.

### 4. Worker and result building

- **analysis.worker**: receives `race` and `rawKmTimes`; calls `RaceResultProcessor.processRaceResult(race, rawKmTimes, ...)`.
- **processHorseResults** matches `rawKmTimes` to `race.horses` by `horseId` (see above).
- **buildHorseResult** is called per horse with that horse’s `horse`, `rawTimeData`, and `modernNormalizedResult`. No shared horse-level state.

## Caveat: duplicate post positions

If a race had **duplicate post positions** (two horses with the same start number), then:

- `fetchHorseHistoricalData(raceId, postPosition)` would be called twice with the same `postPosition`.
- The cache would return the **same** historical response for both.
- So both horses would get the same historical data (a form of “leak” when data is bad).

The codebase **detects** this via `dataQuality.duplicatePositions` (e.g. in enhancedAtgApi and raceDataValidator) but does not change how we call the start API. So:

- **Normal case**: unique post positions → no data leaking between horses.
- **Edge case**: duplicate post positions in the source data → two horses share the same historical fetch; this is a data-quality issue, not a bug in the matching logic.

## Kmtid (2w historical)

- **Prediction view**: we resolve kmtid by `horseId` first, then by normalized `horseName`. The resolved map is keyed by `horseId`, and each row looks up `kmtidByHorse.get(horse.horseId)`. So each horse gets at most one kmtid record, keyed by id (and name only as fallback when id is missing). No cross-horse leak from the lookup.

## Conclusion

- **Calculations**: Raw times and normalization are computed per horse using that horse’s historical data and post position; matching to horses is by `horseId`.
- **No data leaking between horses** under normal data (unique post positions). The only exception is the duplicate-post-position case above, which is a data-quality scenario.
