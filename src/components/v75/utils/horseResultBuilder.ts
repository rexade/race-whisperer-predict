
import { V75HorseResult } from '../types/raceResultTypes';
import { ExtractedHorseData } from './horseDataExtractor';
import { HorseRawKmTime } from '../../../services/types/kmTimeTypes';
import { RaceAnalysisCache } from '../../../services/v75Cache/raceAnalysisCache';
import { analyzeHistorySource } from './confidenceCalculator';
import { pickDisplayTime, isZeroParts } from './timeUtils';
import type { TimeSource } from '../types/raceResultTypes';
import { computeConfidenceFlags } from './confidenceFlags';
import { log } from '@/lib/logger';

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
  let finalNormalizedResult = modernNormalizedResult;

  // Use canonical picker to get the best available time
  const picked = pickDisplayTime({
    normalized: modernNormalizedResult?.modernNormalizedTime ?? null,
    bestRecordTime: rawTimeData?.bestRecordTime ?? null,
    rawKmTime: rawKmTime ?? null,
    distanceMeters: race?.distance,
  });

  log.debug(`🎯 Time picker for ${extractedData.safeHorseName}:`, {
    source: picked.source,
    hasParts: !!picked.parts,
    normalized: modernNormalizedResult?.modernNormalizedTime,
    bestRecord: rawTimeData?.bestRecordTime,
    rawKm: rawKmTime,
  });

  // If picker chose a non-normalized fallback, create synthetic result
  if (picked.source !== "normalized" && picked.parts) {
    finalNormalizedResult = {
      ...(modernNormalizedResult ?? {}),
      modernNormalizedTime: picked.parts,
      rawTime: modernNormalizedResult?.rawTime ?? picked.parts,
      adjustments: modernNormalizedResult?.adjustments ?? { total: 0 },
      isEstimated: true,
      isFallback: true,
    };

    timeSource = picked.source === "best_raw" ? "best_raw" : picked.source === "raw" ? "best_raw" : "none";

    if (picked.source !== "none") {
      uncertain = true;
      uncertaintyReason = rawTimeData?.validTimesCount ? "best_only" : "no_valid_samples";
      finalConfidence = Math.min(finalConfidence ?? 60, 60);
      log.debug(`⚠️ Using fallback time for ${extractedData.safeHorseName}: ${picked.parts.minutes}:${picked.parts.seconds.toString().padStart(2, '0')}.${picked.parts.tenths}`);
    }
  }

  // CRITICAL: Never allow 0:00.0 to reach the UI
  if (isZeroParts(finalNormalizedResult?.modernNormalizedTime)) {
    log.debug(`🚫 Rejecting zero time for ${extractedData.safeHorseName}, will render as "—"`);
    finalNormalizedResult = undefined as any;
    timeSource = "none";
    uncertain = false;
    uncertaintyReason = undefined;
  }

  // Synthesize warning from provenance flags if not explicitly set
  const synthesizedWarning = rawTimeData?.warning
    ? rawTimeData.warning
    : rawTimeData?.usedInvalidTimeFallback
      ? {
        type: 'invalid-record' as const,
        reason: 'fastest-invalid',
        message: 'Used invalid result to avoid 0:00.0; prediction may be unreliable',
      }
      : (rawTimeData?.confidenceMultiplier !== undefined && rawTimeData.confidenceMultiplier <= 0.5 && rawTimeData.usedExtendedFallback)
        ? {
          type: 'invalid-record' as const,
          reason: 'extended-single',
          message: 'Used single record from extended; prediction may be unreliable',
        }
        : undefined;

  if (synthesizedWarning) {
    log.debug(`⚠️ Warning synthesized for ${extractedData.safeHorseName}:`, synthesizedWarning, {
      usedInvalidTimeFallback: rawTimeData?.usedInvalidTimeFallback,
      confidenceMultiplier: rawTimeData?.confidenceMultiplier,
      usedExtendedFallback: rawTimeData?.usedExtendedFallback,
    });
  }

  // Compute per-horse confidence/sanity flags (do not affect score, annotate trust)
  const confidenceFlags = computeConfidenceFlags(
    rawTimeData,
    rawKmTime,
    horse.driver?.winPercentage2025
  );

  const horseResult: V75HorseResult = {
    raceNumber: race.raceNumber,
    raceId: race.raceId,
    horseKey: horse.horseKey,
    horseId: horse.horseId,
    horseName: extractedData.safeHorseName,
    postPosition: horse.postPosition,
    rawKmTime,
    rawTimeData,
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
    shoesFrontChanged: (horse as any).shoes?.frontChanged,
    shoesBackChanged: (horse as any).shoes?.backChanged,
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
    uncertaintyReason,
    // Invalid-time fallback warning (synthesized from provenance if needed)
    warning: synthesizedWarning,
    usedInvalidTimeFallback: rawTimeData?.usedInvalidTimeFallback,
    usedExtendedFallback: rawTimeData?.usedExtendedFallback,
    confidenceMultiplier: rawTimeData?.confidenceMultiplier,
    // Per-horse sanity flags (annotation only, not used in scoring)
    confidenceFlags,
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
    log.debug(`📊 STRICT CACHE STORAGE - Race ${race.raceNumber}:`);

    const analysisHorses = horses.map(horse => {
      // STRICT: Only use predicted times from actual modern normalization results
      const predictedTimeFromResult = horse.modernNormalizedResult?.modernNormalizedTime;
      const isEstimated = (horse.modernNormalizedResult as any)?.isEstimated || false;

      log.debug(`  🐎 Horse ${horse.horseId} (${horse.horseName}):`);
      log.debug(`    - Has modernNormalizedResult: ${!!horse.modernNormalizedResult}`);
      log.debug(`    - Time source: ${isEstimated ? 'ESTIMATED' : 'RAW DATA'}`);
      log.debug(`    - Has raw KM time: ${!!horse.rawKmTime}`);

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

        log.debug(`    ✅ VALID predicted time from RAW DATA:`, validPredictedTime);
        log.debug(`    📝 Format: ${validPredictedTime.minutes}:${validPredictedTime.seconds.toString().padStart(2, '0')}.${validPredictedTime.tenths}`);
      } else {
        if (isEstimated) {
          log.debug(`    🚫 REJECTED estimated time - only storing times from actual raw data`);
        } else {
          log.debug(`    ❌ INVALID predicted time - validation failed`);
        }
      }

      return {
        horseKey: horse.horseKey,
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
    log.debug(`📋 STRICT STORAGE SUMMARY - Race ${race.raceNumber}:`);
    log.debug(`  - Total horses: ${analysisHorses.length}`);
    log.debug(`  - Horses with VALID predicted times (RAW DATA ONLY): ${horsesWithPredictedTimes.length}`);
    log.debug(`  - Horses without predicted times: ${analysisHorses.length - horsesWithPredictedTimes.length}`);

    if (horsesWithPredictedTimes.length > 0) {
      log.debug(`  🎯 Valid predicted times being stored (RAW DATA ONLY):`);
      horsesWithPredictedTimes.slice(0, 3).forEach(horse => {
        if (horse.predictedTime) {
          log.debug(`    - ${horse.horseName}: ${horse.predictedTime.minutes}:${horse.predictedTime.seconds.toString().padStart(2, '0')}.${horse.predictedTime.tenths}`);
        }
      });
    }

    await RaceAnalysisCache.storeRaceAnalysis(
      race.raceId,
      race.raceNumber,
      analysisDate,
      analysisHorses
    );

    log.debug(`📊 Successfully stored STRICT analysis data for race ${race.raceNumber} with ${horsesWithPredictedTimes.length} valid predicted times from raw data`);
  } catch (error) {
    log.error('❌ Error storing race analysis data:', error);
  }
};
