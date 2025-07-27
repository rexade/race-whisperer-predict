import { ProcessedKmTime, HorseRawKmTime } from './types/kmTimeTypes';
import { KmTime } from './utils/kmTimeUtils';
import { convertToKmTime } from './utils/timeConversion';
import { normalizeKmTimeSimplified } from './utils/kmTimeNormalization';
import { XanderTimeInvestigator } from './investigation/xanderTimeInvestigation';

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
  
  // 🔍 INVESTIGATION: Special debugging for Xander
  const isXander = horseName.toLowerCase().includes('xander');
  if (isXander) {
    console.log(`🕵️ XANDER INVESTIGATION: Starting detailed time processing`);
    console.log(`🕵️ XANDER INVESTIGATION: Input races:`, historicalRaces.map(r => ({
      date: r.date,
      originalTime: `${r.kmTime.minutes}:${r.kmTime.seconds}.${r.kmTime.tenths}`,
      distance: r.distance,
      startMethod: r.startMethod,
      place: r.finishOrder
    })));
  }

  for (const race of historicalRaces) {
    // Skip if no time recorded or horse was disqualified/galloped
    if (!race.kmTime || race.disqualified || race.galloped) {
      console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
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
    
    // 🔍 INVESTIGATION: Detailed best-3 calculation debugging for Xander
    if (isXander) {
      console.log(`🕵️ XANDER INVESTIGATION: Best-3 calculation details:`);
      best3Times.forEach((time, idx) => {
        const timeInSeconds = time.normalizedTime.minutes * 60 + time.normalizedTime.seconds + time.normalizedTime.tenths / 10;
        console.log(`🕵️   ${idx + 1}. ${time.raceDate}: ${time.normalizedTime.minutes}:${time.normalizedTime.seconds.toString().padStart(2, '0')}.${time.normalizedTime.tenths} = ${timeInSeconds.toFixed(1)}s`);
        console.log(`🕵️      Original: ${time.originalTime.minutes}:${time.originalTime.seconds.toString().padStart(2, '0')}.${time.originalTime.tenths} (${time.distance}m ${time.startMethod})`);
      });
      const averageSeconds = best3Times.reduce((sum, time) => {
        return sum + (time.normalizedTime.minutes * 60 + time.normalizedTime.seconds + time.normalizedTime.tenths / 10);
      }, 0) / best3Times.length;
      console.log(`🕵️ XANDER INVESTIGATION: Average seconds: ${averageSeconds.toFixed(2)}s`);
      console.log(`🕵️ XANDER INVESTIGATION: Converted to KM format: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
      
      // Generate comprehensive investigation report
      const expectedTime = "1:14.6"; // Based on website data
      const calculatedTime = `${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`;
      
      const report = XanderTimeInvestigator.generateInvestigationReport(
        "unknown", // Race ID would need to be passed in
        horseName,
        historicalRaces.length, // This is after API filtering but before our processing
        processedTimes.length,
        best3Times,
        calculatedTime,
        expectedTime
      );
      
      XanderTimeInvestigator.logDetailedReport(report);
    }
  } else {
    console.log(`No valid times found for RAW time calculation`);
  }

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
