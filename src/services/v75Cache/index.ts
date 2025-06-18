
import { RawTimesCache } from './rawTimesCache';
import { RaceAnalysisCache } from './raceAnalysisCache';
import { LegacyMethods } from './legacyMethods';

export * from './types';

/**
 * V75 Cache Service - Unified interface for all V75 caching operations
 */
export class V75CacheService {
  // Raw Times Cache Methods
  static async storeRawTimes(
    date: string, 
    gameId: string, 
    raceId: string, 
    raceNumber: number,
    rawTimes: Array<{ horseId: number; postPosition: number; best3Average?: any }>
  ): Promise<void> {
    return RawTimesCache.storeRawTimes(date, gameId, raceId, raceNumber, rawTimes);
  }

  static async getRawTimes(raceId: string) {
    return RawTimesCache.getRawTimes(raceId);
  }

  static clearRawTimes(raceId: string): void {
    return RawTimesCache.clearRawTimes(raceId);
  }

  static clearAllCache(): void {
    return RawTimesCache.clearAllCache();
  }

  static getCacheInfo() {
    return RawTimesCache.getCacheInfo();
  }

  // Race Analysis Cache Methods
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
    return RaceAnalysisCache.storeRaceAnalysis(raceId, raceNumber, analysisDate, horses);
  }

  static async getRaceAnalysis(raceId: string) {
    return RaceAnalysisCache.getRaceAnalysis(raceId);
  }

  static async clearRaceAnalysis(raceId: string): Promise<void> {
    return RaceAnalysisCache.clearRaceAnalysis(raceId);
  }

  static async getAllRaceAnalyses() {
    return RaceAnalysisCache.getAllRaceAnalyses();
  }

  static async getCachedGameIds(): Promise<string[]> {
    return RaceAnalysisCache.getCachedGameIds();
  }

  static async hasPredictionsForDate(date: string): Promise<boolean> {
    return RaceAnalysisCache.hasPredictionsForDate(date);
  }

  // Legacy Methods (Deprecated)
  static async storeAnalysis(): Promise<void> {
    return LegacyMethods.storeAnalysis();
  }

  static async getAnalysis(): Promise<null> {
    return LegacyMethods.getAnalysis();
  }

  static clearAnalysis(date: string): void {
    return LegacyMethods.clearAnalysis(date);
  }
}
