
import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords } from './atgHistoricalApi';

export const calculateRawKmTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawKmTime[]> => {
  const rawKmTimes: HorseRawKmTime[] = [];

  console.log(`\n=== Calculating RAW KM times for race ${raceId} with ${starts.length} horses ===`);
  console.log('🔥 STRICT MODE: Using POST POSITIONS for historical data fetch ONLY for RAW KM time calculation');

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition;
    progressCallback?.(i + 1, starts.length);

    try {
      console.log(`\n--- Processing horse ${i + 1}/${starts.length}: ${start.horse.name} (ID: ${start.horse.id}) ---`);
      console.log(`🎯 Using POST POSITION: ${postPosition} for historical data fetch`);
      
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);
      
      if (!historicalData.horse.results?.records) {
        console.warn(`No historical records found for horse ${start.horse.name}`);
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      const validRecords = processHistoricalRecords(historicalData.horse.results.records);
      console.log(`Found ${validRecords.length} valid historical races for ${start.horse.name}`);
      
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
      
      console.log(`✅ RAW KM time calculated for ${start.horse.name}: ${horseRawKmTime.best3Average.minutes}:${horseRawKmTime.best3Average.seconds.toString().padStart(2, '0')}.${horseRawKmTime.best3Average.tenths}`);
      console.log(`🗑️  HISTORICAL DATA DISCARDED - NEVER TO BE USED AGAIN`);
      
    } catch (error) {
      console.error(`❌ Error processing KM times for horse ${start.horse.name} (post position ${postPosition}):`, error);
      
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

  console.log(`\n=== Final RAW KM Time Rankings ===`);
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
