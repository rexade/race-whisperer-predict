
import { KmTime } from '../../../services/types/kmTimeTypes';
import {
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors,
  PostPositionCurves
} from '../../../services/modernKm/index';
import { ExtractedHorseData } from './horseDataExtractor';
import { HorseDebugger } from '../../../services/debugging/horseDebugger';
import { EquipmentValidator } from '../../../services/validation/equipmentValidator';
import { EquipmentDebugger } from '../../../services/debugging/equipmentDebugger';
import { log } from '@/lib/logger';

/**
 * Create a fallback KM time based on horse statistics and race characteristics
 * ONLY used when absolutely necessary for UI display
 */
const createFallbackKmTime = (
  horse: any,
  race: any,
  extractedData: ExtractedHorseData
): KmTime => {
  log.debug(`🎯 Creating fallback KM time for horse ${horse.horseId} (${extractedData.safeHorseName})`);
  log.debug(`⚠️ WARNING: This is estimated data and will NOT be used for post-race comparisons`);

  // Base time calculation using race distance and typical trotting speed
  const baseKmSpeed = 1.65; // minutes per km
  const baseTimeMinutes = baseKmSpeed;

  // Apply adjustments based on available statistics
  let adjustedTimeMinutes = baseTimeMinutes;

  // Adjust based on horse performance statistics
  if (horse.statistics?.winPercentage > 0) {
    const winPercentageAdjustment = (20 - horse.statistics.winPercentage) * 0.001;
    adjustedTimeMinutes += winPercentageAdjustment;
    log.debug(`  - Win % adjustment (${horse.statistics.winPercentage}%): ${winPercentageAdjustment.toFixed(4)} minutes`);
  }

  if (horse.statistics?.startPoints > 0) {
    const startPointsAdjustment = (70 - horse.statistics.startPoints) * 0.0002;
    adjustedTimeMinutes += startPointsAdjustment;
    log.debug(`  - Start points adjustment (${horse.statistics.startPoints}): ${startPointsAdjustment.toFixed(4)} minutes`);
  }

  // Post position penalty
  const postPositionPenalty = (horse.postPosition - 1) * 0.002;
  adjustedTimeMinutes += postPositionPenalty;
  log.debug(`  - Post position penalty (${horse.postPosition}): ${postPositionPenalty.toFixed(4)} minutes`);

  // Convert to KmTime format
  const totalSeconds = adjustedTimeMinutes * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const seconds = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - seconds) * 10);

  const fallbackTime: KmTime = {
    minutes,
    seconds,
    tenths
  };

  log.debug(`✅ Generated fallback KM time: ${minutes}:${seconds.toString().padStart(2, '0')}.${tenths} (ESTIMATED - NOT FOR PREDICTIONS)`);

  return fallbackTime;
};

