
import { CachedRawTime, CachedV75RawTimes, CacheInfo } from './types';
import { log } from '@/lib/logger';

export class RawTimesCache {

  static async storeRawTimes(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    rawTimes: Array<{
      horseKey?: string;
      horseId: number; horseName: string; postPosition: number; bestTime?: any; rawBestTime?: any; bestRecordTime?: any;
      rawKmTime?: any; allTimes?: unknown[]; validTimesCount: number;
      gallopRate?: number; lastRaceDate?: string; consistencyScore?: number; gallopDates?: string[];
      averageOdds?: number; lastOdds?: number; horseAge?: number; dataSourceChain?: string;
      usedStatisticsFallback?: boolean; usedExtendedFallback?: boolean; usedInvalidTimeFallback?: boolean;
      confidenceMultiplier?: number;
    }>
  ): Promise<void> {
    log.debug(`[RawTimesCache] Storing raw KM times cache for race ${raceNumber} (${raceId})`);

    const cachedRawTimes: CachedRawTime[] = rawTimes.map(rt => ({
      horseKey: rt.horseKey,
      horseId: rt.horseId,
      horseName: rt.horseName,
      postPosition: rt.postPosition,
      allTimes: rt.allTimes,
      rawKmTime: rt.rawKmTime ?? rt.rawBestTime ?? rt.bestTime,
      bestTime: rt.bestTime,
      rawBestTime: rt.rawBestTime,
      bestRecordTime: rt.bestRecordTime,
      validTimesCount: rt.validTimesCount,
      updatedAt: new Date().toISOString(),
      gallopRate: rt.gallopRate,
      lastRaceDate: rt.lastRaceDate,
      consistencyScore: rt.consistencyScore,
      gallopDates: rt.gallopDates,
      averageOdds: rt.averageOdds,
      lastOdds: rt.lastOdds,
      horseAge: rt.horseAge,
      dataSourceChain: rt.dataSourceChain,
      usedStatisticsFallback: rt.usedStatisticsFallback,
      usedExtendedFallback: rt.usedExtendedFallback,
      usedInvalidTimeFallback: rt.usedInvalidTimeFallback,
      confidenceMultiplier: rt.confidenceMultiplier,
    }));

    try {
      await fetch('/api/rawtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          gameId,
          raceId,
          raceNumber,
          rawTimes: cachedRawTimes,
          schemaVersion: 6,
        }),
      });

      log.info(`[RawTimesCache] Successfully cached for race ${raceNumber} (${cachedRawTimes.length} horses)`);
    } catch (error) {
      log.error('[RawTimesCache] Failed to store raw times cache:', error);
    }
  }

  static async getRawTimes(raceId: string): Promise<CachedV75RawTimes | null> {
    log.debug(`[RawTimesCache] Looking for cached raw times for race ${raceId}`);

    try {
      const resp = await fetch(`/api/rawtimes/${raceId}`);
      const data = await resp.json();

      if (!data) {
        log.debug(`[RawTimesCache] No raw times cache found for race ${raceId}`);
        return null;
      }

      log.debug(`[RawTimesCache] Found cached data:`, {
        raceNumber: data.raceNumber,
        horseCount: data.rawTimes.length,
        firstHorseData: data.rawTimes[0]
      });

      log.debug(`[RawTimesCache] Valid cached data for race ${raceId}:`);
      log.debug(`   - ${data.rawTimes.length} horses with raw times`);
      log.debug(`   - Sample rawKmTime:`, data.rawTimes[0]?.rawKmTime);

      return data;

    } catch (error) {
      log.error(`[RawTimesCache] Error reading cache for race ${raceId}:`, error);
      return null;
    }
  }

  static async clearRawTimes(raceId: string): Promise<void> {
    const resp = await fetch(`/api/rawtimes/${raceId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Failed to clear raw times for ${raceId}: ${resp.status}`);
    log.debug(`Cleared raw times cache for race ${raceId}`);
  }

  static async clearAllCache(): Promise<void> {
    const resp = await fetch('/api/rawtimes', { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Failed to clear raw times cache: ${resp.status}`);
    log.info(`Cleared all raw times cache entries`);
  }

  static getCacheInfo(): CacheInfo {
    // Return empty synchronously; the async version is used by CacheManager
    return { raceIds: [], totalSize: 0, cacheEntries: [] };
  }

  static async getCacheInfoAsync(): Promise<CacheInfo> {
    try {
      const resp = await fetch('/api/rawtimes');
      const rows: Array<{ raceId: string; raceNumber: number; date: string; horseCount: number }> = await resp.json();
      return {
        raceIds: rows.map(r => r.raceId),
        totalSize: 0, // not meaningful for DB storage
        cacheEntries: rows.map(r => ({
          raceId: r.raceId,
          raceNumber: r.raceNumber,
          date: r.date,
          horseCount: r.horseCount,
        })),
      };
    } catch {
      return { raceIds: [], totalSize: 0, cacheEntries: [] };
    }
  }
}
