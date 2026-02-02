
import { V75CacheService } from '../../../services/v75CacheService';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { log } from '@/lib/logger';
import { IS_DEBUG } from '@/config/game';

export interface CacheResult {
  rawKmTimes: HorseRawKmTime[];
  wasFromCache: boolean;
}

export const useV75Cache = () => {
  const getOrCalculateRawTimes = async (
    race: any,
    gameInfo: { gameId: string },
    date: string,
    progressCallback?: (current: number, total: number) => void
  ): Promise<CacheResult> => {
    // Check for cached raw times FIRST
    log.debug(`🔍 [V75Cache] Checking cache for race ${race.raceId}`);
    const cachedRawTimes = await V75CacheService.getRawTimes(race.raceId);

    if (cachedRawTimes) {
      if (IS_DEBUG) {
        log.debug(`✅ [V75Cache] Found cached data for race ${race.raceId}:`, {
          raceNumber: cachedRawTimes.raceNumber,
          horseCount: cachedRawTimes.rawTimes.length,
          sampleHorse: cachedRawTimes.rawTimes[0]
        });
      }

      // Convert cached raw times to expected format with fallback for missing fields.
      // Cache stores un-penalized time so normalization gets base + adjustment (e.g. 1:11.5 + 0.04).
      const rawKmTimes = cachedRawTimes.rawTimes.map(cached => ({
        horseId: cached.horseId,
        horseName: cached.horseName || `Horse ${cached.horseId}`,
        allTimes: [], // Empty array for cached data
        bestTime: cached.rawKmTime || { minutes: 0, seconds: 0, tenths: 0 },
        rawBestTime: undefined, // Cache stores un-penalized; use same for both
        bestRecordTime: cached.rawKmTime || { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: cached.validTimesCount || 3,
        isNotifiee: false,
        dataSource: 'recent' as const,
        oldestRecordDate: cached.updatedAt,
        newestRecordDate: cached.updatedAt
      }));

      if (IS_DEBUG) log.debug(`✅ [V75Cache] Converted cached data:`, rawKmTimes.slice(0, 2));
      return { rawKmTimes, wasFromCache: true };
    }

    log.debug(`❌ [V75Cache] No cached data found for race ${race.raceId}, calculating fresh`);

    // Calculate raw times from scratch
    const atgStarts = race.horses.map((horse: any) => ({
      horse: {
        id: horse.horseId,
        name: typeof horse.name === 'string' ? horse.name : String(horse.name)
      },
      number: horse.postPosition,
      postPosition: horse.postPosition,
      distance: horse.distance,
      driver: {
        firstName: horse.driver.firstName,
        lastName: horse.driver.lastName,
        statistics: { winPercentage: horse.driver.winPercentage }
      }
    }));

    log.debug(`⚙️ [V75Cache] Starting fresh calculation for race ${race.raceId} with ${atgStarts.length} horses`);

    const rawKmTimes = await calculateRawKmTimesForRaceWithId(
      race.raceId,
      atgStarts,
      progressCallback
    );

    if (IS_DEBUG) {
      log.debug(`⚙️ [V75Cache] Calculation completed, got ${rawKmTimes.length} results:`,
        rawKmTimes.map(r => ({ horseId: r.horseId, horseName: r.horseName, validTimes: r.validTimesCount }))
      );
    }

    // Convert HorseRawKmTime[] to the format expected by cache service
    // We need to match horses with their post positions from the race data
    // Store un-penalized time in cache so normalization always gets base + adjustment (e.g. 1:11.5 + 0.04).
    const rawTimesForCache = rawKmTimes.map(rawTime => {
      const horseInRace = race.horses.find((horse: any) => horse.horseId === rawTime.horseId);
      const timeToCache = rawTime.rawBestTime ?? rawTime.bestTime;

      return {
        horseId: rawTime.horseId,
        horseName: rawTime.horseName,
        postPosition: horseInRace?.postPosition || 1,
        bestTime: timeToCache,
        validTimesCount: rawTime.validTimesCount
      };
    });

    if (IS_DEBUG) {
      log.debug(`💾 [V75Cache] Storing cache data for race ${race.raceId}:`, {
        raceNumber: race.raceNumber,
        horseCount: rawTimesForCache.length,
        sampleData: rawTimesForCache.slice(0, 2)
      });
    }

    // Cache the raw times for future use
    await V75CacheService.storeRawTimes(
      date,
      gameInfo.gameId,
      race.raceId,
      race.raceNumber,
      rawTimesForCache
    );

    return { rawKmTimes, wasFromCache: false };
  };

  return {
    getOrCalculateRawTimes
  };
};
