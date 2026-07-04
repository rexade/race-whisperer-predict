/**
 * Historical Calibration Service
 *
 * Fetches a large pool of past race dates, runs predictions with given weights,
 * compares against actual results, and computes rank/time MAE.
 *
 * Phase 1 (collectCalibrationData) — expensive: many API calls to fetch race data,
 *   horse histories, and actual results for each historical date.
 * Phase 2 (evaluateWeights) — fast: pure math, no API calls, uses cached data.
 */

import { fetchV75GameInfo, fetchRaceDataForGame, V75RaceData } from '@/services/v75CalendarApi';
import { V75ResultsFetcher } from '@/components/v75/services/v75ResultsFetcher';
import { calculateRawKmTimesForRaceWithId } from '@/services/kmTimeProcessor';
import { RaceResultProcessor } from '@/components/v75/services/raceResultProcessor';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { HorseRawKmTime } from '@/services/types/kmTimeTypes';
import { V75CacheService } from '@/services/v75CacheService';
import { saveCalibrationDataset, loadCalibrationDataset, getCalibrationCacheInfo } from './calibrationDatasetCache';
import { horseKeyFromRaceHorse, horseKeyFromRawTime, makeHorseKey } from '@/services/horseIdentity';
import { plackettLuceLogLik } from './plackettLuce';

/** Strength temperature: 0.5 s predicted-time gap ≈ e:1 odds in the PL model. */
const PL_TAU_SECONDS = 0.5;
/** Only the first K placings count — deep-field order is noise. */
const PL_TOP_K = 5;

export interface ActualHorseResult {
  position: number;
  kmTime?: { minutes: number; seconds: number; tenths: number };
  /** Closing odds at race finish — used as training signal for odds weight optimization. */
  finalOdds?: number;
}

export interface RaceCalibrationData {
  raceId: string;
  raceNumber: number;
  raceData: V75RaceData;
  rawKmTimes: HorseRawKmTime[];
  /** horseKey → actual finish result */
  actualResults: Map<string, ActualHorseResult>;
}

export interface DateCalibrationData {
  date: string;
  races: RaceCalibrationData[];
}

export type CalibrationDataset = DateCalibrationData[];

export interface CalibrationEvaluation {
  /** Mean absolute error: |predicted rank − actual position|, estimated horses excluded */
  rankMAE: number;
  /**
   * Average rank we gave to the actual race winner across all races.
   * 1.0 = always ranked winner first (perfect).
   */
  winnerRankMAE: number;
  /**
   * Mean Reciprocal Rank — average of (1 / rank_given_to_winner).
   * Range 0–1. Higher = better. Rank 1 → 1.0, rank 2 → 0.5, rank 3 → 0.33.
   * This is the primary optimization target: the jump from rank 2→1 (+0.5)
   * dwarfs rank 5→4 (+0.05), so the optimizer is pulled hard toward actual wins.
   */
  winnerMRR: number;
  /** Mean absolute error of predicted km time vs actual km time in seconds */
  timeMAE: number | null;
  /**
   * Mean per-race Plackett–Luce log-likelihood of the actual finish order
   * (top-5, strengths from predicted times). Higher (closer to 0) = better.
   * Uses every placing, not just the winner — smoother optimization signal.
   */
  plLogLik: number;
  /** Fraction of predicted top-3 picks that actually placed top-3 */
  topPickAccuracy: number;
  /** Fraction of races where the actual winner was ranked in our predicted top 3 */
  winnerTop3Accuracy: number;
  /** Fraction of races where the actual winner was ranked in our predicted top 5 */
  winnerTop5Accuracy: number;
  /** Fraction of races where our #1 ranked horse actually won */
  winAccuracy: number;
  racesEvaluated: number;
  /** Horses with real km-time data (estimated-fallback horses excluded) */
  horsesEvaluated: number;
  /** Horses skipped because they had no real km-time data */
  estimatedHorsesSkipped: number;
}

export interface CollectionProgress {
  datesCompleted: number;
  datesTotal: number;
  message: string;
}

/**
 * Returns all past game dates for the last `monthsBack` months, most recent first.
 *
 * Uses the proven /calendar/day endpoint (same as the main analyzer) rather than
 * the month calendar endpoint which has unreliable structure. Checks candidate dates
 * in parallel batches to keep the scan fast.
 *
 * ATG schedules V75 on Saturdays, V86 on Wednesdays, V65 on Fridays — but we check
 * Fri/Sat/Sun/Wed to catch all game types without hardcoding per-type logic.
 */
