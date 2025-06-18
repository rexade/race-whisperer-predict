
import { V75RaceData } from '../../../services/v75CalendarApi';
import { KmTime } from '../../../services/types/kmTimeTypes';
import { NormalizationWeights } from '../../../services/modernKm/index';
import { V75HorseResult } from '../types/raceResultTypes';
import { extractTrackNameAsString } from './dataExtraction';
import { extractAndValidateHorseData } from './horseDataExtractor';
import { applyHorseNormalization } from './horseNormalizationProcessor';
import { buildHorseResult, storeRaceAnalysisData } from './horseResultBuilder';

export const processHorseResults = async (
  race: V75RaceData,
  rawKmTimes: Array<{ horseId: number; best3Average?: KmTime }>,
  weights: NormalizationWeights,
  analysisDate?: string
): Promise<V75HorseResult[]> => {
  const safeRaceTrack = extractTrackNameAsString(race.track);
  const horseResults: V75HorseResult[] = [];

  for (const horse of race.horses) {
    const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
    const rawKmTime = rawTimeData?.best3Average;

    // Extract and validate horse data
    const extractedData = extractAndValidateHorseData(horse);

    let modernNormalizedResult;

    if (rawKmTime) {
      modernNormalizedResult = applyHorseNormalization(
        horse,
        race,
        rawKmTime,
        extractedData,
        weights
      );
    }

    // Build the final horse result
    const horseResult = buildHorseResult(
      horse,
      race,
      rawKmTime,
      modernNormalizedResult,
      extractedData,
      safeRaceTrack
    );

    horseResults.push(horseResult);
  }

  // Store race analysis data for post-race comparison if analysis date is provided
  if (analysisDate) {
    await storeRaceAnalysisData(race, horseResults, analysisDate);
  }

  return horseResults;
};
