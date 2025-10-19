
import { V75HorseResult } from '../types/raceResultTypes';
import { ExtractedHorseData } from './horseDataExtractor';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { RaceAnalysisCache } from '../../../services/v75Cache/raceAnalysisCache';
import { analyzeHistorySource } from './confidenceCalculator';
import { partsToSeconds, secondsToParts, totalToKmSeconds } from './timeUtils';
import type { TimeSource } from '../types/raceResultTypes';

export const buildHorseResult = (
  horse: any,
  race: any,
  rawKmTime: any,
  modernNormalizedResult: any,
  extractedData: ExtractedHorseData,
  safeRaceTrack: string,
  rawTimeData?: HorseRawKmTime
): V75HorseResult => {
  // Analyze history source and calculate confidence
  const confidenceAnalysis = analyzeHistorySource(horse, rawTimeData);
  
  // Determine time source and uncertainty
  let timeSource: TimeSource = "normalized";
  let uncertain = false;
  let uncertaintyReason: V75HorseResult["uncertaintyReason"] | undefined = undefined;
  let finalConfidence = confidenceAnalysis.confidence;
  
  let shownTimeParts = modernNormalizedResult?.modernNormalizedTime ?? null;
  let finalNormalizedResult = modernNormalizedResult;
  
  // If normalization failed or no valid samples → use best raw time as fallback
  if (!shownTimeParts || (shownTimeParts.minutes === 0 && shownTimeParts.seconds === 0 && shownTimeParts.tenths === 0)) {
    console.log(`🔄 No normalized time for ${extractedData.safeHorseName}, attempting fallback...`);
    
    // Try to derive km time from best record
    const bestTotalSec = partsToSeconds(rawTimeData?.bestRecordTime);
    const kmSec = totalToKmSeconds(bestTotalSec, race?.distance);
    
    if (kmSec && kmSec > 0) {
      shownTimeParts = secondsToParts(kmSec);
      timeSource = "best_raw";
      uncertain = true;
      uncertaintyReason = rawTimeData?.validTimesCount ? "best_only" : "no_valid_samples";
      
      // Cap confidence when using fallback
      finalConfidence = Math.min(finalConfidence ?? 60, 60);
      
      // Create a synthetic normalized result with the fallback time
      finalNormalizedResult = {
        modernNormalizedTime: shownTimeParts,
        rawTime: rawKmTime || shownTimeParts,
        adjustments: { total: 0 },
        isEstimated: true,
        isFallback: true
      };
      
      console.log(`✅ Fallback time created: ${shownTimeParts.minutes}:${shownTimeParts.seconds.toString().padStart(2, '0')}.${shownTimeParts.tenths}`);
    } else {
      console.log(`❌ No fallback time available for ${extractedData.safeHorseName}`);
    }
  }
  
  const horseResult: V75HorseResult = {
    raceNumber: race.raceNumber,
    raceId: race.raceId,
    horseId: horse.horseId,
    horseName: extractedData.safeHorseName,
    postPosition: horse.postPosition,
    rawKmTime,
    modernNormalizedResult: finalNormalizedResult,
    bestRecordTime: rawTimeData?.bestRecordTime,
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
    homeTrack: extractedData.safeHorseTrack,
    isNotifiee: rawTimeData?.isNotifiee || false,
    dataSource: rawTimeData?.dataSource || 'recent',
    oldestRecordDate: rawTimeData?.oldestRecordDate,
    newestRecordDate: rawTimeData?.newestRecordDate,
    // Confidence metrics
    hasLocalHistory: confidenceAnalysis.hasLocalHistory,
    hasAnyHistory: confidenceAnalysis.hasAnyHistory,
    confidence: finalConfidence,
    historySource: confidenceAnalysis.historySource,
    // Provenance tracking
    timeSource,
    uncertain,
    uncertaintyReason
  };

  return horseResult;
};

/**
 * Store race analysis data with STRICT predicted time validation - no fallbacks allowed
 */
export const storeRaceAnalysisData = async (
  race: any,
  horses: V75HorseResult[],
  analysisDate: string
): Promise<void> => {
  try {
    console.log(`📊 STRICT CACHE STORAGE - Race ${race.raceNumber}:`);
    
    const analysisHorses = horses.map(horse => {
      // STRICT: Only use predicted times from actual modern normalization results
      const predictedTimeFromResult = horse.modernNormalizedResult?.modernNormalizedTime;
      const isEstimated = (horse.modernNormalizedResult as any)?.isEstimated || false;
      
      console.log(`  🐎 Horse ${horse.horseId} (${horse.horseName}):`);
      console.log(`    - Has modernNormalizedResult: ${!!horse.modernNormalizedResult}`);
      console.log(`    - Time source: ${isEstimated ? 'ESTIMATED' : 'RAW DATA'}`);
      console.log(`    - Has raw KM time: ${!!horse.rawKmTime}`);
      
      // STRICT VALIDATION: Only store predicted times from actual raw data (no estimates)
      let validPredictedTime = undefined;
      if (predictedTimeFromResult && 
          !isEstimated && // STRICT: Only store times from actual raw data
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
        
        console.log(`    ✅ VALID predicted time from RAW DATA:`, validPredictedTime);
        console.log(`    📝 Format: ${validPredictedTime.minutes}:${validPredictedTime.seconds.toString().padStart(2, '0')}.${validPredictedTime.tenths}`);
      } else {
        if (isEstimated) {
          console.log(`    🚫 REJECTED estimated time - only storing times from actual raw data`);
        } else {
          console.log(`    ❌ INVALID predicted time - validation failed`);
        }
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
    console.log(`📋 STRICT STORAGE SUMMARY - Race ${race.raceNumber}:`);
    console.log(`  - Total horses: ${analysisHorses.length}`);
    console.log(`  - Horses with VALID predicted times (RAW DATA ONLY): ${horsesWithPredictedTimes.length}`);
    console.log(`  - Horses without predicted times: ${analysisHorses.length - horsesWithPredictedTimes.length}`);
    
    if (horsesWithPredictedTimes.length > 0) {
      console.log(`  🎯 Valid predicted times being stored (RAW DATA ONLY):`);
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

    console.log(`📊 Successfully stored STRICT analysis data for race ${race.raceNumber} with ${horsesWithPredictedTimes.length} valid predicted times from raw data`);
  } catch (error) {
    console.error('❌ Error storing race analysis data:', error);
  }
};
