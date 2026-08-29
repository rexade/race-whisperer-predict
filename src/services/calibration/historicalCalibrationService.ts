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
import { GAME_TYPE, GameType } from '@/config/game';
import { fromCachedRawTime } from '@/services/v75Cache/rawTimeCacheMapper';

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
  /**
   * How often the betting market's favourite won, over the same races and the same
   * evaluated horses. This is the number winAccuracy has to be read against: backing
   * the favourite already wins roughly a third of Swedish trotting races, so a model
   * win rate in the low thirties is consistent with adding no value at all. Null when
   * no race carried usable market data.
   */
  marketWinAccuracy: number | null;
  /** Market equivalent of winnerMRR — mean 1/(market rank given to the actual winner). */
  marketMRR: number | null;
  /** Races that had usable market data, so the coverage behind the two market figures. */
  marketRacesEvaluated: number;
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
export async function fetchHistoricalDates(
  monthsBack: number,
  gameType: GameType = GAME_TYPE
): Promise<string[]> {
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
      batch.map(date => fetchV75GameInfo(date, gameType).then(info => (info ? date : null)))
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
  forceRefresh = false,
  gameType: GameType = GAME_TYPE
): Promise<CalibrationDataset> {
  // Return persisted dataset if available and not forcing refresh
  if (!forceRefresh && monthsBack !== undefined) {
    const info = await getCalibrationCacheInfo(monthsBack, gameType);
    if (info.exists && info.dateCount > 0) {
      onProgress?.({ datesCompleted: 0, datesTotal: 1, message: `Loading cached dataset (${info.dateCount} dates, ${info.ageHours?.toFixed(0)}h old)…` });
      const cached = await loadCalibrationDataset(monthsBack, gameType);
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
      const gameInfo = await fetchV75GameInfo(date, gameType);
      if (!gameInfo) continue;

      const races = await fetchRaceDataForGame(date, gameInfo, gameType);
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
            const horseKey = finish.horseKey ?? makeHorseKey(
              race.raceId,
              finish.horseId,
              finish.startNumber ?? finish.postPosition
            );
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
          rawKmTimes = cachedRawTimes.rawTimes.map(fromCachedRawTime);
        } else {
          const atgStarts = race.horses.map((horse: any) => ({
            horseKey: horse.horseKey,
            horse: {
              id: horse.horseId,
              name: typeof horse.name === 'string' ? horse.name : String(horse.name),
            },
            number: horse.startNumber ?? horse.postPosition,
            postPosition: horse.postPosition,
            distance: horse.distance,
            driver: {
              firstName: horse.driver.firstName,
              lastName: horse.driver.lastName,
              statistics: { winPercentage: horse.driver.winPercentage },
            },
          }));

          try {
            rawKmTimes = await calculateRawKmTimesForRaceWithId(race.raceId, atgStarts, undefined, date, 'historical');
            const rawTimesForCache = rawKmTimes.map(rt => {
              const rtKey = horseKeyFromRawTime(rt);
              const h = race.horses.find((x: any) => horseKeyFromRaceHorse(race.raceId, x) === rtKey);
              return {
                ...rt,
                horseKey: rtKey,
                postPosition: h?.postPosition ?? 1,
                rawKmTime: rt.rawBestTime ?? rt.bestTime,
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
    await saveCalibrationDataset(monthsBack, dataset, gameType);
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
/**
 * Rank the evaluated horses the way the betting market did.
 *
 * Vinnare odds are the primary signal (lower = more favoured), with betDistribution
 * (spelprocent, higher = more favoured) as the fallback. The two are never mixed
 * inside one race: a ranking assembled from two different scales is not a market
 * ranking. Every evaluated horse must carry the signal, otherwise the horse missing
 * it might be the actual favourite and "market rank 1" would be a different claim
 * than it appears. Races that fall short are excluded and counted, so the coverage
 * behind the metric stays visible rather than silently shrinking it.
 */
export function marketRankByKey(
  raceData: V75RaceData,
  keys: string[]
): Map<string, number> | null {
  if (keys.length < 2) return null;

  // liveOdds is the field V75RaceData actually carries (see v75CalendarApi).
  // Annotating this map with a bare `odds?` silently made the odds branch dead
  // code — every horse typechecked and every read came back undefined — so the
  // baseline was quietly the betDistribution fallback on every race.
  const byKey = new Map<string, { liveOdds?: number; betDistribution?: number }>();
  for (const horse of raceData.horses ?? []) {
    if (horse.horseKey) byKey.set(horse.horseKey, horse);
  }
  const usable = (v?: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

  let strength: ((key: string) => number) | null = null;
  if (keys.every(k => usable(byKey.get(k)?.liveOdds))) {
    strength = k => -byKey.get(k)!.liveOdds!;
  } else if (keys.every(k => usable(byKey.get(k)?.betDistribution))) {
    strength = k => byKey.get(k)!.betDistribution!;
  }
  if (!strength) return null;

  const ranks = new Map<string, number>();
  [...keys]
    .sort((a, b) => strength!(b) - strength!(a))
    .forEach((key, index) => ranks.set(key, index + 1));
  return ranks;
}

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
  let marketWinCorrect = 0;
  let marketMRRSum = 0;
  let marketRacesEvaluated = 0;

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

        const estimatedHorseCount = result.horses.filter(
          horse => horse.modernNormalizedResult?.isEstimated
        ).length;
        estimatedHorsesSkipped += estimatedHorseCount;

        // RaceResultProcessor returns canonical score order. Filtering that order
        // makes estimated display-only horses invisible to every objective rank.
        const realHorses = result.horses.filter(horse =>
          !horse.modernNormalizedResult?.isEstimated
          && horse.modernNormalizedResult?.modernNormalizedTime
        );
        if (realHorses.length === 0) continue;

        const horseKey = (horse: (typeof realHorses)[number]) =>
          horse.horseKey ?? String(horse.horseId);
        const predictedRankByKey = new Map<string, number>();
        realHorses.forEach((horse, index) => predictedRankByKey.set(horseKey(horse), index + 1));

        // Compress actual placings over the same real-horse subset. Otherwise an
        // estimated horse still shifts every real horse's rank error indirectly.
        const realActualOrder = realHorses
          .map(horse => ({ key: horseKey(horse), actual: race.actualResults.get(horseKey(horse)) }))
          .filter(entry => entry.actual && Number.isFinite(entry.actual.position) && entry.actual.position > 0)
          .sort((a, b) => a.actual!.position - b.actual!.position);
        const actualRankByKey = new Map<string, number>();
        realActualOrder.forEach((entry, index) => actualRankByKey.set(entry.key, index + 1));

        racesEvaluated++;

        // Find the actual winner (position === 1) and look up what rank WE gave them.
        // This is the primary optimization signal: lower = closer to picking the winner first.
        let actualWinnerHorseKey: string | undefined;
        for (const [horseKey, actual] of race.actualResults) {
          if (actual.position === 1) { actualWinnerHorseKey = horseKey; break; }
        }
        if (actualWinnerHorseKey !== undefined) {
          const predictedWinnerRank = predictedRankByKey.get(actualWinnerHorseKey);
          if (predictedWinnerRank !== undefined) {
            winnerRankSum += predictedWinnerRank;
            winnerMRRSum += 1 / predictedWinnerRank;
            winnerRacesCount++;
            if (predictedWinnerRank <= 3) winnerTop3Correct++;
            if (predictedWinnerRank <= 5) winnerTop5Correct++;
            winTotal++;
            if (predictedWinnerRank === 1) winCorrect++;

            // Scored over exactly the horses the model was scored on, so the two
            // win rates are directly comparable rather than measuring different fields.
            const marketRanks = marketRankByKey(race.raceData, realHorses.map(horseKey));
            const marketWinnerRank = marketRanks?.get(actualWinnerHorseKey);
            if (marketWinnerRank !== undefined) {
              marketRacesEvaluated++;
              marketMRRSum += 1 / marketWinnerRank;
              if (marketWinnerRank === 1) marketWinCorrect++;
            }
          }
        }

        // Plackett–Luce likelihood of the finish order from predicted times
        const plEntries: Array<{ position: number; predSeconds: number }> = [];
        for (const horse of realHorses) {
          const actual = race.actualResults.get(horseKey(horse));
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

        for (const horse of realHorses) {
          const key = horseKey(horse);
          const actual = race.actualResults.get(key);
          const predictedRank = predictedRankByKey.get(key);
          const actualRank = actualRankByKey.get(key);
          if (actual === undefined || predictedRank === undefined || actualRank === undefined) continue;

          totalRankError += Math.abs(predictedRank - actualRank);
          horsesEvaluated++;

          if (horse.modernNormalizedResult?.modernNormalizedTime && actual.kmTime) {
            const t = horse.modernNormalizedResult.modernNormalizedTime;
            const predS = t.minutes * 60 + t.seconds + t.tenths * 0.1;
            const actS  = actual.kmTime.minutes * 60 + actual.kmTime.seconds + actual.kmTime.tenths * 0.1;
            totalTimeDiffS += Math.abs(predS - actS);
            timeCount++;
          }

          if (predictedRank <= 3) {
            topPicksTotal++;
            if (actualRank <= 3) topPicksCorrect++;
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
    marketWinAccuracy:     marketRacesEvaluated > 0 ? marketWinCorrect / marketRacesEvaluated : null,
    marketMRR:             marketRacesEvaluated > 0 ? marketMRRSum / marketRacesEvaluated : null,
    marketRacesEvaluated,
    racesEvaluated,
    horsesEvaluated,
    estimatedHorsesSkipped,
  };
}
