export interface CachedRawTime {
  horseId: number;
  postPosition: number;
  rawKmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  cachedAt: string;
}

export interface CachedV75RawTimes {
  date: string;
  gameId: string;
  raceId: string;
  raceNumber: number;
  rawTimes: CachedRawTime[];
  cachedAt: string;
}

const CACHE_KEY_PREFIX = 'v75_raw_times_';
const CACHE_EXPIRY_HOURS = 168; // 7 days - raw times never change

export class V75CacheService {
  private static getRawTimeCacheKey(raceId: string): string {
    return `${CACHE_KEY_PREFIX}${raceId}`;
  }

  static async storeRawTimes(
    date: string, 
    gameId: string, 
    raceId: string, 
    raceNumber: number,
    rawTimes: Array<{ horseId: number; postPosition: number; best3Average?: any }>
  ): Promise<void> {
    console.log(`💾 Storing raw KM times cache for race ${raceNumber} (${raceId})`);
    
    const cachedRawTimes: CachedRawTime[] = rawTimes.map(rt => ({
      horseId: rt.horseId,
      postPosition: rt.postPosition,
      rawKmTime: rt.best3Average,
      cachedAt: new Date().toISOString()
    }));

    const cacheData: CachedV75RawTimes = {
      date,
      gameId,
      raceId,
      raceNumber,
      rawTimes: cachedRawTimes,
      cachedAt: new Date().toISOString()
    };

    try {
      const cacheKey = this.getRawTimeCacheKey(raceId);
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      console.log(`✅ Raw KM times cached for race ${raceNumber}:`);
      console.log(`   - ${cachedRawTimes.length} horses`);
      console.log(`   - Race ID: ${raceId}`);
      console.log(`   - Raw times permanently cached`);
      
    } catch (error) {
      console.error('❌ Failed to store raw times cache:', error);
    }
  }

  static async getRawTimes(raceId: string): Promise<CachedV75RawTimes | null> {
    console.log(`🔍 Looking for cached raw times for race ${raceId}`);
    
    try {
      const cacheKey = this.getRawTimeCacheKey(raceId);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log(`❌ No raw times cache found for race ${raceId}`);
        return null;
      }

      const rawTimesData: CachedV75RawTimes = JSON.parse(cachedData);
      
      // Check if cache is still valid (raw times are cached for much longer)
      const cachedAt = new Date(rawTimesData.cachedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > CACHE_EXPIRY_HOURS) {
        console.log(`⏰ Raw times cache expired for race ${raceId} (${hoursDiff.toFixed(1)} hours old)`);
        this.clearRawTimes(raceId);
        return null;
      }

      console.log(`✅ Found valid cached raw times for race ${raceId}:`);
      console.log(`   - Cached ${hoursDiff.toFixed(1)} hours ago`);
      console.log(`   - ${rawTimesData.rawTimes.length} horses with raw times`);
      
      return rawTimesData;
      
    } catch (error) {
      console.error(`❌ Error reading raw times cache for race ${raceId}:`, error);
      return null;
    }
  }

  static clearRawTimes(raceId: string): void {
    const cacheKey = this.getRawTimeCacheKey(raceId);
    localStorage.removeItem(cacheKey);
    console.log(`🗑️ Cleared raw times cache for race ${raceId}`);
  }

  static clearAllCache(): void {
    const keys = Object.keys(localStorage);
    const rawTimeKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    rawTimeKeys.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Cleared ${rawTimeKeys.length} raw times cache entries`);
  }

  static getCacheInfo(): { raceIds: string[], totalSize: number, cacheEntries: Array<{ raceId: string; raceNumber: number; date: string; horseCount: number }> } {
    const keys = Object.keys(localStorage);
    const rawTimeKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    const raceIds = rawTimeKeys.map(key => key.replace(CACHE_KEY_PREFIX, ''));
    const cacheEntries: Array<{ raceId: string; raceNumber: number; date: string; horseCount: number }> = [];
    
    let totalSize = 0;
    
    rawTimeKeys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed: CachedV75RawTimes = JSON.parse(data);
          cacheEntries.push({
            raceId: parsed.raceId,
            raceNumber: parsed.raceNumber,
            date: parsed.date,
            horseCount: parsed.rawTimes.length
          });
        } catch (error) {
          console.warn(`Failed to parse cache entry for key ${key}:`, error);
        }
      }
    });

    return { raceIds, totalSize, cacheEntries };
  }

  // Legacy methods for backward compatibility - now deprecated
  static async storeAnalysis(): Promise<void> {
    console.warn('⚠️ storeAnalysis is deprecated - use storeRawTimes instead');
  }

  static async getAnalysis(): Promise<null> {
    console.warn('⚠️ getAnalysis is deprecated - use getRawTimes instead');
    return null;
  }

  static clearAnalysis(date: string): void {
    console.warn('⚠️ clearAnalysis is deprecated - use clearRawTimes instead');
  }

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
    }>
  ): Promise<void> {
    try {
      const key = `v75_race_analysis_${raceId}`;
      
      const analysisData = {
        raceId,
        raceNumber,
        analysisDate,
        timestamp: new Date().toISOString(),
        horses
      };
      
      localStorage.setItem(key, JSON.stringify(analysisData));
      
      console.log(`💾 Stored race analysis for race ${raceNumber} (${raceId})`);
      
    } catch (error) {
      console.error('❌ Error storing race analysis:', error);
      throw error;
    }
  }

  /**
   * Get stored race analysis results
   */
  static async getRaceAnalysis(raceId: string): Promise<{
    raceId: string;
    raceNumber: number;
    analysisDate: string;
    timestamp: string;
    horses: Array<{
      horseId: number;
      horseName: string;
      postPosition: number;
      finalScore: number;
      rank: number;
    }>;
  } | null> {
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
  static async getAllRaceAnalyses(): Promise<Array<{
    raceId: string;
    raceNumber: number;
    analysisDate: string;
    timestamp: string;
  }>> {
    try {
      const analyses: Array<{
        raceId: string;
        raceNumber: number;
        analysisDate: string;
        timestamp: string;
      }> = [];
      
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
