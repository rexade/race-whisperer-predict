
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

  // ENHANCED DEBUG: Validate predicted time extraction
  console.log(`🔍 PREDICTED TIME DEBUG - Horse ${horse.horseId} (${extractedData.safeHorseName}):`);
  console.log(`  - Raw KM Time exists: ${!!rawKmTime}`);
  console.log(`  - Modern normalized result exists: ${!!modernNormalizedResult}`);
  
  if (modernNormalizedResult) {
    const isEstimated = (modernNormalizedResult as any).isEstimated;
    const predictedTime = modernNormalizedResult.modernNormalizedTime;
    console.log(`  - Predicted time object:`, predictedTime);
    console.log(`  - Time source: ${isEstimated ? 'ESTIMATED' : 'RAW DATA'}`);
    console.log(`  - Is valid time:`, predictedTime && 
      typeof predictedTime.minutes === 'number' &&
      typeof predictedTime.seconds === 'number' &&
      typeof predictedTime.tenths === 'number');
    
    if (predictedTime) {
      console.log(`  - Time format: ${predictedTime.minutes}:${predictedTime.seconds.toString().padStart(2, '0')}.${predictedTime.tenths}`);
    }
  }

  return horseResult;
};

/**
 * Store race analysis data with ENHANCED predicted time validation and storage
 */
export const storeRaceAnalysisData = async (
  race: any,
  horses: V75HorseResult[],
  analysisDate: string
): Promise<void> => {
  try {
    console.log(`📊 ENHANCED CACHE STORAGE - Race ${race.raceNumber}:`);
    
    const analysisHorses = horses.map(horse => {
      // ENHANCED: Extract predicted time with better validation
      const predictedTimeFromResult = horse.modernNormalizedResult?.modernNormalizedTime;
      const isEstimated = (horse.modernNormalizedResult as any)?.isEstimated || false;
      
      console.log(`  🐎 Horse ${horse.horseId} (${horse.horseName}):`);
      console.log(`    - Has modernNormalizedResult: ${!!horse.modernNormalizedResult}`);
      console.log(`    - Time source: ${isEstimated ? 'ESTIMATED' : 'RAW DATA'}`);
      console.log(`    - Predicted time from result:`, predictedTimeFromResult);
      
      // ENHANCED: Create valid predicted time with strict validation
      let validPredictedTime = undefined;
      if (predictedTimeFromResult && 
          typeof predictedTimeFromResult === 'object' &&
          typeof predictedTimeFromResult.minutes === 'number' &&
          typeof predictedTimeFromResult.seconds === 'number' &&
          typeof predictedTimeFromResult.tenths === 'number' &&
          !isNaN(predictedTimeFromResult.minutes) &&
          !isNaN(predictedTimeFromResult.seconds) &&
          !isNaN(predictedTimeFromResult.tenths)) {
        
        validPredictedTime = {
          minutes: predictedTimeFromResult.minutes,
          seconds: predictedTimeFromResult.seconds,
          tenths: predictedTimeFromResult.tenths
        };
        
        console.log(`    ✅ VALID predicted time extracted:`, validPredictedTime);
        console.log(`    📝 Format: ${validPredictedTime.minutes}:${validPredictedTime.seconds.toString().padStart(2, '0')}.${validPredictedTime.tenths} ${isEstimated ? '(EST)' : ''}`);
      } else {
        console.log(`    ❌ INVALID predicted time - will be excluded from cache`);
        console.log(`    🔍 Validation details:`, {
          hasResult: !!horse.modernNormalizedResult,
          timeValue: predictedTimeFromResult,
          isObject: typeof predictedTimeFromResult === 'object',
          hasMinutes: predictedTimeFromResult?.minutes !== undefined,
          hasSeconds: predictedTimeFromResult?.seconds !== undefined,
          hasTenths: predictedTimeFromResult?.tenths !== undefined,
          minutesValid: typeof predictedTimeFromResult?.minutes === 'number' && !isNaN(predictedTimeFromResult.minutes),
          secondsValid: typeof predictedTimeFromResult?.seconds === 'number' && !isNaN(predictedTimeFromResult.seconds),
          tenthsValid: typeof predictedTimeFromResult?.tenths === 'number' && !isNaN(predictedTimeFromResult.tenths)
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

    const horsesWithPredictedTimes = analysisHorses.filter(h => h.predictedTime);
    console.log(`📋 ENHANCED STORAGE SUMMARY - Race ${race.raceNumber}:`);
    console.log(`  - Total horses: ${analysisHorses.length}`);
    console.log(`  - Horses with valid predicted times: ${horsesWithPredictedTimes.length}`);
    console.log(`  - Horses without predicted times: ${analysisHorses.length - horsesWithPredictedTimes.length}`);
    
    // Sample display of valid predicted times being stored
    if (horsesWithPredictedTimes.length > 0) {
      console.log(`  🎯 Valid predicted times being stored:`);
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

    console.log(`📊 Successfully stored analysis data for race ${race.raceNumber} with ${horsesWithPredictedTimes.length} valid predicted times`);
  } catch (error) {
    console.error('❌ Error storing race analysis data:', error);
  }
};
