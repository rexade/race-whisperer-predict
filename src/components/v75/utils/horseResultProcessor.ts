
import { V75RaceData } from '../../../services/v75CalendarApi';
import { KmTime } from '../../../services/types/kmTimeTypes';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { V75HorseResult } from '../hooks/useV75Analysis';
import { extractHorseNameAsString, extractDriverNameAsString, extractTrackNameAsString } from './dataExtraction';

export const processHorseResults = (
  race: V75RaceData,
  rawKmTimes: Array<{ horseId: number; best3Average?: KmTime }>,
  weights: NormalizationWeights
): V75HorseResult[] => {
  const safeRaceTrack = extractTrackNameAsString(race.track);
  const horseResults: V75HorseResult[] = [];

  for (const horse of race.horses) {
    const rawTimeData = rawKmTimes.find(rt => rt.horseId === horse.horseId);
    const rawKmTime = rawTimeData?.best3Average;

    // CRITICAL: Extract ALL string fields as strings to prevent object rendering
    const safeHorseName = extractHorseNameAsString(horse.name);
    const safeDriverName = extractDriverNameAsString(horse.driver);
    const safeHorseTrack = extractTrackNameAsString(horse.homeTrack);

    console.log(`🛡️ FINAL SAFETY CHECK - Horse ${horse.horseId}:`);
    console.log(`  - Horse name: "${safeHorseName}" (type: ${typeof safeHorseName})`);
    console.log(`  - Driver name: "${safeDriverName}" (type: ${typeof safeDriverName})`);
    console.log(`  - Home track: "${safeHorseTrack}" (type: ${typeof safeHorseTrack})`);
    
    // ENHANCED shoes and sulky logging and validation
    console.log(`👟 Horse ${horse.horseId} ENHANCED shoes data validation:`, {
      shoesObject: horse.shoes,
      frontShoes: horse.shoes?.front,
      backShoes: horse.shoes?.back,
      frontType: typeof horse.shoes?.front,
      backType: typeof horse.shoes?.back,
      frontBoolean: Boolean(horse.shoes?.front),
      backBoolean: Boolean(horse.shoes?.back)
    });
    
    console.log(`🛷 Horse ${horse.horseId} ENHANCED sulky data validation:`, {
      sulkyObject: horse.sulky,
      sulkyType: horse.sulky?.type,
      sulkyTypeType: typeof horse.sulky?.type,
      sulkyTypeString: String(horse.sulky?.type || 'VA')
    });

    // Validate that ALL critical string fields are actually strings
    if (typeof safeHorseName !== 'string') {
      console.error(`🚨 CRITICAL ERROR - Horse name is not a string after extraction! Type: ${typeof safeHorseName}, Value:`, safeHorseName);
      throw new Error(`Horse name extraction failed for horse ${horse.horseId}`);
    }

    if (typeof safeDriverName !== 'string') {
      console.error(`🚨 CRITICAL ERROR - Driver name is not a string after extraction! Type: ${typeof safeDriverName}, Value:`, safeDriverName);
      throw new Error(`Driver name extraction failed for horse ${horse.horseId}`);
    }

    if (typeof safeHorseTrack !== 'string') {
      console.error(`🚨 CRITICAL ERROR - Home track is not a string after extraction! Type: ${typeof safeHorseTrack}, Value:`, safeHorseTrack);
      throw new Error(`Home track extraction failed for horse ${horse.horseId}`);
    }

    let modernNormalizedResult;

    if (rawKmTime) {
      // ENHANCED shoes handling for normalization with proper boolean conversion
      const frontShoesBoolean = Boolean(horse.shoes?.front);
      const backShoesBoolean = Boolean(horse.shoes?.back);
      const frontShoesStr = frontShoesBoolean ? "1" : "0";
      const backShoesStr = backShoesBoolean ? "1" : "0";
      
      console.log(`🛡️ Normalization shoes input for horse ${horse.horseId}:`, {
        frontShoesBoolean,
        backShoesBoolean,
        frontShoesStr,
        backShoesStr
      });

      // ENHANCED sulky handling with proper string conversion
      const sulkyTypeString = String(horse.sulky?.type || "VA");
      console.log(`🛡️ Normalization sulky input for horse ${horse.horseId}:`, {
        originalSulkyType: horse.sulky?.type,
        sulkyTypeString
      });

      const factors: ModernNormalizationFactors = {
        postPosition: horse.postPosition,
        distance: horse.distance,
        raceDistance: race.distance,
        startMethod: race.startMethod,
        shoesFront: frontShoesStr,
        shoesBack: backShoesStr,
        sulkyType: sulkyTypeString,
        homeTrack: safeHorseTrack,
        driverExperience: horse.driver.experience,
        driverWinPercentage: horse.driver.winPercentage,
        driverWinPercentage2025: horse.driver.winPercentage2025,
        horseForm: horse.statistics.winPercentage,
        raceType: 'trot',
        timeOfDay: '',
        startPoints: horse.statistics.startPoints,
        placePercentage: horse.statistics.placePercentage,
        horseWinPercentage: horse.statistics.winPercentage,
        earningsPerStart: horse.statistics.earningsPerStart
      };

      modernNormalizedResult = applyModernKmNormalization(rawKmTime, factors, weights);
    }

    const horseResult: V75HorseResult = {
      raceNumber: race.raceNumber,
      raceId: race.raceId,
      horseId: horse.horseId,
      horseName: safeHorseName,
      postPosition: horse.postPosition,
      rawKmTime,
      modernNormalizedResult,
      driverName: safeDriverName,
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
      sulkyType: String(horse.sulky?.type || "VA"),
      shoesFront: Boolean(horse.shoes?.front),
      shoesBack: Boolean(horse.shoes?.back),
      homeTrack: safeHorseTrack
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

    horseResults.push(horseResult);
  }

  return horseResults;
};
