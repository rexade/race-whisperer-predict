
import { V75CacheService } from '../../../services/v75CacheService';
import { calculateRawKmTimesForRaceWithId } from '../../../services/kmTimeProcessor';

export interface CacheResult {
  rawKmTimes: Array<{ horseId: number; best3Average: any }>;
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
    const cachedRawTimes = await V75CacheService.getRawTimes(race.raceId);
    
    if (cachedRawTimes) {
      // Convert cached raw times to expected format
      const rawKmTimes = cachedRawTimes.rawTimes.map(cached => ({
        horseId: cached.horseId,
        best3Average: cached.rawKmTime
      }));
      
      return { rawKmTimes, wasFromCache: true };
    }
    
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
    
    const rawKmTimes = await calculateRawKmTimesForRaceWithId(
      race.raceId, 
      atgStarts, 
      progressCallback
    );
    
    
    
    // Convert HorseRawKmTime[] to the format expected by cache service
    // We need to match horses with their post positions from the race data
    const rawTimesForCache = rawKmTimes.map(rawTime => {
      // Find the corresponding horse in the race to get postPosition
      const horseInRace = race.horses.find((horse: any) => horse.horseId === rawTime.horseId);
      
      return {
        horseId: rawTime.horseId,
        postPosition: horseInRace?.postPosition || 1, // fallback to 1 if not found
        best3Average: rawTime.best3Average
      };
    });
    
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
