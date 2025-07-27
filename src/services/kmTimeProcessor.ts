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
      
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);
      
      if (!historicalData || !historicalData.horse.results?.records) {
        console.warn(`No historical records found for horse ${start.horse.name}`);
        
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
      
      // Enhanced debugging for historical data
      HorseDebugger.logHistoricalData(horseId, horseName, historicalData.horse.results.records);
      
      // Validate historical records
      const rawRecords = historicalData.horse.results.records;
      const validationResults = rawRecords.map((record, index) => 
        DataValidator.validateHistoricalRecord(record, index)
      );
      DataValidator.logValidationResults(validationResults, `${horseName} Historical Records`);
      
      const validRecords = processHistoricalRecords(historicalData.horse.results.records, horseName);
      console.log(`Found ${validRecords.length} valid historical races for ${horseName}`);
      
      HorseDebugger.log(horseId, horseName, 'PROCESSED_HISTORICAL_RECORDS', {
        rawRecordsCount: rawRecords.length,
        validRecordsCount: validRecords.length,
        filteredOut: rawRecords.length - validRecords.length
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
      
      const horseRawKmTime = await processHorseKmTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      rawKmTimes.push(horseRawKmTime);
      
      const calculatedTimeStr = `${horseRawKmTime.best3Average.minutes}:${horseRawKmTime.best3Average.seconds.toString().padStart(2, '0')}.${horseRawKmTime.best3Average.tenths}`;
      console.log(`RAW KM time calculated for ${horseName}: ${calculatedTimeStr}`);
      
    } catch (error) {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 0;
      
      console.error(`Error processing KM times for horse ${horseName} (post position ${postPosition}):`, error);
      
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