
import { V75RaceData } from '../../../services/v75CalendarApi';
import { KmTime, HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { NormalizationWeights } from '../../../services/modernKm/index';
import { V75HorseResult } from '../types/raceResultTypes';
import { extractTrackNameAsString } from './dataExtraction';
import { extractAndValidateHorseData } from './horseDataExtractor';
import { applyHorseNormalization } from './horseNormalizationProcessor';
import { buildHorseResult, storeRaceAnalysisData } from './horseResultBuilder';

export const processHorseResults = async (
  race: V75RaceData,
  rawKmTimes: HorseRawKmTime[],
  weights: NormalizationWeights,
  analysisDate?: string
): Promise<V75HorseResult[]> => {
  const safeRaceTrack = extractTrackNameAsString(race.track);
  const horseResults: V75HorseResult[] = [];

  console.log(`🔄 ENHANCED PROCESSING - Race ${race.raceNumber}:`);
  console.log(`  - Total horses to process: ${race.horses.length}`);
  console.log(`  - Raw KM times available: ${rawKmTimes.length}`);

  for (const horse of race.horses) {
    const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
    const rawKmTime = rawTimeData?.best3Average;

    // Extract and validate horse data
    const extractedData = extractAndValidateHorseData(horse);

    // ENHANCED: Always apply normalization to ensure predicted times
    console.log(`🎯 Processing horse ${horse.horseId} (${extractedData.safeHorseName})`);
    console.log(`  - Has raw KM time: ${!!rawKmTime}`);
    
    const modernNormalizedResult = applyHorseNormalization(
      horse,
      race,
      rawKmTime,
      extractedData,
      weights
    );

    console.log(`  - Generated normalized result: ${!!modernNormalizedResult}`);
    if (modernNormalizedResult?.modernNormalizedTime) {
      const time = modernNormalizedResult.modernNormalizedTime;
      console.log(`  - Predicted time: ${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths} ${(modernNormalizedResult as any).isEstimated ? '(EST)' : '(RAW)'}`);
    }

    // Build the final horse result with notifiee information
    const horseResult = buildHorseResult(
      horse,
      race,
      rawKmTime,
      modernNormalizedResult,
      extractedData,
      safeRaceTrack,
      rawTimeData // Pass the full raw time data including notifiee info
    );

    horseResults.push(horseResult);
  }

  console.log(`✅ ENHANCED PROCESSING COMPLETE - Race ${race.raceNumber}:`);
  console.log(`  - Processed horses: ${horseResults.length}`);
  console.log(`  - Horses with predicted times: ${horseResults.filter(h => h.modernNormalizedResult?.modernNormalizedTime).length}`);

  // Store race analysis data for post-race comparison if analysis date is provided
  if (analysisDate) {
    await storeRaceAnalysisData(race, horseResults, analysisDate);
  }

  return horseResults;
};
