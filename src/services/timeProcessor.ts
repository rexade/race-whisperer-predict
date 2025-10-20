

import { ATGStartInfo } from './atgApi';
import { HorseRawTime } from './types/timeProcessorTypes';
import { processHorseTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords } from './atgHistoricalApi';
import { kmTimeToSeconds } from './utils/kmTimeUtils';
import { extractRecordsFromStatistics } from './utils/recordsFallback';

// Re-export types and utilities for backward compatibility
export type { ProcessedTime, HorseRawTime } from './types/timeProcessorTypes';
export { convertKmTimeToSeconds } from './utils/timeConversion';
export { normalizeTimeSimplified } from './utils/timeNormalization';
export { processHorseTimes } from './horseProcessing';

/**
 * Converts HorseRawKmTime to legacy HorseRawTime format (seconds-based)
 */
const convertKmTimeToLegacyFormat = (horseKmTime: any): HorseRawTime => {
  const legacyTimes = horseKmTime.allTimes.map((kmTime: any) => ({
    originalTime: kmTimeToSeconds(kmTime.originalTime),
    normalizedTime: kmTimeToSeconds(kmTime.normalizedTime),
    raceDate: kmTime.raceDate,
    distance: kmTime.distance,
    startMethod: kmTime.startMethod,
    finishOrder: kmTime.finishOrder,
    valid: kmTime.valid
  }));

  return {
    horseId: horseKmTime.horseId,
    horseName: horseKmTime.horseName,
    allTimes: legacyTimes,
    best3Average: kmTimeToSeconds(horseKmTime.best3Average),
    validTimesCount: horseKmTime.validTimesCount
  };
};

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
      
      // Fetch historical data for this horse using POST POSITION
      const historicalData = await fetchHorseHistoricalData(raceId, start.postPosition);
      
      // Try primary source (results.records)
      let records = historicalData?.horse?.results?.records;
      let usingStatisticsFallback = false;
      
      // If missing/empty, try statistics fallback
      if (!records || records.length === 0) {
        console.log(`📊 [TimeProcessor] No results.records found for ${start.horse.name}, trying statistics fallback...`);
        const statsFallback = extractRecordsFromStatistics(historicalData?.horse);
        
        if (statsFallback.length > 0) {
          console.log(`✅ [TimeProcessor] Statistics fallback successful for ${start.horse.name}: ${statsFallback.length} records found`);
          records = statsFallback as any;
          usingStatisticsFallback = true;
        }
      }
      
      if (!records || records.length === 0) {
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
      
      // Process and filter historical records - ONLY FOR RAW TIME CALCULATION
      const processingResult = processHistoricalRecords(records, start.horse.name);
      const validRecords = processingResult.records;
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
      
      // Process the times using existing logic - CALCULATE RAW TIME ONLY
      const horseKmTime = await processHorseTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      // Convert KM time result to legacy seconds format
      const horseRawTime = convertKmTimeToLegacyFormat(horseKmTime);
      rawTimes.push(horseRawTime);
      
      // THROW AWAY HISTORICAL DATA - IT'S ONLY FOR RAW TIME CALCULATION
      console.log(`✅ RAW time calculated for ${start.horse.name}: ${horseRawTime.best3Average.toFixed(2)}s - HISTORICAL DATA DISCARDED`);
      
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
  console.log('🔥 STRICT MODE: Using POST POSITIONS for historical data fetch ONLY for RAW time calculation');

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition; // USE POST POSITION, NOT START NUMBER
    progressCallback?.(i + 1, starts.length);

    try {
      console.log(`\n--- Processing horse ${i + 1}/${starts.length}: ${start.horse.name} (ID: ${start.horse.id}) ---`);
      console.log(`🎯 Using POST POSITION: ${postPosition} for historical data fetch`);
      
      // Fetch historical data using POST POSITION - ONLY FOR RAW TIME CALCULATION
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);
      
      // Try primary source (results.records)
      let records = historicalData?.horse?.results?.records;
      let usingStatisticsFallback = false;
      
      // If missing/empty, try statistics fallback
      if (!records || records.length === 0) {
        console.log(`📊 [TimeProcessor] No results.records found for ${start.horse.name}, trying statistics fallback...`);
        const statsFallback = extractRecordsFromStatistics(historicalData?.horse);
        
        if (statsFallback.length > 0) {
          console.log(`✅ [TimeProcessor] Statistics fallback successful for ${start.horse.name}: ${statsFallback.length} records found`);
          records = statsFallback as any;
          usingStatisticsFallback = true;
        }
      }
      
      if (!records || records.length === 0) {
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
      
      // Process and filter historical records - ONLY FOR RAW TIME CALCULATION
      const processingResult = processHistoricalRecords(records, start.horse.name);
      const validRecords = processingResult.records;
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
      
      // Process the times using existing logic - CALCULATE RAW TIME ONLY
      const horseKmTime = await processHorseTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      // Convert KM time result to legacy seconds format
      const horseRawTime = convertKmTimeToLegacyFormat(horseKmTime);
      rawTimes.push(horseRawTime);
      
      // THROW AWAY HISTORICAL DATA - NEVER TOUCH AGAIN
      console.log(`✅ RAW time calculated for ${start.horse.name}: ${horseRawTime.best3Average.toFixed(2)}s`);
      console.log(`🗑️  HISTORICAL DATA DISCARDED - NEVER TO BE USED AGAIN`);
      
    } catch (error) {
      console.error(`❌ Error processing times for horse ${start.horse.name} (post position ${postPosition}):`, error);
      
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

