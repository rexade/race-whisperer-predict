import { log } from '@/lib/logger';
import { RaceAnalysisData, RaceAnalysisSummary, RaceMAEResult } from './types';

export class RaceAnalysisCache {
  private static get storage(): Storage | null {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

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
      const key = `v75_race_analysis_${raceId}`;
      
      const analysisData: RaceAnalysisData = {
        raceId,
        raceNumber,
        analysisDate,
        timestamp: new Date().toISOString(),
        horses
      };
      
      // Debug logging for storage verification
      log.debug(`Storing race analysis - Race ${raceNumber}: date=${analysisDate}, key=${key}, horses=${horses.length}`);

      const horsesWithTimes = horses.filter(h => h.predictedTime);
      log.debug(`Horses with predicted times: ${horsesWithTimes.length}`);

      horsesWithTimes.slice(0, 3).forEach(horse => {
        log.debug(`  ${horse.horseName}: ${horse.predictedTime?.minutes}:${horse.predictedTime?.seconds}.${horse.predictedTime?.tenths}`);
      });

      if (!this.storage) {
        log.debug('Race analysis storage skipped (worker context — no localStorage)');
        return;
      }
      this.storage.setItem(key, JSON.stringify(analysisData));

      log.debug(`Race analysis stored successfully`);
      
    } catch (error) {
      log.warn('Error storing race analysis:', error);
      throw error;
    }
  }

  /**
   * Get stored race analysis results with enhanced debugging
   */
  static async getRaceAnalysis(raceId: string): Promise<RaceAnalysisData | null> {
    try {
      const key = `v75_race_analysis_${raceId}`;
      const stored = this.storage?.getItem(key);

      if (!stored) {
        return null;
      }

      const analysisData = JSON.parse(stored);

      // Debug logging for retrieval verification
      log.debug(`Retrieved race analysis - Race ${analysisData.raceNumber}: date=${analysisData.analysisDate}, horses=${analysisData.horses.length}`);

      const horsesWithTimes = analysisData.horses.filter((h: any) => h.predictedTime);
      log.debug(`Horses with predicted times: ${horsesWithTimes.length}`);

      horsesWithTimes.slice(0, 3).forEach((horse: any) => {
        log.debug(`  ${horse.horseName}: ${horse.predictedTime?.minutes}:${horse.predictedTime?.seconds}.${horse.predictedTime?.tenths}`);
      });

      return analysisData;
      
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
      const key = `v75_race_analysis_${raceId}`;
      this.storage?.removeItem(key);
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
      const analyses: RaceAnalysisSummary[] = [];
      
      const store = this.storage;
      if (!store) return [];

      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);

        if (key?.startsWith('v75_race_analysis_')) {
          const stored = store.getItem(key);
          if (stored) {
            const analysisData = JSON.parse(stored);
            analyses.push({
              raceId: analysisData.raceId,
              raceNumber: analysisData.raceNumber,
              analysisDate: analysisData.analysisDate,
              timestamp: analysisData.timestamp
            });
          }
        }
      }
      
      log.debug(`Found ${analyses.length} race analyses in cache`);
      analyses.forEach(analysis => {
        log.debug(`  Race ${analysis.raceNumber} (${analysis.raceId}): ${analysis.analysisDate}`);
      });
      
      // Sort by date and race number
      analyses.sort((a, b) => {
        const dateCompare = b.analysisDate.localeCompare(a.analysisDate);
        if (dateCompare !== 0) return dateCompare;
        return a.raceNumber - b.raceNumber;
      });
      
      return analyses;
      
    } catch (error) {
      log.warn('Error getting all race analyses:', error);
      return [];
    }
  }

  /**
   * Get cached game IDs for post-race analysis
   * This checks if we have race analyses for a given date
   */
  static async getCachedGameIds(): Promise<string[]> {
    try {
      const gameIds: string[] = [];
      
      // Check for race analyses
      const raceAnalyses = await this.getAllRaceAnalyses();
      
      // Group by date to create game IDs
      const dateSet = new Set<string>();
      raceAnalyses.forEach(analysis => {
        dateSet.add(analysis.analysisDate);
      });
      
      // Convert dates to game ID format
      dateSet.forEach(date => {
        gameIds.push(`v75-${date}`);
      });
      
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

      const raceAnalyses = await this.getAllRaceAnalyses();
      const matchingAnalyses = raceAnalyses.filter(analysis => analysis.analysisDate === date);

      log.debug(`Found ${matchingAnalyses.length} analyses for ${date}`);
      matchingAnalyses.forEach(analysis => {
        log.debug(`  Race ${analysis.raceNumber} (${analysis.raceId}): stored on ${analysis.timestamp}`);
      });

      const hasAnalyses = matchingAnalyses.length > 0;
      log.debug(`Predictions for ${date}: ${hasAnalyses ? 'FOUND' : 'NOT FOUND'}`);

      return hasAnalyses;

    } catch (error) {
      log.warn('Error checking predictions for date:', error);
      return false;
    }
  }

  // ─── MAE cache ───────────────────────────────────────────────────────────────

  static storeMAEResult(maeResult: RaceMAEResult): void {
    try {
      localStorage.setItem(`v75_mae_${maeResult.raceId}`, JSON.stringify(maeResult));
      log.debug(`MAE result stored for race ${maeResult.raceId}: meanRankError=${maeResult.meanRankError.toFixed(2)}`);
    } catch (error) {
      log.warn('Error storing MAE result:', error);
    }
  }

  static getMAEResult(raceId: string): RaceMAEResult | null {
    try {
      const stored = localStorage.getItem(`v75_mae_${raceId}`);
      return stored ? (JSON.parse(stored) as RaceMAEResult) : null;
    } catch (error) {
      log.warn('Error retrieving MAE result:', error);
      return null;
    }
  }

  static getAllMAEResults(): RaceMAEResult[] {
    try {
      const results: RaceMAEResult[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('v75_mae_')) {
          const stored = localStorage.getItem(key);
          if (stored) results.push(JSON.parse(stored) as RaceMAEResult);
        }
      }
      results.sort((a, b) => b.analysisDate.localeCompare(a.analysisDate) || a.raceNumber - b.raceNumber);
      return results;
    } catch (error) {
      log.warn('Error retrieving all MAE results:', error);
      return [];
    }
  }
}
