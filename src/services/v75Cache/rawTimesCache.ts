
import { CachedRawTime, CachedV75RawTimes, CacheInfo } from './types';
import { log } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'v75_raw_times_';
const CACHE_EXPIRY_HOURS = 168; // 7 days - raw times never change

export class RawTimesCache {
  private static getRawTimeCacheKey(raceId: string): string {
    return `${CACHE_KEY_PREFIX}${raceId}`;
  }

  static async storeRawTimes(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    rawTimes: Array<{ horseId: number; horseName: string; postPosition: number; bestTime?: any; validTimesCount: number }>
  ): Promise<void> {
    log.debug(`💾 [RawTimesCache] Storing raw KM times cache for race ${raceNumber} (${raceId})`);

    const cachedRawTimes: CachedRawTime[] = rawTimes.map(rt => ({
      horseId: rt.horseId,
      horseName: rt.horseName,
      postPosition: rt.postPosition,
      rawKmTime: rt.bestTime,
      validTimesCount: rt.validTimesCount,
      updatedAt: new Date().toISOString()
    }));

    const cacheData: CachedV75RawTimes = {
      date,
      gameId,
      raceId,
      raceNumber,
      rawTimes: cachedRawTimes,
      cachedAt: new Date().toISOString(),
      schemaVersion: 4
    };

    try {
      const cacheKey = this.getRawTimeCacheKey(raceId);
      const serialized = JSON.stringify(cacheData);
      try {
        localStorage.setItem(cacheKey, serialized);
      } catch {
        // Storage full — evict old raw-times and analysis entries, then retry once
        Object.keys(localStorage)
          .filter(k => k.startsWith('v75_raw_times_') || k.startsWith('v75_race_analysis_') || k.startsWith('v75_mae_'))
          .forEach(k => localStorage.removeItem(k));
        try {
          localStorage.setItem(cacheKey, serialized);
        } catch {
          log.warn('[RawTimesCache] Storage still full after eviction — skipping cache');
          return;
        }
      }

      log.info(`✅ [RawTimesCache] Successfully cached for race ${raceNumber} (${cachedRawTimes.length} horses)`);

    } catch (error) {
      log.error('❌ [RawTimesCache] Failed to store raw times cache:', error);
    }
  }

  static async getRawTimes(raceId: string): Promise<CachedV75RawTimes | null> {
    log.debug(`🔍 [RawTimesCache] Looking for cached raw times for race ${raceId}`);

    try {
      const cacheKey = this.getRawTimeCacheKey(raceId);
      // log.debug(`🔍 [RawTimesCache] Using cache key: ${cacheKey}`);

      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) {
        log.debug(`❌ [RawTimesCache] No raw times cache found for race ${raceId}`);
        return null;
      }

      let rawTimesData: CachedV75RawTimes = JSON.parse(cachedData);

      // Migration from schema version 1/2/3 to 4 (Force refresh to clear penalized times and switch to Best Time logic)
      if (!rawTimesData.schemaVersion || rawTimesData.schemaVersion < 4) {
        log.warn(`🔄 [RawTimesCache] Cache schema v${rawTimesData.schemaVersion || 1} is outdated (v4 required). Invalidating to force fresh calculation.`);
        localStorage.removeItem(cacheKey);
        return null;
      }

      log.debug(`🔍 [RawTimesCache] Found cached data:`, {
        raceNumber: rawTimesData.raceNumber,
        horseCount: rawTimesData.rawTimes.length,
        firstHorseData: rawTimesData.rawTimes[0]
      });

      // Check if cache is still valid (raw times are cached for much longer)
      const cachedAt = new Date(rawTimesData.cachedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > CACHE_EXPIRY_HOURS) {
        log.debug(`⏰ [RawTimesCache] Cache expired for race ${raceId} (${hoursDiff.toFixed(1)} hours old)`);
        this.clearRawTimes(raceId);
        return null;
      }

      log.debug(`✅ [RawTimesCache] Valid cached data for race ${raceId}:`);
      log.debug(`   - Cached ${hoursDiff.toFixed(1)} hours ago`);
      log.debug(`   - ${rawTimesData.rawTimes.length} horses with raw times`);
      log.debug(`   - Sample rawKmTime:`, rawTimesData.rawTimes[0]?.rawKmTime);

      return rawTimesData;

    } catch (error) {
      log.error(`❌ [RawTimesCache] Error reading cache for race ${raceId}:`, error);
      return null;
    }
  }

  static clearRawTimes(raceId: string): void {
    const cacheKey = this.getRawTimeCacheKey(raceId);
    localStorage.removeItem(cacheKey);
    log.debug(`🗑️ Cleared raw times cache for race ${raceId}`);
  }

  static clearAllCache(): void {
    const keys = Object.keys(localStorage);
    const rawTimeKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));

    rawTimeKeys.forEach(key => localStorage.removeItem(key));
    log.info(`🗑️ Cleared ${rawTimeKeys.length} raw times cache entries`);
  }

  static getCacheInfo(): CacheInfo {
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
}
