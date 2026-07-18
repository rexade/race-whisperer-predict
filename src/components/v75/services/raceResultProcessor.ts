import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { processHorseResults } from '../utils/horseResultProcessor';
import { extractTrackNameAsString } from '../utils/dataExtraction';
import { V75RaceResult } from '../types/raceResultTypes';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { RaceScoreCalculator } from './raceScoreCalculator';
import { loadKmTimeRecords, getKmTimeRecordsForHorse } from '../../../services/kmTimeRecords';
import { log } from '@/lib/logger';

export class RaceResultProcessor {
  /**
   * Process a single race result with all analysis steps
   * This is now a pure function suitable for Web Worker execution
   */
  static async processRaceResult(
    race: any,
    rawKmTimes: HorseRawKmTime[],
    weights: NormalizationWeights,
    analysisDate?: string,
    postPositionCurves?: PostPositionCurves
  ): Promise<V75RaceResult> {
    const safeRaceTrack = extractTrackNameAsString(race.track);
    const safeRaceName = extractTrackNameAsString(race.name);

    try {
      const horseResults = await processHorseResults(race, rawKmTimes, weights, analysisDate, postPositionCurves);

      // Enrich with km time records (first 200m / last 200m from Kmtime folder) when horse name matches
      const kmTimeData = await loadKmTimeRecords();
      const horseResultsWithKmTime = horseResults.map((h) => ({
        ...h,
        kmTimeRecords: getKmTimeRecordsForHorse(kmTimeData, h.horseName),
      }));

      // Calculate final scores and ranks for horses
      const horsesWithScores = RaceScoreCalculator.calculateScoresAndRanks(horseResultsWithKmTime);

      return {
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        distance: race.distance,
        startMethod: race.startMethod,
        track: safeRaceTrack,
        name: safeRaceName,
        date: race.date,
        prize: race.prize,
        horses: horsesWithScores,
        analysisComplete: true,
        dataQuality: race.dataQuality || {
          hasValidPostPositions: true,
          duplicatePositions: [],
          missingData: []
        }
      };
    } catch (error) {
      log.error(`Error processing race ${race.raceNumber}:`, error);

      return this.createErrorRaceResult(race, safeRaceTrack, safeRaceName);
    }
  }

  /**
   * Create a race result for error cases
   */
  private static createErrorRaceResult(race: any, safeRaceTrack: string, safeRaceName: string): V75RaceResult {
    return {
      raceId: race.raceId,
      raceNumber: race.raceNumber,
      distance: race.distance,
      startMethod: race.startMethod,
      track: safeRaceTrack,
      name: safeRaceName,
      date: race.date,
      prize: race.prize,
      horses: [],
      analysisComplete: false,
      dataQuality: {
        hasValidPostPositions: true,
        duplicatePositions: [],
        missingData: []
      }
    };
  }
}
