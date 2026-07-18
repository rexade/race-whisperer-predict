import { log } from '@/lib/logger';
import { apiHeaders } from '../apiClient';
import { RaceAnalysisData, RaceAnalysisSummary, RaceMAEResult } from './types';

export class RaceAnalysisCache {

  /**
   * Store race analysis results for post-race comparison
   */
  static async storeRaceAnalysis(
    raceId: string,
    raceNumber: number,
    analysisDate: string,
    horses: Array<{
      horseKey?: string;
      horseId: number;
      horseName: string;
      postPosition: number;
      finalScore: number;
      rank: number;
      predictedTime?: {
        minutes: number;
        seconds: number;
        tenths: number;
      };
    }>
  ): Promise<void> {
    try {
      log.debug(`Storing race analysis - Race ${raceNumber}: date=${analysisDate}, raceId=${raceId}, horses=${horses.length}`);

      const horsesWithTimes = horses.filter(h => h.predictedTime);
      log.debug(`Horses with predicted times: ${horsesWithTimes.length}`);

      horsesWithTimes.slice(0, 3).forEach(horse => {
        log.debug(`  ${horse.horseName}: ${horse.predictedTime?.minutes}:${horse.predictedTime?.seconds}.${horse.predictedTime?.tenths}`);
      });

      await fetch('/api/analysis', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ raceId, raceNumber, analysisDate, horses }),
      });

      log.debug(`Race analysis stored successfully`);

    } catch (error) {
      log.warn('Error storing race analysis:', error);
      throw error;
    }
  }

  /**
   * Get stored race analysis results
   */
  static async getRaceAnalysis(raceId: string): Promise<RaceAnalysisData | null> {
    try {
      const resp = await fetch(`/api/analysis/${raceId}`);
      const data = await resp.json();

      if (!data) return null;

      log.debug(`Retrieved race analysis - Race ${data.raceNumber}: date=${data.analysisDate}, horses=${data.horses.length}`);

      const horsesWithTimes = data.horses.filter((h: any) => h.predictedTime);
      log.debug(`Horses with predicted times: ${horsesWithTimes.length}`);

      horsesWithTimes.slice(0, 3).forEach((horse: any) => {
        log.debug(`  ${horse.horseName}: ${horse.predictedTime?.minutes}:${horse.predictedTime?.seconds}.${horse.predictedTime?.tenths}`);
      });

      return data;

    } catch (error) {
      log.warn('Error retrieving race analysis:', error);
      return null;
    }
  }

  /**
   * Clear race analysis data for a specific race
   */
  static async clearRaceAnalysis(raceId: string): Promise<void> {
    try {
      await fetch(`/api/analysis/${raceId}`, { method: 'DELETE', headers: apiHeaders() });
      log.debug(`Cleared race analysis for race ${raceId}`);
    } catch (error) {
      log.warn('Error clearing race analysis:', error);
    }
  }

  /**
   * Get all available race analyses (for listing purposes)
   */
  static async getAllRaceAnalyses(): Promise<RaceAnalysisSummary[]> {
    try {
      const resp = await fetch('/api/analysis');
      const analyses: RaceAnalysisSummary[] = await resp.json();

      log.debug(`Found ${analyses.length} race analyses in cache`);
      analyses.forEach(analysis => {
        log.debug(`  Race ${analysis.raceNumber} (${analysis.raceId}): ${analysis.analysisDate}`);
      });

      return analyses;

    } catch (error) {
      log.warn('Error getting all race analyses:', error);
      return [];
    }
  }

  /**
   * Get cached game IDs for post-race analysis
   */
  static async getCachedGameIds(): Promise<string[]> {
    try {
      const resp = await fetch('/api/analysis/dates');
      const gameIds: string[] = await resp.json();

      log.debug(`Found cached game IDs: ${gameIds.join(', ')}`);
      return gameIds;

    } catch (error) {
      log.warn('Error getting cached game IDs:', error);
      return [];
    }
  }

  /**
   * Check if predictions exist for a specific date
   */
  static async hasPredictionsForDate(date: string): Promise<boolean> {
    try {
      log.debug(`Checking predictions for date: ${date}`);

      const resp = await fetch(`/api/analysis/date/${date}`);
      const data = await resp.json();

      const hasAnalyses = data.hasPredictions;
      log.debug(`Predictions for ${date}: ${hasAnalyses ? 'FOUND' : 'NOT FOUND'} (${data.count} analyses)`);

      return hasAnalyses;

    } catch (error) {
      log.warn('Error checking predictions for date:', error);
      return false;
    }
  }

  // ─── MAE cache ───────────────────────────────────────────────────────────────

  static async storeMAEResult(maeResult: RaceMAEResult): Promise<void> {
    try {
      await fetch('/api/mae', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(maeResult),
      });
      log.debug(`MAE result stored for race ${maeResult.raceId}: meanRankError=${maeResult.meanRankError.toFixed(2)}`);
    } catch (error) {
      log.warn('Error storing MAE result:', error);
    }
  }

  static async getMAEResult(raceId: string): Promise<RaceMAEResult | null> {
    try {
      const resp = await fetch(`/api/mae/${raceId}`);
      const data = await resp.json();
      return data as RaceMAEResult | null;
    } catch (error) {
      log.warn('Error retrieving MAE result:', error);
      return null;
    }
  }

  static async getAllMAEResults(): Promise<RaceMAEResult[]> {
    try {
      const resp = await fetch('/api/mae');
      return await resp.json() as RaceMAEResult[];
    } catch (error) {
      log.warn('Error retrieving all MAE results:', error);
      return [];
    }
  }
}
