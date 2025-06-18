
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
 * Store race analysis data for post-race comparison with enhanced predicted time handling
 */
export const storeRaceAnalysisData = async (
  race: any,
  horses: V75HorseResult[],
  analysisDate: string
): Promise<void> => {
  try {
    console.log(`📊 CACHE STORAGE DEBUG - Race ${race.raceNumber}:`);
    
    const analysisHorses = horses.map(horse => {
      const predictedTime = horse.modernNormalizedResult?.modernNormalizedTime;
      
      // Enhanced debug logging for predicted time
      console.log(`  🐎 Horse ${horse.horseId} (${horse.horseName}):`);
      console.log(`    - Has modernNormalizedResult: ${!!horse.modernNormalizedResult}`);
      console.log(`    - Predicted time from result:`, predictedTime);
      console.log(`    - Predicted time is valid:`, predictedTime && 
        typeof predictedTime.minutes === 'number' &&
        typeof predictedTime.seconds === 'number' &&
        typeof predictedTime.tenths === 'number');
      
      // Ensure we have a valid predicted time object before storing
      let validPredictedTime = undefined;
      if (predictedTime && 
          typeof predictedTime.minutes === 'number' &&
          typeof predictedTime.seconds === 'number' &&
          typeof predictedTime.tenths === 'number') {
        validPredictedTime = {
          minutes: predictedTime.minutes,
          seconds: predictedTime.seconds,
          tenths: predictedTime.tenths
        };
        console.log(`    ✅ Valid predicted time will be stored:`, validPredictedTime);
      } else {
        console.log(`    ❌ Invalid or missing predicted time - will store as undefined`);
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

    // Final summary of what's being stored
    const horsesWithPredictedTimes = analysisHorses.filter(h => h.predictedTime);
    console.log(`📋 STORAGE SUMMARY - Race ${race.raceNumber}:`);
    console.log(`  - Total horses: ${analysisHorses.length}`);
    console.log(`  - Horses with predicted times: ${horsesWithPredictedTimes.length}`);
    console.log(`  - Horses without predicted times: ${analysisHorses.length - horsesWithPredictedTimes.length}`);

    await RaceAnalysisCache.storeRaceAnalysis(
      race.raceId,
      race.raceNumber,
      analysisDate,
      analysisHorses
    );

    console.log(`📊 Stored analysis data for race ${race.raceNumber} with enhanced time predictions`);
  } catch (error) {
    console.error('❌ Error storing race analysis data:', error);
  }
};
