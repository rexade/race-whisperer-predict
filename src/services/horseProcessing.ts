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
  historicalRaces: ATGHistoricalRace[],
  metadata?: {
    usedFallback: boolean;
    dataSource: 'recent' | 'fallback';
    oldestRecordDate?: string;
    newestRecordDate?: string;
  }
): Promise<HorseRawKmTime> => {
  const processedTimes: ProcessedKmTime[] = [];
  let totalRecords = historicalRaces.length;
  let validRecords = 0;
  let disqualified = 0;
  let galloped = 0;
  let missingKmTimes = 0;

  console.log(`\n=== Processing KM times for ${horseName} (ID: ${horseId}) ===`);
  console.log(`📊 Historical records provided: ${historicalRaces.length}`);
  
  // CRITICAL: Check if we have historical records before processing
  if (!historicalRaces || historicalRaces.length === 0) {
    console.warn(`❌ NO HISTORICAL RECORDS - Horse ${horseName}:`);
    console.warn(`  📊 Historical races provided: ${historicalRaces?.length || 0}`);
    console.warn(`  🔍 This will result in empty processed times`);
    
    HorseDebugger.log(horseId, horseName, 'NO_HISTORICAL_RECORDS', {
      historicalRacesLength: historicalRaces?.length || 0,
      historicalRaces: historicalRaces
    });
    
    return {
      horseId,
      horseName,
      allTimes: [],
      best3Average: { minutes: 0, seconds: 0, tenths: 0 },
      bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
      validTimesCount: 0
    };
  }
  
  console.log(`✅ Historical records validation passed: ${historicalRaces.length} races found`);
  HorseDebugger.logHistoricalData(horseId, horseName, historicalRaces);

  for (const race of historicalRaces) {
    // Validate and debug each race
    const raceValidation = DataValidator.validateKmTime(race.kmTime, `${horseName} race ${race.date}`);
    
    // Track validation statistics
    if (!race.kmTime) {
      missingKmTimes++;
      console.log(`Skipping race ${race.date} - no km time`);
      continue;
    }

    // Skip disqualified or galloped races
    if (race.disqualified) {
      disqualified++;
      console.log(`Skipping race ${race.date} - disqualified`);
      continue;
    }
    
    if (race.galloped) {
      galloped++;
      console.log(`Skipping race ${race.date} - galloped`);
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

      // Log each historical normalization step
      HorseDebugger.logHistoricalNormalization(horseId, horseName, {
        date: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        kmTime: `${originalKmTime.minutes}:${originalKmTime.seconds.toString().padStart(2, '0')}.${originalKmTime.tenths}`,
        place: race.finishOrder,
        galloped: race.galloped,
        disqualified: race.disqualified
      }, normalizedKmTime);

      processedTimes.push({
        originalTime: originalKmTime,
        normalizedTime: normalizedKmTime,
        raceDate: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        finishOrder: race.finishOrder,
        valid: true
      });
      
      validRecords++;
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
  
  // Find the best single record time (fastest ever)
  let bestRecordTime: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  if (processedTimes.length > 0) {
    bestRecordTime = { ...processedTimes[0].normalizedTime };
  }
  
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

  // Log validation statistics
  const validationStats = {
    totalRecords,
    validRecords,
    disqualified,
    galloped,
    missingKmTimes,
    best3TimesUsed: Math.min(3, validRecords)
  };
  HorseDebugger.logValidationStats(horseId, horseName, validationStats);

  console.log(`Processed ${processedTimes.length} valid times for ${horseName}`);
  if (best3Times.length > 0) {
    console.log(`Best 3 times: ${best3Times.map(t => `${t.normalizedTime.minutes}:${t.normalizedTime.seconds.toString().padStart(2, '0')}.${t.normalizedTime.tenths}`).join(', ')}`);
    console.log(`RAW Time (Best 3 Average): ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  } else {
    console.warn(`❌ NO VALID TIMES - Horse ${horseName}:`);
    console.warn(`  📊 Historical races provided: ${historicalRaces.length}`);
    console.warn(`  ✅ Valid processed times: ${processedTimes.length}`);
    console.warn(`  🔍 All historical records were filtered out during processing`);
    console.warn(`  💡 Possible reasons: disqualified/galloped races, invalid KM times, distance filters`);
  }
  
  // Enhanced debugging for final results
  HorseDebugger.logProcessedTimes(horseId, horseName, processedTimes, best3Average);

  // Enhanced logging for time calculation transparency
  if (HorseDebugger.shouldDebugHorse(horseName)) {
    console.log(`🐎 [DETAILED TIME CALCULATION] ${horseName}:`);
    console.log(`   📊 Historical Records Processed: ${historicalRaces.length}`);
    console.log(`   ✅ Valid Times Found: ${processedTimes.length}`);
    console.log(`   📈 Calculation Method: Average of best 3 normalized times`);
    
    if (best3Times.length >= 3) {
      console.log(`   🏆 Top 3 Times Used:`);
      best3Times.forEach((time, i) => {
        console.log(`     ${i+1}. ${time.normalizedTime.minutes}:${time.normalizedTime.seconds.toString().padStart(2, '0')}.${time.normalizedTime.tenths} (from ${time.raceDate}, ${time.distance}m ${time.startMethod})`);
      });
    }
    
    console.log(`   🎯 Final Best 3 Average: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  }

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    best3Average,
    bestRecordTime,
    validTimesCount: processedTimes.length,
    isNotifiee: metadata?.usedFallback || false,
    dataSource: metadata?.dataSource || 'recent',
    oldestRecordDate: metadata?.oldestRecordDate,
    newestRecordDate: metadata?.newestRecordDate
  };
};

// Keep the old function for backward compatibility
export const processHorseTimes = processHorseKmTimes;
