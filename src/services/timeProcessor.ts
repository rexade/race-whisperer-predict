import { ATGStartInfo } from './atgApi';
import { HorseRawTime } from './types/timeProcessorTypes';
import { processHorseTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords } from './atgHistoricalApi';

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

  console.log(`\n=== Calculating RAW times for ${starts.length} horses using REAL ATG data ===`);

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    progressCallback?.(i + 1, starts.length);

    try {
      console.log(`Processing horse ${i + 1}/${starts.length}: ${start.horse.name} (ID: ${start.horse.id})`);
      
      // Extract race ID from a typical start - we'll need to construct it properly
      // For now, we'll use a placeholder approach since we need the actual race ID
      // This would typically come from the race context
      const raceId = "2025-01-15_19_7"; // This should be passed as a parameter
      
      // Fetch historical data for this horse
      const historicalData = await fetchHorseHistoricalData(raceId, start.number);
      
      if (!historicalData.horse.results?.records) {
        console.warn(`No historical records found for horse ${start.horse.name}`);
        rawTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: 0,
          validTimesCount: 0
        });
        continue;
      }
      
      // Process and filter historical records
      const validRecords = processHistoricalRecords(historicalData.horse.results.records);
      console.log(`Found ${validRecords.length} valid historical races for ${start.horse.name}`);
      
      // Convert to the format expected by processHorseTimes
      const historicalRaces = validRecords.map(record => ({
        raceId: record.race.id,
        date: record.date,
        distance: record.start.distance,
        startMethod: record.race.startMethod,
        track: record.track.name,
        kmTime: record.kmTime as { minutes: number; seconds: number; tenths: number },
        finishOrder: parseInt(record.place!),
        postPosition: record.start.postPosition,
        galloped: record.galloped || false,
        disqualified: record.disqualified || false
      }));
      
      // Process the times using existing logic
      const horseRawTime = await processHorseTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      rawTimes.push(horseRawTime);
      
    } catch (error) {
      console.error(`Error processing times for horse ${start.horse.name}:`, error);
      
      // Create fallback data with error indication
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
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawTimes;
};

export const calculateRawTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawTime[]> => {
  const rawTimes: HorseRawTime[] = [];

  console.log(`\n=== Calculating RAW times for race ${raceId} with ${starts.length} horses ===`);
  console.log('Start mapping:', starts.map(s => `${s.number}: ${s.horse.name} (ID: ${s.horse.id})`));

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const startNumber = start.number; // Use the start number from the mapping
    progressCallback?.(i + 1, starts.length);

    try {
      console.log(`\n--- Processing horse ${i + 1}/${starts.length}: ${start.horse.name} (ID: ${start.horse.id}) ---`);
      console.log(`Using start number: ${startNumber} (post position: ${start.postPosition})`);
      
      // Fetch historical data using the start number (not post position)
      const historicalData = await fetchHorseHistoricalData(raceId, startNumber);
      
      if (!historicalData.horse.results?.records) {
        console.warn(`No historical records found for horse ${start.horse.name}`);
        rawTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: 0,
          validTimesCount: 0
        });
        continue;
      }
      
      // Process and filter historical records
      const validRecords = processHistoricalRecords(historicalData.horse.results.records);
      console.log(`Found ${validRecords.length} valid historical races for ${start.horse.name}`);
      
      // Convert to the format expected by processHorseTimes
      const historicalRaces = validRecords.map(record => ({
        raceId: record.race.id,
        date: record.date,
        distance: record.start.distance,
        startMethod: record.race.startMethod,
        track: record.track.name,
        kmTime: record.kmTime as { minutes: number; seconds: number; tenths: number },
        finishOrder: parseInt(record.place!),
        postPosition: record.start.postPosition,
        galloped: record.galloped || false,
        disqualified: record.disqualified || false
      }));
      
      // Process the times using existing logic
      const horseRawTime = await processHorseTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      rawTimes.push(horseRawTime);
      
    } catch (error) {
      console.error(`❌ Error processing times for horse ${start.horse.name} (start ${startNumber}):`, error);
      
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
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawTimes;
};