export const applyHorseNormalization = (
  horse: any,
  race: any,
  rawKmTime: KmTime | undefined,
  extractedData: ExtractedHorseData,
  weights: NormalizationWeights,
  postPositionCurves?: PostPositionCurves,
  rawTimeData?: { allTimes?: Array<{ raceDate: string; finishOrder?: number }> }
) => {
  log.debug(`🔍 STRICT NORMALIZATION - Horse ${horse.horseId} (${extractedData.safeHorseName}):`);
  log.debug(`  - Has raw KM time: ${!!rawKmTime}`);

  // ENHANCED: Log equipment extraction and validate
  EquipmentDebugger.logEquipmentExtraction(
    horse.horseId || 0,
    extractedData.safeHorseName,
    { sulky: horse.sulky, shoes: horse.shoes, equipment: horse.equipment },
    extractedData,
    'horseNormalizationProcessor'
  );

  const equipmentValidation = EquipmentValidator.validateAndCorrectEquipmentData(
    horse.horseId || 0,
    extractedData.safeHorseName,
    extractedData.sulkyTypeString,
    extractedData.frontShoesStr,
    extractedData.backShoesStr
  );

  EquipmentDebugger.logEquipmentValidation(
    horse.horseId || 0,
    extractedData.safeHorseName,
    equipmentValidation,
    {
      sulkyType: extractedData.sulkyTypeString,
      frontShoes: extractedData.frontShoesStr,
      backShoes: extractedData.backShoesStr
    }
  );

  // Use corrected equipment data for normalization
  const correctedEquipment = equipmentValidation.correctedData || {
    sulkyType: extractedData.sulkyTypeString,
    frontShoes: extractedData.frontShoesStr,
    backShoes: extractedData.backShoesStr
  };

  HorseDebugger.log(horse.horseId, extractedData.safeHorseName, 'NORMALIZATION_START', {
    hasRawKmTime: !!rawKmTime,
    rawKmTime: rawKmTime,
    extractedData: extractedData,
    raceInfo: {
      distance: race.distance,
      startMethod: race.startMethod,
      postPosition: horse.postPosition
    }
  });

  // STRICT: Only process horses with actual raw KM times for predictions
  if (!rawKmTime) {
    log.debug(`  🚫 NO RAW KM TIME - Creating fallback for UI display only`);

    const fallbackTime = createFallbackKmTime(horse, race, extractedData);

    // Extract recent races for form calculation (even for fallback, though it may be empty)
    let recentRaces: Array<{ place: number; date: string }> | undefined;
    if (rawTimeData?.allTimes && rawTimeData.allTimes.length > 0) {
      recentRaces = rawTimeData.allTimes
        .filter(t => t.finishOrder !== undefined && t.finishOrder > 0 && t.raceDate)
        .map(t => ({
          place: t.finishOrder!,
          date: t.raceDate
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    }

    const factors: ModernNormalizationFactors = {
      postPosition: horse.postPosition,
      distance: horse.distance,
      raceDistance: race.distance,
      startMethod: race.startMethod,
      shoesFront: correctedEquipment.frontShoes,
      shoesBack: correctedEquipment.backShoes,
      sulkyType: correctedEquipment.sulkyType,
      homeTrack: extractedData.safeHorseTrack,
      raceTrack: race.track || "Unknown",
      driverExperience: horse.driver.experience,
      driverWinPercentage: horse.driver2025WinPercentage || horse.driver.winPercentage2025 || horse.driver.winPercentage || 0,
      horseForm: horse.statistics.winPercentage,
      startPoints: horse.statistics.startPoints,
      placePercentage: horse.statistics.placePercentage,
      horseWinPercentage: horse.statistics.winPercentage,
      earningsPerStart: horse.statistics.earningsPerStart,
      horseId: horse.horseId,
      horseName: extractedData.safeHorseName,
      recentRaces // Add recent races for form calculation
    };

    const result = applyModernKmNormalization(fallbackTime, factors, weights, postPositionCurves);

    // Mark as estimated — prevents storage for post-race comparison
    result.isEstimated = true;

    log.debug(`  - Fallback normalized time: ${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths} (ESTIMATED - UI ONLY)`);

    return result;
  }

  // Process horses with actual raw KM times
  log.debug(`  ✅ Processing with raw KM time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);

  // Extract recent races for form calculation
  let recentRaces: Array<{ place: number; date: string }> | undefined;
  if (rawTimeData?.allTimes && rawTimeData.allTimes.length > 0) {
    recentRaces = rawTimeData.allTimes
      .filter(t => t.finishOrder !== undefined && t.finishOrder > 0 && t.raceDate)
      .map(t => ({
        place: t.finishOrder!,
        date: t.raceDate
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Take up to 10 most recent races

    if (recentRaces.length > 0) {
      log.debug(`  📊 Found ${recentRaces.length} recent races for form calculation`);
    }
  }

  const factors: ModernNormalizationFactors = {
    postPosition: horse.postPosition,
    distance: horse.distance,
    raceDistance: race.distance,
    startMethod: race.startMethod,
    shoesFront: correctedEquipment.frontShoes,
    shoesBack: correctedEquipment.backShoes,
    sulkyType: correctedEquipment.sulkyType,
    homeTrack: extractedData.safeHorseTrack,
    raceTrack: race.track || "Unknown",
    driverExperience: horse.driver.experience,
    driverWinPercentage: horse.driver2025WinPercentage || horse.driver.winPercentage2025 || horse.driver.winPercentage || 0,

    horseForm: horse.statistics.winPercentage,
    startPoints: horse.statistics.startPoints,
    placePercentage: horse.statistics.placePercentage,
    horseWinPercentage: horse.statistics.winPercentage,
    earningsPerStart: horse.statistics.earningsPerStart,
    horseId: horse.horseId,
    horseName: extractedData.safeHorseName,
    recentRaces // Add recent races for form calculation
  };

  const result = applyModernKmNormalization(rawKmTime, factors, weights, postPositionCurves);

  // Log modern normalization breakdown
  if (result) {
    HorseDebugger.logModernNormalizationBreakdown(
      horse.horseId,
      extractedData.safeHorseName,
      rawKmTime,
      result.adjustments,
      result.modernNormalizedTime
    );
  }

  // Mark as from raw data — will be stored for post-race comparison
  result.isEstimated = false;

  log.debug(`  - Final normalized time: ${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths} (FROM RAW DATA - WILL BE CACHED)`);

  HorseDebugger.logFinalResult(horse.horseId, extractedData.safeHorseName, rawKmTime, result);

  return result;
};
