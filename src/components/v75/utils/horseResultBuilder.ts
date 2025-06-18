
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

  // ENHANCED DEBUG: Trace predicted time data flow
  console.log(`🔍 PREDICTED TIME DEBUG - Horse ${horse.horseId} (${extractedData.safeHorseName}):`);
  console.log(`  - Raw KM Time exists: ${!!rawKmTime}`);
  console.log(`  - Modern normalized result exists: ${!!modernNormalizedResult}`);
  
  if (modernNormalizedResult) {
    console.log(`  - Modern normalized time:`, modernNormalizedResult.modernNormalizedTime);
    console.log(`  - Modern normalized time type:`, typeof modernNormalizedResult.modernNormalizedTime);
    console.log(`  - Is valid time object:`, modernNormalizedResult.modernNormalizedTime && 
      typeof modernNormalizedResult.modernNormalizedTime.minutes === 'number' &&
      typeof modernNormalizedResult.modernNormalizedTime.seconds === 'number' &&
      typeof modernNormalizedResult.modernNormalizedTime.tenths === 'number');
  }

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
 * Store race analysis data for post-race comparison with FIXED predicted time handling
 */
export const storeRaceAnalysisData = async (
  race: any,
  horses: V75HorseResult[],
  analysisDate: string
): Promise<void> => {
  try {
    console.log(`📊 CACHE STORAGE DEBUG - Race ${race.raceNumber}:`);
    
    const analysisHorses = horses.map(horse => {
      // FIXED: Properly extract the predicted time from modernNormalizedResult
      const predictedTimeFromResult = horse.modernNormalizedResult?.modernNormalizedTime;
      
      // Enhanced debug logging for predicted time extraction
      console.log(`  🐎 Horse ${horse.horseId} (${horse.horseName}):`);
      console.log(`    - Has modernNormalizedResult: ${!!horse.modernNormalizedResult}`);
      console.log(`    - Raw predicted time from modernNormalizedResult:`, predictedTimeFromResult);
      
      // FIXED: Validate and extract the predicted time properly
      let validPredictedTime = undefined;
      if (predictedTimeFromResult && 
          typeof predictedTimeFromResult === 'object' &&
          typeof predictedTimeFromResult.minutes === 'number' &&
          typeof predictedTimeFromResult.seconds === 'number' &&
          typeof predictedTimeFromResult.tenths === 'number') {
        
        // Create a clean copy of the predicted time object
        validPredictedTime = {
          minutes: predictedTimeFromResult.minutes,
          seconds: predictedTimeFromResult.seconds,
          tenths: predictedTimeFromResult.tenths
        };
        
        console.log(`    ✅ EXTRACTED valid predicted time:`, validPredictedTime);
        console.log(`    📝 Time format: ${validPredictedTime.minutes}:${validPredictedTime.seconds.toString().padStart(2, '0')}.${validPredictedTime.tenths}`);
      } else {
        console.log(`    ❌ Invalid or missing predicted time from modernNormalizedResult`);
        console.log(`    🔍 Debug info:`, {
          hasResult: !!horse.modernNormalizedResult,
          timeValue: predictedTimeFromResult,
          timeType: typeof predictedTimeFromResult,
          isObject: typeof predictedTimeFromResult === 'object',
          hasMinutes: predictedTimeFromResult?.minutes !== undefined,
          hasSeconds: predictedTimeFromResult?.seconds !== undefined,
          hasTenths: predictedTimeFromResult?.tenths !== undefined,
          minutesType: typeof predictedTimeFromResult?.minutes,
          secondsType: typeof predictedTimeFromResult?.seconds,
          tenthsType: typeof predictedTimeFromResult?.tenths
        });
      }

      return {
        horseId: horse.horseId,
        horseName: horse.horseName,
        postPosition: horse.postPosition,
        finalScore: horse.modernNormalizedResult?.adjustments?.total || 0,
        rank: 0, // Will be set after sorting
        predictedTime: validPredictedTime
      };
    });

    // Sort by final score to determine ranks
    analysisHorses.sort((a, b) => b.finalScore - a.finalScore);
    analysisHorses.forEach((horse, index) => {
      horse.rank = index + 1;
    });

    // Enhanced summary of what's being stored
    const horsesWithPredictedTimes = analysisHorses.filter(h => h.predictedTime);
    console.log(`📋 STORAGE SUMMARY - Race ${race.raceNumber}:`);
    console.log(`  - Total horses: ${analysisHorses.length}`);
    console.log(`  - Horses with predicted times: ${horsesWithPredictedTimes.length}`);
    console.log(`  - Horses without predicted times: ${analysisHorses.length - horsesWithPredictedTimes.length}`);
    
    // Sample display of horses with predicted times
    if (horsesWithPredictedTimes.length > 0) {
      console.log(`  🎯 Sample predicted times being stored:`);
      horsesWithPredictedTimes.slice(0, 3).forEach(horse => {
        if (horse.predictedTime) {
          console.log(`    - ${horse.horseName}: ${horse.predictedTime.minutes}:${horse.predictedTime.seconds.toString().padStart(2, '0')}.${horse.predictedTime.tenths}`);
        }
      });
    }

    await RaceAnalysisCache.storeRaceAnalysis(
      race.raceId,
      race.raceNumber,
      analysisDate,
      analysisHorses
    );

    console.log(`📊 Successfully stored analysis data for race ${race.raceNumber} with ${horsesWithPredictedTimes.length} predicted times`);
  } catch (error) {
    console.error('❌ Error storing race analysis data:', error);
  }
};