export async function fetchHistoricalDates(monthsBack: number): Promise<string[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build candidate list: every day in the past N months.
  // We check every day so no game type (V75/V85/V86/V65) is missed
  // regardless of weekday schedule.
  const candidates: string[] = [];
  const start = new Date(today);
  start.setMonth(start.getMonth() - monthsBack);
  start.setDate(1);

  for (const d = new Date(start); d < today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0];
    if (iso < todayStr) candidates.push(iso);
  }

  // Check each candidate with fetchV75GameInfo in parallel batches of 12
  const BATCH = 12;
  const gameDates: string[] = [];

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(date => fetchV75GameInfo(date).then(info => (info ? date : null)))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) gameDates.push(r.value);
    }
  }

  return gameDates.sort((a, b) => b.localeCompare(a));
}

/**
 * Phase 1: Collect all data needed for calibration.
 *
 * First checks the persistent browser dataset cache.
 * If a cached dataset exists for the requested window, returns it instantly.
 *
 * When fetching fresh data, leverages the existing V75CacheService raw-time
 * cache (7-day TTL) so horse km-time fetches are skipped for races already
 * seen in the main analyzer.  After collection the full dataset is persisted
 * so subsequent runs are instant.
 *
 * @param monthsBack  Number of past months to cover (used as cache key)
 * @param forceRefresh  Skip the dataset cache and re-fetch everything
 */
