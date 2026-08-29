
import { CachedRawTime, CachedV75RawTimes, CacheInfo } from './types';
import { RawTimeCacheInput, toCachedRawTime } from './rawTimeCacheMapper';
import { log } from '@/lib/logger';
import { apiHeaders, assertResponseOk, isPersistenceApiEnabled } from '../apiClient';

export const RAW_TIMES_SCHEMA_VERSION = 7;

export class RawTimesCache {

  static async storeRawTimes(
    date: string,
    gameId: string,
    raceId: string,
    raceNumber: number,
    rawTimes: RawTimeCacheInput[]
  ): Promise<void> {
    if (!isPersistenceApiEnabled()) return;

    log.debug(`[RawTimesCache] Storing raw KM times cache for race ${raceNumber} (${raceId})`);

    const updatedAt = new Date().toISOString();
    const cachedRawTimes: CachedRawTime[] = rawTimes.map(rt => toCachedRawTime(rt, updatedAt));

    try {
      const response = await fetch('/api/rawtimes', {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          date,
          gameId,
          raceId,
          raceNumber,
          rawTimes: cachedRawTimes,
          schemaVersion: RAW_TIMES_SCHEMA_VERSION,
        }),
      });
      assertResponseOk(response, 'Store raw times');

      log.info(`[RawTimesCache] Successfully cached for race ${raceNumber} (${cachedRawTimes.length} horses)`);
    } catch (error) {
      log.error('[RawTimesCache] Failed to store raw times cache:', error);
      throw error;
    }
  }

  static async getRawTimes(raceId: string): Promise<CachedV75RawTimes | null> {
    if (!isPersistenceApiEnabled()) return null;

    log.debug(`[RawTimesCache] Looking for cached raw times for race ${raceId}`);

    try {
      const resp = await fetch(`/api/rawtimes/${raceId}`);
      const data = await resp.json();

      if (!data) {
        log.debug(`[RawTimesCache] No raw times cache found for race ${raceId}`);
        return null;
      }

      if (data.schemaVersion !== RAW_TIMES_SCHEMA_VERSION) {
        log.info(
          `[RawTimesCache] Ignoring schema ${data.schemaVersion ?? 'missing'} cache for race ${raceId}; expected ${RAW_TIMES_SCHEMA_VERSION}`
        );
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
    if (!isPersistenceApiEnabled()) return;

    const resp = await fetch(`/api/rawtimes/${raceId}`, { method: 'DELETE', headers: apiHeaders() });
    assertResponseOk(resp, `Clear raw times ${raceId}`);
    log.debug(`Cleared raw times cache for race ${raceId}`);
  }

  static async clearAllCache(): Promise<void> {
    if (!isPersistenceApiEnabled()) return;

    const resp = await fetch('/api/rawtimes', { method: 'DELETE', headers: apiHeaders() });
    assertResponseOk(resp, 'Clear raw times cache');
    log.info(`Cleared all raw times cache entries`);
  }

  static getCacheInfo(): CacheInfo {
    // Return empty synchronously; the async version is used by CacheManager
    return { raceIds: [], totalSize: 0, cacheEntries: [] };
  }

  static async getCacheInfoAsync(): Promise<CacheInfo> {
    if (!isPersistenceApiEnabled()) return { raceIds: [], totalSize: 0, cacheEntries: [] };

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
