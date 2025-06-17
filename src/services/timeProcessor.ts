
import { ATGHistoricalRace, ATGStartInfo } from './atgApi';
import { normalizeKmTime } from '../utils/raceAnalysis';

export interface ProcessedTime {
  originalTime: number; // in seconds
  normalizedTime: number; // normalized to 2140m autostart
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
  top3Average: number;
  validTimesCount: number;
}

export const convertKmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};

export const processHorseTimes = async (
  horseId: number, 
  horseName: string, 
  historicalRaces: ATGHistoricalRace[]
): Promise<HorseRawTime> => {
  const processedTimes: ProcessedTime[] = [];

  for (const race of historicalRaces) {
    // Skip if no time recorded or horse was disqualified/galloped
    if (!race.kmTime || race.disqualified || race.galloped) {
      continue;
    }

    const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
    
    // Normalize to 2140m autostart for comparison
    const normalizedTime = normalizeKmTime(
      originalTimeSeconds,
      false, // barefoot - would need equipment data
      false, // shoe change - would need equipment data
      "VA", // sulky type - would need equipment data
      undefined, // driver win percentage - would need current driver stats
      undefined, // final odds
      race.postPosition,
      race.startMethod.toLowerCase(),
      race.distance,
      race.distance // horse distance same as race distance for historical data
    );

    // Apply target normalization to 2140m autostart
    const targetNormalizedTime = normalizeToTarget(normalizedTime, race.distance, race.startMethod, 2140, "auto");

    processedTimes.push({
      originalTime: originalTimeSeconds,
      normalizedTime: targetNormalizedTime,
      raceDate: race.date,
      distance: race.distance,
      startMethod: race.startMethod,
      finishOrder: race.finishOrder,
      valid: true
    });
  }

  // Sort by normalized time (best first)
  processedTimes.sort((a, b) => a.normalizedTime - b.normalizedTime);

  // Calculate top 3 average
  const top3Times = processedTimes.slice(0, 3);
  const top3Average = top3Times.length > 0 
    ? top3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / top3Times.length
    : 0;

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    top3Average,
    validTimesCount: processedTimes.length
  };
};

// Helper function to normalize times to a target distance and start method
const normalizeToTarget = (
  normalizedTime: number,
  originalDistance: number,
  originalStartMethod: string,
  targetDistance: number,
  targetStartMethod: string
): number => {
  let adjustment = 0;

  // Distance scaling
  const distanceRatio = targetDistance / originalDistance;
  let scaledTime = normalizedTime * distanceRatio;

  // Start method adjustment
  if (originalStartMethod.toLowerCase() === "volte" && targetStartMethod === "auto") {
    adjustment += 1.0; // Volte is typically faster
  } else if (originalStartMethod.toLowerCase() === "auto" && targetStartMethod === "volte") {
    adjustment -= 1.0;
  }

  return scaledTime + adjustment;
};

export const calculateRawTimesForRace = async (
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawTime[]> => {
  const rawTimes: HorseRawTime[] = [];

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
        top3Average: 0,
        validTimesCount: 0
      });
    }
  }

  return rawTimes;
};

// Temporary function to simulate historical data
// This should be replaced with actual API calls once we have the correct endpoints
const generateSimulatedHistory = (horseId: number, horseName: string): ATGHistoricalRace[] => {
  const races: ATGHistoricalRace[] = [];
  const raceCount = Math.floor(Math.random() * 10) + 5; // 5-14 historical races

  for (let i = 0; i < raceCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 14 + Math.random() * 14)); // Every 2-4 weeks
    
    const distances = [1640, 2140, 2640, 3140];
    const distance = distances[Math.floor(Math.random() * distances.length)];
    const startMethod = Math.random() > 0.3 ? "auto" : "volte";
    
    // Generate realistic time based on distance
    const baseTime = (distance / 1640) * 75; // ~75 seconds for 1640m
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
      track: "Solvalla",
      kmTime: { minutes, seconds, tenths },
      finishOrder: Math.floor(Math.random() * 12) + 1,
      postPosition: Math.floor(Math.random() * 12) + 1,
      galloped: Math.random() < 0.05,
      disqualified: Math.random() < 0.02
    });
  }

  return races;
};
