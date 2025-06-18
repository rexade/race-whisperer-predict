
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
      console.log(`📅 Analysis date stored: ${analysisDate}`);
      console.log(`🔑 Storage key: ${key}`);
      console.log(`🐎 Horse data sample:`, horses.slice(0, 2).map(h => ({
        horseId: h.horseId,
        horseName: h.horseName,
        finalScore: h.finalScore,
        rank: h.rank,
        hasPredictedTime: !!h.predictedTime
      })));
      
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
        console.log(`📋 Checking all localStorage keys for race analyses...`);
        
        // Debug: List all available race analysis keys
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('v75_race_analysis_')) {
            allKeys.push(key);
          }
        }
        console.log(`🗂️ Found ${allKeys.length} race analysis entries:`, allKeys);
        
        return null;
      }
      
      const analysisData = JSON.parse(stored);
      console.log(`📊 Retrieved race analysis for race ${analysisData.raceNumber}`);
      console.log(`📅 Analysis date: ${analysisData.analysisDate}`);
      console.log(`🐎 Horse count: ${analysisData.horses.length}`);
      
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
      
      console.log(`🔍 Scanning localStorage for race analyses...`);
      
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
      
      console.log(`📋 Found ${analyses.length} race analyses in cache`);
      analyses.forEach(analysis => {
        console.log(`  - Race ${analysis.raceNumber} (${analysis.raceId}): ${analysis.analysisDate}`);
      });
      
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
      console.log(`🔍 Checking predictions for date: ${date}`);
      
      const raceAnalyses = await this.getAllRaceAnalyses();
      const matchingAnalyses = raceAnalyses.filter(analysis => analysis.analysisDate === date);
      
      console.log(`📊 Found ${matchingAnalyses.length} analyses for ${date}:`);
      matchingAnalyses.forEach(analysis => {
        console.log(`  - Race ${analysis.raceNumber} (${analysis.raceId}): stored on ${analysis.timestamp}`);
      });
      
      const hasAnalyses = matchingAnalyses.length > 0;
      console.log(`🎯 Predictions for ${date}: ${hasAnalyses ? 'FOUND' : 'NOT FOUND'}`);
      
      return hasAnalyses;
      
    } catch (error) {
      console.error('❌ Error checking predictions for date:', error);
      return false;
    }
  }
}
