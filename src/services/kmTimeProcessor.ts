import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords } from './atgHistoricalApi';
import { HorseDebugger } from './debugging/horseDebugger';
import { DataValidator } from './debugging/dataValidator';

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
      
      if (!historicalData || !historicalData.horse.results?.records) {
        console.warn(`❌ [KmTimeProcessor] NO HISTORICAL DATA - Horse ${start.horse.name} (Post ${postPosition})`);
        console.warn(`  📊 Data check: historicalData=${!!historicalData}, horse=${!!historicalData?.horse}, results=${!!historicalData?.horse?.results}, records=${!!historicalData?.horse?.results?.records}`);
        console.warn(`  📈 Records length: ${historicalData?.horse?.results?.records?.length || 0}`);
        console.warn(`  🚫 This horse will get zero time and be excluded from analysis`);
        
        HorseDebugger.log(horseId, horseName, 'NO_HISTORICAL_DATA', {
          historicalDataExists: !!historicalData,
          hasHorse: !!historicalData?.horse,
          hasResults: !!historicalData?.horse?.results,
          hasRecords: !!historicalData?.horse?.results?.records,
          recordsLength: historicalData?.horse?.results?.records?.length || 0
        });
        
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      console.log(`✅ [KmTimeProcessor] Historical data found for ${horseName}: ${historicalData.horse.results.records.length} records`);
      
      // Enhanced debugging for historical data
      HorseDebugger.logHistoricalData(horseId, horseName, historicalData.horse.results.records);
      
      // Validate historical records
      const rawRecords = historicalData.horse.results.records;
      const validationResults = rawRecords.map((record, index) => 
        DataValidator.validateHistoricalRecord(record, index)
      );
      DataValidator.logValidationResults(validationResults, `${horseName} Historical Records`);
      
      const processingResult = processHistoricalRecords(historicalData.horse.results.records, horseName);
      const validRecords = processingResult.records;
      const metadata = processingResult.metadata;
      
      console.log(`📊 [KmTimeProcessor] Historical records processing for ${horseName}:`);
      console.log(`   - Raw records from API: ${rawRecords.length}`);
      console.log(`   - Valid records after filtering: ${validRecords.length}`);
      console.log(`   - Filtered out: ${rawRecords.length - validRecords.length}`);
      console.log(`   - Data source: ${metadata.dataSource.toUpperCase()}`);
      if (metadata.usedFallback) {
        console.log(`   🚨 FALLBACK MODE: Using historical data (${metadata.oldestRecordDate} to ${metadata.newestRecordDate})`);
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
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW KM time (best first)
  rawKmTimes.sort((a, b) => {
    const aSeconds = a.best3Average.minutes * 60 + a.best3Average.seconds + a.best3Average.tenths / 10;
    const bSeconds = b.best3Average.minutes * 60 + b.best3Average.seconds + b.best3Average.tenths / 10;
    
    if (aSeconds === 0 && bSeconds === 0) return 0;
    if (aSeconds === 0) return 1;
    if (bSeconds === 0) return -1;
    return aSeconds - bSeconds;
  });

  console.log(`Final RAW KM Time Rankings:`);
  rawKmTimes.forEach((horse, index) => {
    const kmTime = horse.best3Average;
    if (kmTime.minutes > 0 || kmTime.seconds > 0 || kmTime.tenths > 0) {
      console.log(`${index + 1}. ${horse.horseName}: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths} (${horse.validTimesCount} races)`);
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawKmTimes;
};