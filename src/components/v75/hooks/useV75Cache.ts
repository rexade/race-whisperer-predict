
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
      console.log(`🚀 CACHE HIT! Using cached raw times for race ${race.raceNumber}`);
      
      // Convert cached raw times to expected format
      const rawKmTimes = cachedRawTimes.rawTimes.map(cached => ({
        horseId: cached.horseId,
        best3Average: cached.rawKmTime
      }));
      
      console.log(`✅ Loaded ${rawKmTimes.length} cached raw times for race ${race.raceNumber}`);
      return { rawKmTimes, wasFromCache: true };
    }

    console.log(`📊 No cache found, calculating raw times for race ${race.raceNumber}`);
    
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
    
    console.log(`📈 RAW KM times calculated for ${rawKmTimes.length} horses`);
    
    // Cache the raw times for future use
    await V75CacheService.storeRawTimes(
      date,
      gameInfo.gameId,
      race.raceId,
      race.raceNumber,
      rawKmTimes
    );
    
    console.log(`💾 Raw times cached for race ${race.raceNumber}`);
    
    return { rawKmTimes, wasFromCache: false };
  };

  return {
    getOrCalculateRawTimes
  };
};
