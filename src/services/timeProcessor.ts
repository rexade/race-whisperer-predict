
import { ATGStartInfo } from './atgApi';
import { HorseRawTime } from './types/timeProcessorTypes';
import { processHorseTimes } from './horseProcessing';
import { generateSimulatedHistory } from './utils/simulationUtils';

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
      // For now, we'll simulate historical data since we don't have the exact API endpoint
      // In a real implementation, you'd fetch actual historical races for each horse
      const simulatedHistoricalRaces = generateSimulatedHistory(
        start.horse.id, 
        start.horse.name
      );

      const horseRawTime = await processHorseTimes(
        start.horse.id,
        start.horse.name,
        simulatedHistoricalRaces
      );

      rawTimes.push(horseRawTime);
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
