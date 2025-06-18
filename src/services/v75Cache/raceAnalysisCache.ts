
import { RaceAnalysisData, RaceAnalysisSummary } from './types';

export class RaceAnalysisCache {
  /**
   * Store race analysis results for post-race comparison
   */
  static async storeRaceAnalysis(
    raceId: string,
    raceNumber: number,
    analysisDate: string,
    horses: Array<{
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
      
      localStorage.setItem(key, JSON.stringify(analysisData));
      
      console.log(`💾 Stored race analysis for race ${raceNumber} (${raceId}) with ${horses.length} horses`);
      
    } catch (error) {
      console.error('❌ Error storing race analysis:', error);
      throw error;
    }
  }

  /**
   * Get stored race analysis results
   */
  static async getRaceAnalysis(raceId: string): Promise<RaceAnalysisData | null> {
    try {
      const key = `v75_race_analysis_${raceId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        console.log(`🔍 No race analysis found for race ${raceId}`);
        return null;
      }
      
      const analysisData = JSON.parse(stored);
      console.log(`📊 Retrieved race analysis for race ${analysisData.raceNumber}`);
      
      return analysisData;
      
    } catch (error) {
      console.error('❌ Error retrieving race analysis:', error);
      return null;
    }
  }

  /**
   * Clear race analysis data for a specific race
   */
  static async clearRaceAnalysis(raceId: string): Promise<void> {
    try {
      const key = `v75_race_analysis_${raceId}`;
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared race analysis for race ${raceId}`);
    } catch (error) {
      console.error('❌ Error clearing race analysis:', error);
    }
  }

  /**
   * Get all available race analyses (for listing purposes)
   */
  static async getAllRaceAnalyses(): Promise<RaceAnalysisSummary[]> {
    try {
      const analyses: RaceAnalysisSummary[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key?.startsWith('v75_race_analysis_')) {
          const stored = localStorage.getItem(key);
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
      
      // Sort by date and race number
      analyses.sort((a, b) => {
        const dateCompare = b.analysisDate.localeCompare(a.analysisDate);
        if (dateCompare !== 0) return dateCompare;
        return a.raceNumber - b.raceNumber;
      });
      
      return analyses;
      
    } catch (error) {
      console.error('❌ Error getting all race analyses:', error);
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
      
      console.log(`📋 Found cached game IDs: ${gameIds.join(', ')}`);
      return gameIds;
      
    } catch (error) {
      console.error('❌ Error getting cached game IDs:', error);
      return [];
    }
  }

  /**
   * Check if predictions exist for a specific date
   */
  static async hasPredictionsForDate(date: string): Promise<boolean> {
    try {
      const raceAnalyses = await this.getAllRaceAnalyses();
      const hasAnalyses = raceAnalyses.some(analysis => analysis.analysisDate === date);
      
      console.log(`🔍 Checking predictions for ${date}: ${hasAnalyses ? 'Found' : 'Not found'}`);
      return hasAnalyses;
      
    } catch (error) {
      console.error('❌ Error checking predictions for date:', error);
      return false;
    }
  }
}
