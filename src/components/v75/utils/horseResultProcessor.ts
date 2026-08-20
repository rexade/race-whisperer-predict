
import { V75RaceData } from '../../../services/v75CalendarApi';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { NormalizationWeights, PostPositionCurves } from '../../../services/modernKm/index';
import { V75HorseResult } from '../types/raceResultTypes';
import { extractTrackNameAsString } from './dataExtraction';
import { extractAndValidateHorseData } from './horseDataExtractor';
import { applyHorseNormalization } from './horseNormalizationProcessor';
import { buildHorseResult, storeRaceAnalysisData } from './horseResultBuilder';
import { log } from '@/lib/logger';
import { horseKeyFromRaceHorse, horseKeyFromRawTime } from '@/services/horseIdentity';
import { isZeroTime } from '@/services/utils/kmTimeUtils';

export const processHorseResults = async (
  race: V75RaceData,
  rawKmTimes: HorseRawKmTime[],
  weights: NormalizationWeights,
  analysisDate?: string,
  postPositionCurves?: PostPositionCurves
): Promise<V75HorseResult[]> => {
  const safeRaceTrack = extractTrackNameAsString(race.track);
  const horseResults: V75HorseResult[] = [];

  log.debug(`🔄 ENHANCED PROCESSING - Race ${race.raceNumber}:`);
  log.debug(`  - Total horses to process: ${race.horses.length}`);
  log.debug(`  - Raw KM times available: ${rawKmTimes.length}`);

  for (const horse of race.horses) {
    const horseKey = horseKeyFromRaceHorse(race.raceId, horse);
    const rawTimeData = rawKmTimes.find(rt => horseKeyFromRawTime(rt) === horseKey);
    // Use un-penalized best time for normalization so final = raw + totalAdjustment (e.g. 1:11.5 + 0.04 = 1:11.54).
    // Confidence penalty is for transparency only; we do not feed penalized time into normalization.
    const selectedRawKmTime = rawTimeData?.rawBestTime ?? rawTimeData?.bestTime;
    const rawKmTime = selectedRawKmTime && !isZeroTime(selectedRawKmTime)
      ? selectedRawKmTime
      : undefined;

    // Extract and validate horse data
    const extractedData = extractAndValidateHorseData(horse);

    // ENHANCED: Always apply normalization to ensure predicted times
    log.debug(`🎯 Processing horse ${horse.horseId} (${extractedData.safeHorseName})`);
    log.debug(`  - Has raw KM time: ${!!rawKmTime}`);

    const modernNormalizedResult = applyHorseNormalization(
      horse,
      race,
      rawKmTime,
      extractedData,
      weights,
      postPositionCurves,
      rawTimeData // Pass raw time data for form calculation
    );

    log.debug(`  - Generated normalized result: ${!!modernNormalizedResult}`);
    if (modernNormalizedResult?.modernNormalizedTime) {
      const time = modernNormalizedResult.modernNormalizedTime;
      log.debug(`  - Predicted time: ${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths} ${(modernNormalizedResult as any).isEstimated ? '(EST)' : '(RAW)'}`);
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

  log.debug(`✅ ENHANCED PROCESSING COMPLETE - Race ${race.raceNumber}:`);
  log.debug(`  - Processed horses: ${horseResults.length}`);
  log.debug(`  - Horses with predicted times: ${horseResults.filter(h => h.modernNormalizedResult?.modernNormalizedTime).length}`);

  // Store race analysis data for post-race comparison if analysis date is provided
  if (analysisDate) {
    await storeRaceAnalysisData(race, horseResults, analysisDate);
  }

  return horseResults;
};
