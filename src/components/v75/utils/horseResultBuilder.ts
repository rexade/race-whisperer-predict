
import { V75HorseResult } from '../types/raceResultTypes';
import { ExtractedHorseData } from './horseDataExtractor';

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
