import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords, ATGHistoricalRecord } from './atgHistoricalApi';
import { HorseDebugger } from './debugging/horseDebugger';
import { DataValidator } from './debugging/dataValidator';
import { extractRecordsFromStatistics, originIncludesStatistics } from './utils/recordsFallback';

export const calculateRawKmTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawKmTime[]> => {
  const rawKmTimes: HorseRawKmTime[] = [];

  console.log(`Calculating RAW KM times for race ${raceId} with ${starts.length} horses`);

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition;
    progressCallback?.(i + 1, starts.length);

    try {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 0;
      
      console.log(`Processing horse ${i + 1}/${starts.length}: ${horseName} (ID: ${horseId})`);
      
      // Enhanced debugging for target horses
      HorseDebugger.log(horseId, horseName, 'FETCH_START', {
        raceId,
        postPosition,
        horseData: start.horse
      });
      
      console.log(`📡 [KmTimeProcessor] Fetching historical data for ${horseName}...`);
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);
      
      console.log(`📡 [KmTimeProcessor] Historical data fetch result for ${horseName}:`, {
        hasData: !!historicalData,
        hasHorse: !!historicalData?.horse,
        hasResults: !!historicalData?.horse?.results,
        hasRecords: !!historicalData?.horse?.results?.records,
        recordsCount: historicalData?.horse?.results?.records?.length || 0
      });
      
      // ❶ Try primary source (results.records)
      let records = historicalData?.horse?.results?.records;
      let usingStatisticsFallback = false;
      
      // ❷ If missing/empty, try statistics fallback
      if (!records || records.length === 0) {
        console.log(`📊 [KmTimeProcessor] No results.records found for ${horseName}, trying statistics fallback...`);
        const statsFallback = extractRecordsFromStatistics(historicalData?.horse);
        
        if (statsFallback.length > 0) {
          console.log(`✅ [KmTimeProcessor] Statistics fallback successful for ${horseName}: ${statsFallback.length} records found`);
          records = statsFallback as any;
          usingStatisticsFallback = true;
          
          HorseDebugger.log(horseId, horseName, 'STATISTICS_FALLBACK_USED', {
            statisticsRecordsFound: statsFallback.length,
            sampleRecord: statsFallback[0]
          });
        }
      }
      
      // ❸ If still nothing, mark zero and continue
      if (!records || records.length === 0) {
        console.warn(`❌ [KmTimeProcessor] NO HISTORICAL DATA - Horse ${horseName} (Post ${postPosition})`);
        console.warn(`  📊 Data check: historicalData=${!!historicalData}, horse=${!!historicalData?.horse}, results=${!!historicalData?.horse?.results}, records=${!!historicalData?.horse?.results?.records}`);
        console.warn(`  📈 Records length: ${historicalData?.horse?.results?.records?.length || 0}`);
        console.warn(`  📊 Statistics fallback attempted: yes, found: 0 records`);
        console.warn(`  🚫 This horse will get zero time and be excluded from analysis`);
        
        HorseDebugger.log(horseId, horseName, 'NO_HISTORICAL_DATA', {
          historicalDataExists: !!historicalData,
          hasHorse: !!historicalData?.horse,
          hasResults: !!historicalData?.horse?.results,
          hasRecords: !!historicalData?.horse?.results?.records,
          recordsLength: historicalData?.horse?.results?.records?.length || 0,
          statisticsFallbackAttempted: true,
          statisticsRecordsFound: 0
        });
        
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      console.log(`✅ [KmTimeProcessor] Historical data found for ${horseName}: ${records.length} records ${usingStatisticsFallback ? '(from statistics)' : ''}`);
      
      // Enhanced debugging for historical data
      HorseDebugger.logHistoricalData(horseId, horseName, records);
      
      // Validate historical records
      const rawRecords = records;
      const validationResults = rawRecords.map((record, index) => 
        DataValidator.validateHistoricalRecord(record, index)
      );
      DataValidator.logValidationResults(validationResults, `${horseName} Historical Records`);
      
      const processingResult = processHistoricalRecords(records, horseName);
      const validRecords = processingResult.records;
      const metadata = {
        ...processingResult.metadata,
        usingStatisticsFallback,
        dataSource: usingStatisticsFallback ? 'fallback' as const : processingResult.metadata.dataSource
      };
      
      console.log(`📊 [KmTimeProcessor] Historical records processing for ${horseName}:`);
      console.log(`   - Raw records from API: ${rawRecords.length}`);
      console.log(`   - Valid records after filtering: ${validRecords.length}`);
      console.log(`   - Filtered out: ${rawRecords.length - validRecords.length}`);
      console.log(`   - Data source: ${metadata.dataSource.toUpperCase()}`);
      if (usingStatisticsFallback) {
        console.log(`   📊 STATISTICS FALLBACK: Using statistics.records data (limited race details)`);
      }
      if (metadata.usedFallback) {
        console.log(`   🚨 TIME WINDOW FALLBACK: Using historical data (${metadata.oldestRecordDate} to ${metadata.newestRecordDate})`);
      }
      
      HorseDebugger.log(horseId, horseName, 'PROCESSED_HISTORICAL_RECORDS', {
        rawRecordsCount: rawRecords.length,
        validRecordsCount: validRecords.length,
        filteredOut: rawRecords.length - validRecords.length,
        sampleRecord: validRecords[0],
        dataSource: metadata.dataSource,
        usedFallback: metadata.usedFallback,
        dateRange: `${metadata.oldestRecordDate} to ${metadata.newestRecordDate}`
      });
      
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
      
      console.log(`⚙️ [KmTimeProcessor] Sending ${historicalRaces.length} historical races to processHorseKmTimes for ${horseName}`);
      
      const horseRawKmTime = await processHorseKmTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces,
        metadata
      );
      
      console.log(`⚙️ [KmTimeProcessor] processHorseKmTimes result for ${horseName}:`, {
        validTimesCount: horseRawKmTime.validTimesCount,
        best3Average: horseRawKmTime.best3Average,
        allTimesLength: horseRawKmTime.allTimes.length
      });
      
      rawKmTimes.push(horseRawKmTime);
      
      const calculatedTimeStr = `${horseRawKmTime.best3Average.minutes}:${horseRawKmTime.best3Average.seconds.toString().padStart(2, '0')}.${horseRawKmTime.best3Average.tenths}`;
      console.log(`✅ [KmTimeProcessor] RAW KM time calculated for ${horseName}: ${calculatedTimeStr} (from ${horseRawKmTime.validTimesCount} valid times)`);
      
    } catch (error) {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 0;
      
      console.error(`❌ PROCESSING ERROR - Horse ${horseName} (Post ${postPosition}):`, error);
      console.error(`  🔍 Error type: ${error.name}`);
      console.error(`  📝 Error message: ${error.message}`);
      
      rawKmTimes.push({
        horseId: start.horse.id,
        horseName: start.horse.name,
        allTimes: [],
        best3Average: { minutes: 0, seconds: 0, tenths: 0 },
        bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW KM time (best first) with tie-breaker favoring results over statistics
  rawKmTimes.sort((a, b) => {
    const aSeconds = a.best3Average.minutes * 60 + a.best3Average.seconds + (a.best3Average.tenths ?? 0) / 10;
    const bSeconds = b.best3Average.minutes * 60 + b.best3Average.seconds + (b.best3Average.tenths ?? 0) / 10;
    
    if (aSeconds === 0 && bSeconds === 0) return 0;
    if (aSeconds === 0) return 1;
    if (bSeconds === 0) return -1;
    
    // Primary sort: by time
    if (Math.abs(aSeconds - bSeconds) > 0.001) {
      return aSeconds - bSeconds;
    }
    
    // Tie-breaker: prefer results over statistics fallback
    const aUsesStats = a.usedStatisticsFallback ?? false;
    const bUsesStats = b.usedStatisticsFallback ?? false;
    if (aUsesStats !== bUsesStats) {
      return aUsesStats ? 1 : -1; // Results come first
    }
    
    return 0;
  });

  // Telemetry: Log fallback usage summary
  const totalHorses = rawKmTimes.length;
  const horsesUsingFallback = rawKmTimes.filter(h => h.usedStatisticsFallback).length;
  if (horsesUsingFallback > 0) {
    console.log(`📊 [RACE FALLBACK SUMMARY] ${horsesUsingFallback}/${totalHorses} horses used statistics fallback`);
  }

  console.log(`Final RAW KM Time Rankings:`);
  rawKmTimes.forEach((horse, index) => {
    const kmTime = horse.best3Average;
    const dataSourceTag = horse.usedStatisticsFallback ? ' [STATS]' : '';
    const confidenceTag = horse.confidenceMultiplier && horse.confidenceMultiplier < 1.0 
      ? ` (confidence: ${(horse.confidenceMultiplier * 100).toFixed(0)}%)` 
      : '';
    
    if (kmTime.minutes > 0 || kmTime.seconds > 0 || kmTime.tenths > 0) {
      console.log(`${index + 1}. ${horse.horseName}: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths} (${horse.validTimesCount} races)${dataSourceTag}${confidenceTag}`);
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawKmTimes;
};