
import { CachedRawTime, CachedV75RawTimes, CacheInfo } from './types';

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
    rawTimes: Array<{ horseId: number; postPosition: number; best3Average?: any }>
  ): Promise<void> {
    console.log(`💾 [RawTimesCache] Storing raw KM times cache for race ${raceNumber} (${raceId})`);
    console.log(`💾 [RawTimesCache] Input data:`, {
      rawTimesCount: rawTimes.length,
      sampleRawTime: rawTimes[0],
      allHorseIds: rawTimes.map(rt => rt.horseId)
    });
    
    const cachedRawTimes: CachedRawTime[] = rawTimes.map(rt => ({
      horseId: rt.horseId,
      postPosition: rt.postPosition,
      rawKmTime: rt.best3Average,
      cachedAt: new Date().toISOString()
    }));

    console.log(`💾 [RawTimesCache] Converted for storage:`, {
      cachedRawTimesCount: cachedRawTimes.length,
      sampleCachedTime: cachedRawTimes[0]
    });

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
      
      console.log(`✅ [RawTimesCache] Successfully cached for race ${raceNumber}:`);
      console.log(`   - ${cachedRawTimes.length} horses`);
      console.log(`   - Race ID: ${raceId}`);
      console.log(`   - Cache key: ${cacheKey}`);
      console.log(`   - First horse cached time:`, cachedRawTimes[0]?.rawKmTime);
      
    } catch (error) {
      console.error('❌ [RawTimesCache] Failed to store raw times cache:', error);
    }
  }

  static async getRawTimes(raceId: string): Promise<CachedV75RawTimes | null> {
    console.log(`🔍 [RawTimesCache] Looking for cached raw times for race ${raceId}`);
    
    try {
      const cacheKey = this.getRawTimeCacheKey(raceId);
      console.log(`🔍 [RawTimesCache] Using cache key: ${cacheKey}`);
      
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log(`❌ [RawTimesCache] No raw times cache found for race ${raceId}`);
        return null;
      }

      const rawTimesData: CachedV75RawTimes = JSON.parse(cachedData);
      console.log(`🔍 [RawTimesCache] Found cached data:`, {
        raceNumber: rawTimesData.raceNumber,
        horseCount: rawTimesData.rawTimes.length,
        firstHorseData: rawTimesData.rawTimes[0]
      });
      
      // Check if cache is still valid (raw times are cached for much longer)
      const cachedAt = new Date(rawTimesData.cachedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > CACHE_EXPIRY_HOURS) {
        console.log(`⏰ [RawTimesCache] Cache expired for race ${raceId} (${hoursDiff.toFixed(1)} hours old)`);
        this.clearRawTimes(raceId);
        return null;
      }

      console.log(`✅ [RawTimesCache] Valid cached data for race ${raceId}:`);
      console.log(`   - Cached ${hoursDiff.toFixed(1)} hours ago`);
      console.log(`   - ${rawTimesData.rawTimes.length} horses with raw times`);
      console.log(`   - Sample rawKmTime:`, rawTimesData.rawTimes[0]?.rawKmTime);
      
      return rawTimesData;
      
    } catch (error) {
      console.error(`❌ [RawTimesCache] Error reading cache for race ${raceId}:`, error);
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
