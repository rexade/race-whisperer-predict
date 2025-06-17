
import { ProcessedTime, HorseRawTime } from './types/timeProcessorTypes';
import { convertKmTimeToSeconds } from './utils/timeConversion';
import { normalizeTimeSimplified } from './utils/timeNormalization';

// Updated interface to match ATG API structure
export interface ATGHistoricalRace {
  raceId: string;
  date: string;
  distance: number;
  startMethod: string;
  track: string;
  kmTime: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  finishOrder: number;
  postPosition: number;
  galloped: boolean;
  disqualified: boolean;
}

export const processHorseTimes = async (
  horseId: number, 
  horseName: string, 
  historicalRaces: ATGHistoricalRace[]
): Promise<HorseRawTime> => {
  const processedTimes: ProcessedTime[] = [];

  console.log(`\n=== Processing times for ${horseName} (ID: ${horseId}) ===`);
  console.log(`Found ${historicalRaces.length} historical races to process`);

  for (const race of historicalRaces) {
    // Skip if no time recorded or horse was disqualified/galloped
    if (!race.kmTime || race.disqualified || race.galloped) {
      console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
      continue;
    }

    try {
      const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
      
      // Apply simplified normalization
      const normalizedTime = normalizeTimeSimplified(
        originalTimeSeconds,
        race.distance,
        race.startMethod
      );

      console.log(`${race.date}: ${originalTimeSeconds.toFixed(1)}s → ${normalizedTime.toFixed(1)}s (${race.distance}m ${race.startMethod}, place ${race.finishOrder})`);

      processedTimes.push({
        originalTime: originalTimeSeconds,
        normalizedTime: normalizedTime,
        raceDate: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        finishOrder: race.finishOrder,
        valid: true
      });
    } catch (error) {
      console.error(`Error processing race ${race.date} for ${horseName}:`, error);
      continue;
    }
  }

  // Sort by normalized time (best/fastest first)
  processedTimes.sort((a, b) => a.normalizedTime - b.normalizedTime);

  // Calculate best 3 average (RAW TIME)
  const best3Times = processedTimes.slice(0, 3);
  const best3Average = best3Times.length > 0 
    ? best3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / best3Times.length
    : 0;

  console.log(`Processed ${processedTimes.length} valid times for ${horseName}`);
  if (best3Times.length > 0) {
    console.log(`Best 3 times: ${best3Times.map(t => t.normalizedTime.toFixed(1) + 's').join(', ')}`);
    console.log(`RAW Time (Best 3 Average): ${best3Average.toFixed(2)}s`);
  } else {
    console.log(`No valid times found for RAW time calculation`);
  }

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    best3Average,
    validTimesCount: processedTimes.length
  };
};
