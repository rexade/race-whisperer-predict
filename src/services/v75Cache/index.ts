
import { RawTimesCache } from './rawTimesCache';
import { RawTimeCandidatesCache } from './rawTimeCandidatesCache';
import { RaceAnalysisCache } from './raceAnalysisCache';
import type { RawTimeCacheInput } from './rawTimeCacheMapper';
import type { RaceAnalysisHorse } from './types';

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
    rawTimes: RawTimeCacheInput[]
  ): Promise<void> {
    return RawTimesCache.storeRawTimes(date, gameId, raceId, raceNumber, rawTimes);
  }

  static async getRawTimes(raceId: string) {
    return RawTimesCache.getRawTimes(raceId);
  }

  static async fetchUnfilteredRawTimeCandidates(raceId: string, includeRaw = false) {
    return RawTimeCandidatesCache.fetchUnfilteredCandidates(raceId, includeRaw);
  }

  static async storeRawTimeCandidates(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    candidateData: import('./types').RawTimeCandidateData
  ): Promise<void> {
    return RawTimeCandidatesCache.storeCandidates(date, gameId, raceId, raceNumber, candidateData);
  }

  static async fetchAndStoreRawTimeCandidates(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    includeRaw = false
  ) {
    return RawTimeCandidatesCache.fetchAndStoreCandidates(date, gameId, raceId, raceNumber, includeRaw);
  }

  static async getRawTimeCandidates(raceId: string) {
    return RawTimeCandidatesCache.getCandidates(raceId);
  }

  static async clearRawTimes(raceId: string): Promise<void> {
    return RawTimesCache.clearRawTimes(raceId);
  }

  static async clearAllCache(): Promise<void> {
    return RawTimesCache.clearAllCache();
  }

  static getCacheInfo() {
    return RawTimesCache.getCacheInfo();
  }

  static async getCacheInfoAsync() {
    return RawTimesCache.getCacheInfoAsync();
  }

  // Race Analysis Cache Methods
  static async storeRaceAnalysis(
    raceId: string,
    raceNumber: number,
    analysisDate: string,
    horses: RaceAnalysisHorse[]
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

  // MAE Cache Methods
  static async storeMAEResult(maeResult: import('./types').RaceMAEResult): Promise<void> {
    return RaceAnalysisCache.storeMAEResult(maeResult);
  }

  static async getMAEResult(raceId: string): Promise<import('./types').RaceMAEResult | null> {
    return RaceAnalysisCache.getMAEResult(raceId);
  }

  static async getAllMAEResults(): Promise<import('./types').RaceMAEResult[]> {
    return RaceAnalysisCache.getAllMAEResults();
  }
}
