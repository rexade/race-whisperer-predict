import { ProcessedKmTime, HorseRawKmTime } from './types/kmTimeTypes';
import { KmTime } from './utils/kmTimeUtils';
import { convertToKmTime } from './utils/timeConversion';
import { normalizeKmTimeSimplified } from './utils/kmTimeNormalization';
import { HorseDebugger } from './debugging/horseDebugger';
import { DataValidator } from './debugging/dataValidator';
import { getSourceConfidenceMultiplier, getStatisticsBreakdown } from './utils/recordsFallback';
import { toSeconds, secondsToKmParts, isOutlierTime, createRecordKey } from './utils/robustTimeConversion';

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
  let processedTimes: ProcessedKmTime[] = [];
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

  // Track why records are dropped - for debugging
  const dropReasons = {
    noKmTime: 0,
    badCode: 0,
    dqOrGallop: 0,
    invalidShape: 0,
    validProcessed: 0
  };

  for (const race of historicalRaces) {
    const isStatsSource = (race as any).meta?.source === 'statistics';
    
    // Check for valid kmTime structure
    if (!race.kmTime || typeof race.kmTime.minutes !== 'number' || typeof race.kmTime.seconds !== 'number') {
      dropReasons.noKmTime++;
      console.log(`Skipping race ${race.date} - no valid km time structure`);
      continue;
    }
    
    // Check for bad codes in kmTime
    const code = String((race.kmTime as any).code ?? (race as any).meta?.code ?? '').toLowerCase();
    const badCodes = ['0', 'it', 'dist', 'u', 'gdk', 'br', 'p', 'dq'];
    if (badCodes.includes(code)) {
      dropReasons.badCode++;
      console.log(`Skipping race ${race.date} - bad code: ${code}`);
      continue;
    }

    // Skip disqualified or galloped races
    if (race.disqualified) {
      disqualified++;
      dropReasons.dqOrGallop++;
      console.log(`Skipping race ${race.date} - disqualified`);
      continue;
    }
    
    if (race.galloped) {
      galloped++;
      dropReasons.dqOrGallop++;
      console.log(`Skipping race ${race.date} - galloped`);
      continue;
    }
    
    // Validate KM time (but be lenient for stats-sourced records)
    const raceValidation = DataValidator.validateKmTime(race.kmTime, `${horseName} race ${race.date}`);
    if (!raceValidation.isValid && !isStatsSource) {
      dropReasons.invalidShape++;
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

      // Check for outliers (warn but don't drop)
      const outlierCheck = isOutlierTime(normalizedKmTime);
      if (outlierCheck.isOutlier) {
        console.warn(`⚠️ Outlier time detected for ${horseName} on ${race.date}: ${normalizedKmTime.minutes}:${normalizedKmTime.seconds}.${normalizedKmTime.tenths} (${outlierCheck.reason})`);
      }

      processedTimes.push({
        originalTime: originalKmTime,
        normalizedTime: normalizedKmTime,
        raceDate: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        finishOrder: race.finishOrder,
        valid: true,
        outlier: outlierCheck.isOutlier ? outlierCheck.reason : undefined,
        raceId: race.raceId
      } as any);
      
      dropReasons.validProcessed++;
      validRecords++;
    } catch (error) {
      console.error(`Error processing race ${race.date} for ${horseName}:`, error);
      continue;
    }
  }

  // Log drop reasons for debugging
  console.log(`📊 [DROP REASONS] ${horseName}:`, dropReasons);

  // Deduplicate records (same race + similar time = duplicate)
  const seen = new Set<string>();
  processedTimes = processedTimes.filter(r => {
    const key = createRecordKey(r as any);
    if (seen.has(key)) {
      console.log(`🔄 Duplicate record detected and removed: ${r.raceDate} ${r.normalizedTime.minutes}:${r.normalizedTime.seconds}.${r.normalizedTime.tenths}`);
      return false;
    }
    seen.add(key);
    return true;
  });

  // Stable sort by normalized time (best/fastest first)
  processedTimes = processedTimes
    .map((r, i) => ({ ...r, _sortIndex: i }))
    .sort((a, b) => {
      const da = toSeconds(a.normalizedTime.minutes, a.normalizedTime.seconds, a.normalizedTime.tenths ?? 0);
      const db = toSeconds(b.normalizedTime.minutes, b.normalizedTime.seconds, b.normalizedTime.tenths ?? 0);
      if (da !== db) return da - db;
      return (a as any)._sortIndex - (b as any)._sortIndex; // Stable fallback
    });

  // Calculate average over what we have (1, 2, or 3+ times)
  // DON'T require exactly 3 times - work with what's available
  const bestN = Math.min(3, processedTimes.length);
  let best3Average: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  let bestRecordTime: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  
  if (bestN > 0) {
    const bestNtimes = processedTimes.slice(0, bestN);
    
    // Calculate average using robust conversion
    const totalSeconds = bestNtimes.reduce((sum, time) => {
      return sum + toSeconds(time.normalizedTime.minutes, time.normalizedTime.seconds, time.normalizedTime.tenths ?? 0);
    }, 0) / bestN;
    
    // Convert back to KM time format with overflow guards
    best3Average = secondsToKmParts(totalSeconds);
    bestRecordTime = { ...processedTimes[0].normalizedTime }; // Fastest time
    
    console.log(`✅ Calculated best-${bestN} average for ${horseName}: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  } else {
    console.warn(`⚠️ No valid times to average for ${horseName}`);
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
  if (bestN > 0) {
    const bestNtimes = processedTimes.slice(0, bestN);
    console.log(`Best ${bestN} times: ${bestNtimes.map(t => `${t.normalizedTime.minutes}:${t.normalizedTime.seconds.toString().padStart(2, '0')}.${t.normalizedTime.tenths}`).join(', ')}`);
    console.log(`RAW Time (Best ${bestN} Average): ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  } else {
    console.warn(`❌ NO VALID TIMES - Horse ${horseName}:`);
    console.warn(`  📊 Historical races provided: ${historicalRaces.length}`);
    console.warn(`  ✅ Valid processed times: ${processedTimes.length}`);
    console.warn(`  🔍 Drop reasons:`, dropReasons);
    console.warn(`  💡 Check the drop reasons above to see why records were filtered out`);
  }
  
  // Enhanced debugging for final results
  HorseDebugger.logProcessedTimes(horseId, horseName, processedTimes, best3Average);

  // Get telemetry breakdown for statistics fallback
  const statsBreakdown = getStatisticsBreakdown(
    historicalRaces.map(r => ({ meta: { source: (r as any).meta?.source || 'results', distance: (r as any).meta?.distance } } as any))
  );
  
  const usedStatisticsFallback = statsBreakdown.statisticsRecords > 0;
  
  // Log telemetry for monitoring fallback usage
  if (usedStatisticsFallback) {
    console.log(`📊 [FALLBACK TELEMETRY] ${horseName}:`);
    console.log(`   Statistics records: ${statsBreakdown.statisticsRecords}/${statsBreakdown.totalRecords}`);
    console.log(`   Distance breakdown: K=${statsBreakdown.distanceBreakdown.short} M=${statsBreakdown.distanceBreakdown.medium} L=${statsBreakdown.distanceBreakdown.long}`);
    
    HorseDebugger.log(horseId, horseName, 'STATISTICS_FALLBACK_TELEMETRY', {
      statisticsRecords: statsBreakdown.statisticsRecords,
      resultsRecords: statsBreakdown.resultsRecords,
      totalRecords: statsBreakdown.totalRecords,
      distanceBreakdown: statsBreakdown.distanceBreakdown
    });
  }
  
  // Apply confidence weighting for statistics-sourced records
  const confidenceMultiplier = getSourceConfidenceMultiplier(
    historicalRaces.map(r => ({ meta: { source: (r as any).meta?.source || 'results' } } as any))
  );
  
  // Store raw average before penalty for transparency
  const rawBest3Average = { ...best3Average };
  
  if (confidenceMultiplier < 1.0) {
    console.log(`📊 [CONFIDENCE ADJUSTMENT] Applying ${confidenceMultiplier}x multiplier for statistics-only data`);
    // Apply confidence penalty to the average time using robust conversion
    const rawAvgSec = toSeconds(best3Average.minutes, best3Average.seconds, best3Average.tenths ?? 0);
    const penalizedSec = rawAvgSec / confidenceMultiplier; // Slower time = less confident
    
    // Convert back with overflow guards
    best3Average = secondsToKmParts(penalizedSec);
    
    console.log(`   Raw average: ${rawBest3Average.minutes}:${rawBest3Average.seconds.toString().padStart(2, '0')}.${rawBest3Average.tenths}`);
    console.log(`   Penalized: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  }

  // Enhanced logging for time calculation transparency
  if (HorseDebugger.shouldDebugHorse(horseName)) {
    console.log(`🐎 [DETAILED TIME CALCULATION] ${horseName}:`);
    console.log(`   📊 Historical Records Processed: ${historicalRaces.length}`);
    console.log(`   ✅ Valid Times Found: ${processedTimes.length}`);
    console.log(`   📈 Calculation Method: Average of best ${bestN} normalized times`);
    console.log(`   🎯 Confidence Multiplier: ${confidenceMultiplier}x`);
    console.log(`   📉 Drop Reasons:`, dropReasons);
    
    if (bestN > 0) {
      const bestNtimes = processedTimes.slice(0, bestN);
      console.log(`   🏆 Top ${bestN} Times Used:`);
      bestNtimes.forEach((time, i) => {
        console.log(`     ${i+1}. ${time.normalizedTime.minutes}:${time.normalizedTime.seconds.toString().padStart(2, '0')}.${time.normalizedTime.tenths ?? 0} (from ${time.raceDate}, ${time.distance}m ${time.startMethod})`);
      });
    }
    
    console.log(`   🎯 Final Best ${bestN} Average: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
  }

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    best3Average, // Penalized time (used for ranking)
    rawBest3Average: confidenceMultiplier < 1.0 ? rawBest3Average : undefined, // Raw time (for transparency)
    bestRecordTime,
    validTimesCount: processedTimes.length,
    isNotifiee: metadata?.usedFallback || false,
    dataSource: metadata?.dataSource || 'recent',
    oldestRecordDate: metadata?.oldestRecordDate,
    newestRecordDate: metadata?.newestRecordDate,
    confidenceMultiplier, // Include confidence in result
    usedStatisticsFallback
  };
};

// Keep the old function for backward compatibility
export const processHorseTimes = processHorseKmTimes;