export async function collectCalibrationData(
  dates: string[],
  onProgress?: (p: CollectionProgress) => void,
  monthsBack?: number,
  forceRefresh = false
): Promise<CalibrationDataset> {
  // Return persisted dataset if available and not forcing refresh
  if (!forceRefresh && monthsBack !== undefined) {
    const info = await getCalibrationCacheInfo(monthsBack);
    if (info.exists && info.dateCount > 0) {
      onProgress?.({ datesCompleted: 0, datesTotal: 1, message: `Loading cached dataset (${info.dateCount} dates, ${info.ageHours?.toFixed(0)}h old)…` });
      const cached = await loadCalibrationDataset(monthsBack);
      if (cached) {
        onProgress?.({ datesCompleted: 1, datesTotal: 1, message: `Loaded ${cached.length} dates from cache.` });
        return cached;
      }
    }
  }

  const dataset: CalibrationDataset = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    onProgress?.({
      datesCompleted: i,
      datesTotal: dates.length,
      message: `[${i + 1}/${dates.length}] ${date}: fetching game info…`,
    });

    try {
      const gameInfo = await fetchV75GameInfo(date);
      if (!gameInfo) continue;

      const races = await fetchRaceDataForGame(date, gameInfo);
      if (races.length === 0) continue;

      onProgress?.({
        datesCompleted: i,
        datesTotal: dates.length,
        message: `[${i + 1}/${dates.length}] ${date}: fetching actual results…`,
      });

      let actualResults: any[] = [];
      try {
        actualResults = await V75ResultsFetcher.fetchActualResults(date, gameInfo);
      } catch {
        continue;
      }
      if (actualResults.length === 0) continue;

      // Process all races for this date in parallel (3 at a time max to
      // avoid hammering the ATG API with too many concurrent horse fetches)
      const RACE_CONCURRENCY = 3;
      const dateRaces: RaceCalibrationData[] = [];

      const processRace = async (race: V75RaceData): Promise<RaceCalibrationData | null> => {
        const actualRace = actualResults.find(ar => ar.raceId === race.raceId);
        if (!actualRace?.finishOrder?.length) return null;

        // Build actualResults map: horseKey → { position, kmTime? }
        const actualMap = new Map<string, ActualHorseResult>();
        for (const finish of actualRace.finishOrder) {
          if (finish.position > 0) {
            const horseKey = finish.horseKey ?? makeHorseKey(race.raceId, finish.horseId, finish.postPosition);
            actualMap.set(horseKey, {
              position: finish.position,
              kmTime: finish.kmTime ?? undefined,
              finalOdds: finish.finalOdds != null && Number.isFinite(finish.finalOdds)
                ? finish.finalOdds : undefined,
            });
          }
        }
        if (actualMap.size === 0) return null;

        // Raw KM times: prefer existing V75CacheService entry (7-day TTL)
        let rawKmTimes: HorseRawKmTime[] = [];
        const cachedRawTimes = await V75CacheService.getRawTimes(race.raceId);

        if (cachedRawTimes) {
          rawKmTimes = cachedRawTimes.rawTimes.map(c => ({
            horseKey: c.horseKey,
            horseId: c.horseId,
            horseName: c.horseName || `Horse ${c.horseId}`,
            allTimes: [],
            bestTime: c.rawKmTime || { minutes: 0, seconds: 0, tenths: 0 },
            rawBestTime: c.rawKmTime,
            validTimesCount: c.validTimesCount || 3,
            isNotifiee: false,
            dataSource: 'recent' as const,
            gallopRate: c.gallopRate,
            lastRaceDate: c.lastRaceDate,
            consistencyScore: c.consistencyScore,
            gallopDates: c.gallopDates,
            // New fields preserved from cache — will be undefined for old cache entries
            averageOdds: (c as any).averageOdds,
            lastOdds: (c as any).lastOdds,
            horseAge: (c as any).horseAge,
            dataSourceChain: (c as any).dataSourceChain,
          }));
        } else {
          const atgStarts = race.horses.map((horse: any) => ({
            horseKey: horse.horseKey,
            horse: {
              id: horse.horseId,
              name: typeof horse.name === 'string' ? horse.name : String(horse.name),
            },
            number: horse.postPosition,
            postPosition: horse.postPosition,
            distance: horse.distance,
            driver: {
              firstName: horse.driver.firstName,
              lastName: horse.driver.lastName,
              statistics: { winPercentage: horse.driver.winPercentage },
            },
          }));

          try {
            rawKmTimes = await calculateRawKmTimesForRaceWithId(race.raceId, atgStarts, undefined, date);
            const rawTimesForCache = rawKmTimes.map(rt => {
              const rtKey = horseKeyFromRawTime(rt);
              const h = race.horses.find((x: any) => horseKeyFromRaceHorse(race.raceId, x) === rtKey);
              return {
                horseKey: rtKey, horseId: rt.horseId, horseName: rt.horseName, postPosition: h?.postPosition || 1,
                bestTime: rt.rawBestTime ?? rt.bestTime, validTimesCount: rt.validTimesCount,
                gallopRate: rt.gallopRate, lastRaceDate: rt.lastRaceDate,
                consistencyScore: rt.consistencyScore, gallopDates: rt.gallopDates,
                averageOdds: rt.averageOdds, lastOdds: rt.lastOdds,
                horseAge: rt.horseAge, dataSourceChain: rt.dataSourceChain,
              };
            });
            V75CacheService.storeRawTimes(date, gameInfo.gameId, race.raceId, race.raceNumber, rawTimesForCache).catch(() => {});
          } catch {
            // km-time history fetch failed (rate limit or network) — keep the race
            // with empty rawKmTimes. evaluateWeights will use statistical fallback
            // for horses without real km data; the race still contributes to MAE.
            rawKmTimes = [];
          }
        }

        return { raceId: race.raceId, raceNumber: race.raceNumber, raceData: race, rawKmTimes, actualResults: actualMap };
      };

      // Run races in parallel batches
      for (let j = 0; j < races.length; j += RACE_CONCURRENCY) {
        const batch = races.slice(j, j + RACE_CONCURRENCY);
        onProgress?.({ datesCompleted: i, datesTotal: dates.length, message: `[${i + 1}/${dates.length}] ${date}: races ${j + 1}–${Math.min(j + RACE_CONCURRENCY, races.length)}/${races.length}…` });
        const batchResults = await Promise.allSettled(batch.map(processRace));
        for (const r of batchResults) {
          if (r.status === 'fulfilled' && r.value) dateRaces.push(r.value);
        }
      }

      if (dateRaces.length > 0) {
        dataset.push({ date, races: dateRaces });
      }
    } catch (error) {
      console.warn(`Calibration: skipping ${date}:`, error);
    }

    onProgress?.({
      datesCompleted: i + 1,
      datesTotal: dates.length,
      message: `[${i + 1}/${dates.length}] ${date}: done (${dataset.length} dates collected so far)`,
    });
  }

  // Persist so next run is instant
  if (monthsBack !== undefined && dataset.length > 0) {
    await saveCalibrationDataset(monthsBack, dataset);
  }

  return dataset;
}

/**
 * Phase 2: Evaluate a weight configuration against the collected dataset.
 * No API calls — pure computation using cached race data + rawKmTimes.
 *
 * IMPORTANT: horses whose prediction was generated from a statistical fallback
 * (no real km-time data) are excluded from all metrics.  Including them would
 * pollute the MAE because the fallback path ignores the weights being tested —
 * it uses fixed heuristics instead.  Only horses with actual measured times
 * challenge the weight system meaningfully.
 */
