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

import { fetchV75GameInfo, fetchRaceDataForGame, fetchV75CalendarDates, V75RaceData } from '@/services/v75CalendarApi';
import { V75ResultsFetcher } from '@/components/v75/services/v75ResultsFetcher';
import { calculateRawKmTimesForRaceWithId } from '@/services/kmTimeProcessor';
import { RaceResultProcessor } from '@/components/v75/services/raceResultProcessor';
import { NormalizationWeights } from '@/services/modernKm/types';
import { HorseRawKmTime } from '@/services/types/kmTimeTypes';

export interface ActualHorseResult {
  position: number;
  kmTime?: { minutes: number; seconds: number; tenths: number };
}

export interface RaceCalibrationData {
  raceId: string;
  raceNumber: number;
  raceData: V75RaceData;
  rawKmTimes: HorseRawKmTime[];
  /** horseId → actual finish result */
  actualResults: Map<number, ActualHorseResult>;
}

export interface DateCalibrationData {
  date: string;
  races: RaceCalibrationData[];
}

export type CalibrationDataset = DateCalibrationData[];

export interface CalibrationEvaluation {
  rankMAE: number;
  timeMAE: number | null;
  /** Fraction of predicted top-3 picks that actually placed top-3 */
  topPickAccuracy: number;
  racesEvaluated: number;
  horsesEvaluated: number;
}

export interface CollectionProgress {
  datesCompleted: number;
  datesTotal: number;
  message: string;
}

/**
 * Returns all past game dates for the last `monthsBack` months, most recent first.
 */
export async function fetchHistoricalDates(monthsBack: number): Promise<string[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dates: string[] = [];

  // Fetch current month too (past days only)
  const monthsToFetch = monthsBack + 1;

  for (let m = 0; m < monthsToFetch; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    try {
      const calendarDates = await fetchV75CalendarDates(year, month);
      const pastDates = calendarDates
        .map(cd => cd.date)
        .filter(date => date < todayStr);
      dates.push(...pastDates);
    } catch {
      // Skip months that fail
    }
  }

  return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
}

/**
 * Phase 1: Collect all data needed for calibration.
 * Makes many API calls — call once, cache the result.
 */
export async function collectCalibrationData(
  dates: string[],
  onProgress?: (p: CollectionProgress) => void
): Promise<CalibrationDataset> {
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

      const dateRaces: RaceCalibrationData[] = [];

      for (let j = 0; j < races.length; j++) {
        const race = races[j];

        onProgress?.({
          datesCompleted: i,
          datesTotal: dates.length,
          message: `[${i + 1}/${dates.length}] ${date}: horse data race ${j + 1}/${races.length}…`,
        });

        const actualRace = actualResults.find(ar => ar.raceId === race.raceId);
        if (!actualRace?.finishOrder?.length) continue;

        // Build actualResults map: horseId → { position, kmTime? }
        const actualMap = new Map<number, ActualHorseResult>();
        for (const finish of actualRace.finishOrder) {
          if (finish.horseId && finish.position > 0) {
            actualMap.set(finish.horseId, {
              position: finish.position,
              kmTime: finish.kmTime ?? undefined,
            });
          }
        }
        if (actualMap.size === 0) continue;

        // Build ATG starts for km time fetch
        const atgStarts = race.horses.map((horse: any) => ({
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

        let rawKmTimes: HorseRawKmTime[] = [];
        try {
          rawKmTimes = await calculateRawKmTimesForRaceWithId(race.raceId, atgStarts);
        } catch {
          continue;
        }

        dateRaces.push({
          raceId: race.raceId,
          raceNumber: race.raceNumber,
          raceData: race,
          rawKmTimes,
          actualResults: actualMap,
        });
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
      message: `[${i + 1}/${dates.length}] ${date}: done`,
    });
  }

  return dataset;
}

/**
 * Phase 2: Evaluate a weight configuration against the collected dataset.
 * No API calls — pure computation using cached race data + rawKmTimes.
 */
export async function evaluateWeights(
  dataset: CalibrationDataset,
  weights: NormalizationWeights
): Promise<CalibrationEvaluation> {
  let totalRankError = 0;
  let totalTimeDiffS = 0;
  let timeCount = 0;
  let topPicksCorrect = 0;
  let topPicksTotal = 0;
  let horsesEvaluated = 0;
  let racesEvaluated = 0;

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      try {
        const result = await RaceResultProcessor.processRaceResult(
          race.raceData,
          race.rawKmTimes,
          weights,
          dateData.date
        );

        if (!result.analysisComplete || result.horses.length === 0) continue;
        racesEvaluated++;

        for (const horse of result.horses) {
          const actual = race.actualResults.get(horse.horseId);
          if (actual === undefined || !horse.rank) continue;

          totalRankError += Math.abs(horse.rank - actual.position);
          horsesEvaluated++;

          // Time MAE: compare predicted km time to actual km time
          if (horse.predictedTime && actual.kmTime) {
            const predS =
              horse.predictedTime.minutes * 60 +
              horse.predictedTime.seconds +
              horse.predictedTime.tenths * 0.1;
            const actS =
              actual.kmTime.minutes * 60 +
              actual.kmTime.seconds +
              actual.kmTime.tenths * 0.1;
            totalTimeDiffS += Math.abs(predS - actS);
            timeCount++;
          }

          // Top-pick accuracy
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
    rankMAE: horsesEvaluated > 0 ? totalRankError / horsesEvaluated : 999,
    timeMAE: timeCount > 0 ? totalTimeDiffS / timeCount : null,
    topPickAccuracy: topPicksTotal > 0 ? topPicksCorrect / topPicksTotal : 0,
    racesEvaluated,
    horsesEvaluated,
  };
}
