
import { ATGHistoricalRace, ATGStartInfo } from './atgApi';

export interface ProcessedTime {
  originalTime: number; // in seconds
  normalizedTime: number; // normalized using simplified formula
  raceDate: string;
  distance: number;
  startMethod: string;
  finishOrder?: number;
  valid: boolean;
}

export interface HorseRawTime {
  horseId: number;
  horseName: string;
  allTimes: ProcessedTime[];
  best3Average: number;
  validTimesCount: number;
}

export const convertKmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};

/**
 * Simplified normalization formula:
 * 1. Convert all times to seconds
 * 2. If 1640m autostart: add 3.6 seconds
 * 3. If volte start: subtract 1 second (because volte is slower, we normalize to auto equivalent)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  let normalizedTime = timeSeconds;
  
  // Step 1: If 1640m autostart, add 3.6 seconds
  if (distance === 1640 && startMethod.toLowerCase() === "auto") {
    normalizedTime += 3.6;
  }
  
  // Step 2: If volte start, subtract 1 second (normalizing to auto equivalent)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
  }
  
  return Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
};

export const processHorseTimes = async (
  horseId: number, 
  horseName: string, 
  historicalRaces: ATGHistoricalRace[]
): Promise<HorseRawTime> => {
  const processedTimes: ProcessedTime[] = [];

  console.log(`\n=== Processing times for ${horseName} (ID: ${horseId}) ===`);

  for (const race of historicalRaces) {
    // Skip if no time recorded or horse was disqualified/galloped
    if (!race.kmTime || race.disqualified || race.galloped) {
      console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
      continue;
    }

    const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
    
    // Apply simplified normalization
    const normalizedTime = normalizeTimeSimplified(
      originalTimeSeconds,
      race.distance,
      race.startMethod
    );

    console.log(`${race.date}: ${originalTimeSeconds}s → ${normalizedTime}s (${race.distance}m ${race.startMethod})`);

    processedTimes.push({
      originalTime: originalTimeSeconds,
      normalizedTime: normalizedTime,
      raceDate: race.date,
      distance: race.distance,
      startMethod: race.startMethod,
      finishOrder: race.finishOrder,
      valid: true
    });
  }

  // Sort by normalized time (best/fastest first)
  processedTimes.sort((a, b) => a.normalizedTime - b.normalizedTime);

  // Calculate best 3 average (RAW TIME)
  const best3Times = processedTimes.slice(0, 3);
  const best3Average = best3Times.length > 0 
    ? best3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / best3Times.length
    : 0;

  console.log(`Best 3 times: ${best3Times.map(t => t.normalizedTime + 's').join(', ')}`);
  console.log(`RAW Time (Best 3 Average): ${best3Average.toFixed(2)}s`);

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    best3Average,
    validTimesCount: processedTimes.length
  };
};

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
      const simulatedHistoricalRaces: ATGHistoricalRace[] = generateSimulatedHistory(
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

// Temporary function to simulate historical data with varied distances and start methods
// This should be replaced with actual API calls once we have the correct endpoints
const generateSimulatedHistory = (horseId: number, horseName: string): ATGHistoricalRace[] => {
  const races: ATGHistoricalRace[] = [];
  const raceCount = Math.floor(Math.random() * 8) + 6; // 6-13 historical races

  const distances = [1640, 2140, 2640];
  const startMethods = ["auto", "volte"];
  const tracks = ["Solvalla", "Åby", "Jägersro", "Mantorp", "Bergsåker"];

  for (let i = 0; i < raceCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 10 + Math.random() * 10)); // Every 10-20 days
    
    const distance = distances[Math.floor(Math.random() * distances.length)];
    const startMethod = startMethods[Math.floor(Math.random() * startMethods.length)];
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    
    // Generate realistic time based on distance and start method
    let baseTime;
    if (distance === 1640) {
      baseTime = startMethod === "auto" ? 72 : 70; // ~72s for 1640m auto, ~70s for volte
    } else if (distance === 2140) {
      baseTime = startMethod === "auto" ? 75 : 73; // ~75s for 2140m auto, ~73s for volte
    } else { // 2640
      baseTime = startMethod === "auto" ? 78 : 76; // ~78s for 2640m auto, ~76s for volte
    }
    
    const variation = Math.random() * 4 - 2; // +/- 2 seconds variation
    const totalSeconds = baseTime + variation;
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);

    races.push({
      raceId: `simulated_${horseId}_${i}`,
      date: date.toISOString().split('T')[0],
      distance,
      startMethod,
      track,
      kmTime: { minutes, seconds, tenths },
      finishOrder: Math.floor(Math.random() * 12) + 1,
      postPosition: Math.floor(Math.random() * 12) + 1,
      galloped: Math.random() < 0.03, // 3% chance of galloping
      disqualified: Math.random() < 0.01 // 1% chance of disqualification
    });
  }

  return races;
};
