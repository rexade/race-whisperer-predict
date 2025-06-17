
import { ATGStartInfo } from './atgApi';
import { HorseRawTime } from './types/timeProcessorTypes';
import { processHorseTimes } from './horseProcessing';

// Re-export types and utilities for backward compatibility
export type { ProcessedTime, HorseRawTime } from './types/timeProcessorTypes';
export { convertKmTimeToSeconds } from './utils/timeConversion';
export { normalizeTimeSimplified } from './utils/timeNormalization';
export { processHorseTimes } from './horseProcessing';

export const calculateRawTimesForRace = async (
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawTime[]> => {
  const rawTimes: HorseRawTime[] = [];

  console.log(`\n=== Calculating RAW times for ${starts.length} horses ===`);

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    progressCallback?.(i + 1, starts.length);

    try {
      // Fetch actual historical data from ATG API
      // This would require the proper API endpoint for horse historical data
      console.warn(`Historical data fetching not yet implemented for horse ${start.horse.name}`);
      
      // Create placeholder data indicating no historical data available
      rawTimes.push({
        horseId: start.horse.id,
        horseName: start.horse.name,
        allTimes: [],
        best3Average: 0,
        validTimesCount: 0
      });
    } catch (error) {
      console.error(`Error processing times for horse ${start.horse.name}:`, error);
      
      // Create fallback data
      rawTimes.push({
        horseId: start.horse.id,
        horseName: start.horse.name,
        allTimes: [],
        best3Average: 0,
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW time (best first)
  rawTimes.sort((a, b) => {
    if (a.best3Average === 0 && b.best3Average === 0) return 0;
    if (a.best3Average === 0) return 1;
    if (b.best3Average === 0) return -1;
    return a.best3Average - b.best3Average;
  });

  console.log(`\n=== Final RAW Time Rankings ===`);
  rawTimes.forEach((horse, index) => {
    if (horse.best3Average > 0) {
      console.log(`${index + 1}. ${horse.horseName}: ${horse.best3Average.toFixed(2)}s (${horse.validTimesCount} races)`);
    }
  });

  return rawTimes;
};
