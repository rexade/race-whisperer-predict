import { ProcessedKmTime, HorseRawKmTime } from './types/kmTimeTypes';
import { KmTime } from './utils/kmTimeUtils';
import { convertToKmTime } from './utils/timeConversion';
import { normalizeKmTimeSimplified } from './utils/kmTimeNormalization';
import { HorseDebugger } from './debugging/horseDebugger';
import { DataValidator } from './debugging/dataValidator';

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

export const processHorseKmTimes = async (
  horseId: number, 
  horseName: string, 
  historicalRaces: ATGHistoricalRace[]
): Promise<HorseRawKmTime> => {
  const processedTimes: ProcessedKmTime[] = [];

  console.log(`\n=== Processing KM times for ${horseName} (ID: ${horseId}) ===`);
  console.log(`Found ${historicalRaces.length} historical races to process`);
  
  HorseDebugger.log(horseId, horseName, 'START_KM_PROCESSING', {
    historicalRacesCount: historicalRaces.length,
    sampleRace: historicalRaces[0] || null
  });

  for (const race of historicalRaces) {
    // Validate and debug each race
    const raceValidation = DataValidator.validateKmTime(race.kmTime, `${horseName} race ${race.date}`);
    
    // Skip if no time recorded or horse was disqualified/galloped
    if (!race.kmTime || race.disqualified || race.galloped) {
      console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
      HorseDebugger.log(horseId, horseName, 'RACE_SKIPPED', {
        date: race.date,
        reason: !race.kmTime ? 'NO_KM_TIME' : race.disqualified ? 'DISQUALIFIED' : 'GALLOPED',
        raceData: race
      });
      continue;
    }
    
    if (!raceValidation.isValid) {
      console.error(`Invalid KM time for ${horseName} race ${race.date}:`, raceValidation.errors);
      HorseDebugger.log(horseId, horseName, 'INVALID_RACE_DATA', {
        date: race.date,
        validation: raceValidation,
        raceData: race
      });
      continue;
    }

    try {
      const originalKmTime = convertToKmTime(race.kmTime);
      
      // Apply simplified normalization keeping KM time format
      const normalizedKmTime = normalizeKmTimeSimplified(
        originalKmTime,
        race.distance,
        race.startMethod
      );

      console.log(`${race.date}: ${originalKmTime.minutes}:${originalKmTime.seconds.toString().padStart(2, '0')}.${originalKmTime.tenths} → ${normalizedKmTime.minutes}:${normalizedKmTime.seconds.toString().padStart(2, '0')}.${normalizedKmTime.tenths} (${race.distance}m ${race.startMethod}, place ${race.finishOrder})`);

      HorseDebugger.logNormalizationStep(horseId, horseName, `RACE_${race.date}`, 
        { 
          original: originalKmTime, 
          distance: race.distance, 
          startMethod: race.startMethod 
        },
        { 
          normalized: normalizedKmTime,
          timeDifference: (normalizedKmTime.minutes * 60 + normalizedKmTime.seconds + normalizedKmTime.tenths / 10) - 
                         (originalKmTime.minutes * 60 + originalKmTime.seconds + originalKmTime.tenths / 10)
        }
      );

      processedTimes.push({
        originalTime: originalKmTime,
        normalizedTime: normalizedKmTime,
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

  // Sort by normalized time (best/fastest first) - compare by converting to seconds
  processedTimes.sort((a, b) => {
    const aSeconds = a.normalizedTime.minutes * 60 + a.normalizedTime.seconds + a.normalizedTime.tenths / 10;
    const bSeconds = b.normalizedTime.minutes * 60 + b.normalizedTime.seconds + b.normalizedTime.tenths / 10;
    return aSeconds - bSeconds;
  });

  // Calculate best 3 average (RAW TIME) in KM format
  const best3Times = processedTimes.slice(0, 3);
  let best3Average: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  
  if (best3Times.length > 0) {
    // Standard calculation
    const totalSeconds = best3Times.reduce((sum, time) => {
      return sum + (time.normalizedTime.minutes * 60 + time.normalizedTime.seconds + time.normalizedTime.tenths / 10);
    }, 0) / best3Times.length;
    
    // Convert back to KM time format
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    const seconds = Math.floor(remainingSeconds);
    const tenths = Math.round((remainingSeconds - seconds) * 10);
    
    best3Average = { minutes, seconds, tenths };
  }

  console.log(`Processed ${processedTimes.length} valid times for ${horseName}`);
  if (best3Times.length > 0) {
    console.log(`Best 3 times: ${best3Times.map(t => `${t.normalizedTime.minutes}:${t.normalizedTime.seconds.toString().padStart(2, '0')}.${t.normalizedTime.tenths}`).join(', ')}`);
    console.log(`RAW Time (Best 3 Average): ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  } else {
    console.log(`No valid times found for RAW time calculation`);
  }
  
  // Enhanced debugging for final results
  HorseDebugger.logProcessedTimes(horseId, horseName, processedTimes, best3Average);

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    best3Average,
    validTimesCount: processedTimes.length
  };
};

// Keep the old function for backward compatibility
export const processHorseTimes = processHorseKmTimes;
