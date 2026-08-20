
import { V75CacheService } from '../../../services/v75CacheService';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { log } from '@/lib/logger';
import { IS_DEBUG } from '@/config/game';
import { horseKeyFromRaceHorse, horseKeyFromRawTime } from '@/services/horseIdentity';
import { fromCachedRawTime } from '@/services/v75Cache/rawTimeCacheMapper';

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

      // Cache stores un-penalized time so normalization gets base + adjustment (e.g. 1:11.5 + 0.04).
      const rawKmTimes = cachedRawTimes.rawTimes.map(fromCachedRawTime);

      if (IS_DEBUG) log.debug(`✅ [V75Cache] Converted cached data:`, rawKmTimes.slice(0, 2));
      return { rawKmTimes, wasFromCache: true };
    }

    log.debug(`❌ [V75Cache] No cached data found for race ${race.raceId}, calculating fresh`);

    // Calculate raw times from scratch
    const atgStarts = race.horses.map((horse: any) => ({
      horseKey: horse.horseKey,
      horse: {
        id: horse.horseId,
        name: typeof horse.name === 'string' ? horse.name : String(horse.name)
      },
      number: horse.startNumber ?? horse.postPosition,
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
      progressCallback,
      race.date || date
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
      const rawHorseKey = horseKeyFromRawTime(rawTime);
      const horseInRace = race.horses.find((horse: any) => horseKeyFromRaceHorse(race.raceId, horse) === rawHorseKey);
      return {
        horseKey: rawHorseKey,
        horseId: rawTime.horseId,
        horseName: rawTime.horseName,
        postPosition: horseInRace?.postPosition || 1,
        allTimes: rawTime.allTimes,
        bestTime: rawTime.bestTime,
        rawBestTime: rawTime.rawBestTime,
        rawKmTime: rawTime.rawBestTime ?? rawTime.bestTime,
        bestRecordTime: rawTime.bestRecordTime,
        validTimesCount: rawTime.validTimesCount,
        isNotifiee: rawTime.isNotifiee,
        dataSource: rawTime.dataSource,
        oldestRecordDate: rawTime.oldestRecordDate,
        newestRecordDate: rawTime.newestRecordDate,
        gallopRate: rawTime.gallopRate,
        gallopCount: rawTime.gallopCount,
        lastRaceDate: rawTime.lastRaceDate,
        consistencyScore: rawTime.consistencyScore,
        gallopDates: rawTime.gallopDates,
        disqualificationCount: rawTime.disqualificationCount,
        averageOdds: rawTime.averageOdds,
        lastOdds: rawTime.lastOdds,
        horseAge: rawTime.horseAge,
        dataSourceChain: rawTime.dataSourceChain,
        usedStatisticsFallback: rawTime.usedStatisticsFallback,
        usedExtendedFallback: rawTime.usedExtendedFallback,
        usedInvalidTimeFallback: rawTime.usedInvalidTimeFallback,
        confidenceMultiplier: rawTime.confidenceMultiplier,
        warning: rawTime.warning,
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
    try {
      await V75CacheService.storeRawTimes(
        date,
        gameInfo.gameId,
        race.raceId,
        race.raceNumber,
        rawTimesForCache
      );
    } catch (error) {
      log.warn(`[V75Cache] Failed to cache raw times for race ${race.raceId}; continuing with fresh data`, error);
    }

    return { rawKmTimes, wasFromCache: false };
  };

  return {
    getOrCalculateRawTimes
  };
};
