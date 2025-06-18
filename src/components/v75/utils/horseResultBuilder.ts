
import { V75HorseResult } from '../types/raceResultTypes';
import { ExtractedHorseData } from './horseDataExtractor';
import { RaceAnalysisCache } from '../../../services/v75Cache/raceAnalysisCache';

export const buildHorseResult = (
  horse: any,
  race: any,
  rawKmTime: any,
  modernNormalizedResult: any,
  extractedData: ExtractedHorseData,
  safeRaceTrack: string
): V75HorseResult => {
  const horseResult: V75HorseResult = {
    raceNumber: race.raceNumber,
    raceId: race.raceId,
    horseId: horse.horseId,
    horseName: extractedData.safeHorseName,
    postPosition: horse.postPosition,
    rawKmTime,
    modernNormalizedResult,
    driverName: extractedData.safeDriverName,
    track: safeRaceTrack,
    distance: horse.distance,
    startMethod: race.startMethod,
    statistics: {
      startPoints: horse.statistics.startPoints,
      placePercentage: horse.statistics.placePercentage,
      winPercentage: horse.statistics.winPercentage,
      earningsPerStart: horse.statistics.earningsPerStart,
    },
    driver2025WinPercentage: horse.driver.winPercentage2025,
    sulkyType: extractedData.sulkyTypeString,
    shoesFront: extractedData.frontShoesBoolean,
    shoesBack: extractedData.backShoesBoolean,
    homeTrack: extractedData.safeHorseTrack
  };

  // FINAL VALIDATION: Double check that critical fields are strings and shoes/sulky are properly set
  console.log(`🔒 FINAL VALIDATION - Horse ${horse.horseId}:`, {
    horseName: horseResult.horseName,
    horseNameType: typeof horseResult.horseName,
    driverName: horseResult.driverName,
    driverNameType: typeof horseResult.driverName,
    track: horseResult.track,
    trackType: typeof horseResult.track,
    homeTrack: horseResult.homeTrack,
    homeTrackType: typeof horseResult.homeTrack,
    shoesFront: horseResult.shoesFront,
    shoesFrontType: typeof horseResult.shoesFront,
    shoesBack: horseResult.shoesBack,
    shoesBackType: typeof horseResult.shoesBack,
    sulkyType: horseResult.sulkyType,
    sulkyTypeType: typeof horseResult.sulkyType
  });

  return horseResult;
};

/**
 * Store race analysis data for post-race comparison
 */
export const storeRaceAnalysisData = async (
  race: any,
  horses: V75HorseResult[],
  analysisDate: string
): Promise<void> => {
  try {
    const analysisHorses = horses.map(horse => ({
      horseId: horse.horseId,
      horseName: horse.horseName,
      postPosition: horse.postPosition,
      finalScore: horse.modernNormalizedResult?.adjustments?.total || 0,
      rank: 0, // Will be set after sorting
      predictedTime: horse.modernNormalizedResult?.modernNormalizedTime
    }));

    // Sort by final score to determine ranks
    analysisHorses.sort((a, b) => b.finalScore - a.finalScore);
    analysisHorses.forEach((horse, index) => {
      horse.rank = index + 1;
    });

    await RaceAnalysisCache.storeRaceAnalysis(
      race.raceId,
      race.raceNumber,
      analysisDate,
      analysisHorses
    );

    console.log(`📊 Stored analysis data for race ${race.raceNumber} with time predictions`);
  } catch (error) {
    console.error('❌ Error storing race analysis data:', error);
  }
};