export async function evaluateWeights(
  dataset: CalibrationDataset,
  weights: NormalizationWeights,
  curves?: PostPositionCurves
): Promise<CalibrationEvaluation> {
  let totalRankError = 0;
  let totalTimeDiffS = 0;
  let timeCount = 0;
  let topPicksCorrect = 0;
  let topPicksTotal = 0;
  let winCorrect = 0;
  let winTotal = 0;
  let winnerRankSum = 0;
  let winnerMRRSum = 0;
  let plLogLikSum = 0;
  let plRaceCount = 0;
  let winnerTop3Correct = 0;
  let winnerTop5Correct = 0;
  let winnerRacesCount = 0;
  let horsesEvaluated = 0;
  let estimatedHorsesSkipped = 0;
  let racesEvaluated = 0;

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      try {
        const result = await RaceResultProcessor.processRaceResult(
          race.raceData,
          race.rawKmTimes,
          weights,
          undefined, // Don't pass analysisDate — avoids DB write per evaluation step
          curves
        );

        if (!result.analysisComplete || result.horses.length === 0) continue;

        const realHorseCount = result.horses.filter(h => !h.modernNormalizedResult?.isEstimated).length;
        if (realHorseCount === 0) continue;

        estimatedHorsesSkipped += result.horses.length - realHorseCount;
        racesEvaluated++;

        // Find the actual winner (position === 1) and look up what rank WE gave them.
        // This is the primary optimization signal: lower = closer to picking the winner first.
        let actualWinnerHorseKey: string | undefined;
        for (const [horseKey, actual] of race.actualResults) {
          if (actual.position === 1) { actualWinnerHorseKey = horseKey; break; }
        }
        if (actualWinnerHorseKey !== undefined) {
          const predictedForWinner = result.horses.find(h => (h.horseKey ?? String(h.horseId)) === actualWinnerHorseKey);
          if (predictedForWinner?.rank !== undefined) {
            winnerRankSum += predictedForWinner.rank;
            winnerMRRSum += 1 / predictedForWinner.rank;
            winnerRacesCount++;
            if (predictedForWinner.rank <= 3) winnerTop3Correct++;
            if (predictedForWinner.rank <= 5) winnerTop5Correct++;
            winTotal++;
            if (predictedForWinner.rank === 1) winCorrect++;
          }
        }

        // Plackett–Luce likelihood of the finish order from predicted times
        const plEntries: Array<{ position: number; predSeconds: number }> = [];
        for (const horse of result.horses) {
          if (horse.modernNormalizedResult?.isEstimated) continue;
          const actual = race.actualResults.get(horse.horseKey ?? String(horse.horseId));
          const t = horse.modernNormalizedResult?.modernNormalizedTime;
          if (actual === undefined || !t) continue;
          plEntries.push({ position: actual.position, predSeconds: t.minutes * 60 + t.seconds + t.tenths * 0.1 });
        }
        if (plEntries.length >= 2) {
          plEntries.sort((a, b) => a.position - b.position);
          const strengths = plEntries.map(e => -e.predSeconds / PL_TAU_SECONDS);
          plLogLikSum += plackettLuceLogLik(strengths, PL_TOP_K);
          plRaceCount++;
        }

        for (const horse of result.horses) {
          if (horse.modernNormalizedResult?.isEstimated) {
            estimatedHorsesSkipped++;
            continue;
          }

          const actual = race.actualResults.get(horse.horseKey ?? String(horse.horseId));
          if (actual === undefined || !horse.rank) continue;

          totalRankError += Math.abs(horse.rank - actual.position);
          horsesEvaluated++;

          if (horse.modernNormalizedResult?.modernNormalizedTime && actual.kmTime) {
            const t = horse.modernNormalizedResult.modernNormalizedTime;
            const predS = t.minutes * 60 + t.seconds + t.tenths * 0.1;
            const actS  = actual.kmTime.minutes * 60 + actual.kmTime.seconds + actual.kmTime.tenths * 0.1;
            totalTimeDiffS += Math.abs(predS - actS);
            timeCount++;
          }

          if (horse.rank <= 3) {
            topPicksTotal++;
            if (actual.position <= 3) topPicksCorrect++;
          }
        }
      } catch {
        // Skip failed races silently
      }
    }
  }

  return {
    rankMAE:               horsesEvaluated > 0 ? totalRankError / horsesEvaluated : 999,
    winnerRankMAE:         winnerRacesCount > 0 ? winnerRankSum / winnerRacesCount : 999,
    winnerMRR:             winnerRacesCount > 0 ? winnerMRRSum / winnerRacesCount : 0,
    timeMAE:               timeCount > 0 ? totalTimeDiffS / timeCount : null,
    plLogLik:              plRaceCount > 0 ? plLogLikSum / plRaceCount : -99,
    topPickAccuracy:       topPicksTotal > 0 ? topPicksCorrect / topPicksTotal : 0,
    winnerTop3Accuracy:    winnerRacesCount > 0 ? winnerTop3Correct / winnerRacesCount : 0,
    winnerTop5Accuracy:    winnerRacesCount > 0 ? winnerTop5Correct / winnerRacesCount : 0,
    winAccuracy:           winTotal > 0 ? winCorrect / winTotal : 0,
    racesEvaluated,
    horsesEvaluated,
    estimatedHorsesSkipped,
  };
}
