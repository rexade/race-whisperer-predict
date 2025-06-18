
import { NormalizationWeights } from '../../../services/modernKm/index';
import { processHorseResults } from '../utils/horseResultProcessor';
import { extractTrackNameAsString } from '../utils/dataExtraction';
import { V75CacheService } from '../../../services/v75CacheService';
import { V75RaceResult } from '../types/raceResultTypes';
import { RaceScoreCalculator } from './raceScoreCalculator';

export class RaceResultProcessor {
  /**
   * Process a single race result with all analysis steps
   */
  static processRaceResult(
    race: any,
    rawKmTimes: Array<{ horseId: number; best3Average: any }>,
    weights: NormalizationWeights,
    analysisDate?: string
  ): V75RaceResult {
    const safeRaceTrack = extractTrackNameAsString(race.track);
    const safeRaceName = extractTrackNameAsString(race.name);
    
    try {
      const horseResults = processHorseResults(race, rawKmTimes, weights);
      
      // Calculate final scores and ranks for horses
      const horsesWithScores = RaceScoreCalculator.calculateScoresAndRanks(horseResults);

      // Store analysis results with the correct date (race date, not today's date)
      const analysisHorses = RaceScoreCalculator.prepareAnalysisData(horsesWithScores);

      // Use the race date for analysis storage instead of today's date
      const cacheDate = analysisDate || race.date || new Date().toISOString().split('T')[0];
      
      console.log(`💾 Storing race analysis for race ${race.raceNumber} with date: ${cacheDate}`);
      
      // Store the analysis asynchronously (don't block the UI)
      V75CacheService.storeRaceAnalysis(
        race.raceId,
        race.raceNumber,
        cacheDate,
        analysisHorses
      ).catch(error => {
        console.warn('Failed to store race analysis:', error);
      });

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
      console.error(`❌ Error processing race ${race.raceNumber}:`, error);
      
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
