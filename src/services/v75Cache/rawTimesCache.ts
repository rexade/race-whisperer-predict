
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
