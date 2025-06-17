
import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import { 
  ModernKmNormalizedResult, 
  ModernNormalizationFactors, 
  NormalizationWeights, 
  DEFAULT_WEIGHTS 
} from './types';
import { calculatePostPositionAdjustment } from './postPositionCalculator';
import { calculateShoeAdjustment, calculateSulkyAdjustment } from './equipmentCalculators';
import { calculateDriverAdjustment, calculateDriver2025Adjustment } from './driverCalculators';
import { 
  calculateStartPointsAdjustment,
  calculatePlacePercentageAdjustment,
  calculateHorseWinPercentageAdjustment,
  calculateEarningsPerStartAdjustment
} from './performanceCalculators';
import {
  calculateDistanceAdjustment,
  calculateRaceTypeAdjustment,
  calculateTimeOfDayAdjustment
} from './adjustmentCalculators';

/**
 * Applies modern normalization to a RAW KM time using race-specific factors
 */
export const applyModernKmNormalization = (
  rawKmTime: KmTime,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS
): ModernKmNormalizedResult => {
  console.log(`\n=== Enhanced Modern KM Normalization ===`);
  console.log(`RAW Time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);
  console.log(`Start Method: ${factors.startMethod}`);
  
  let adjustments = {
    postPosition: 0,
    equipment: 0,
    driver: 0,
    driver2025: 0,
    track: 0,
    form: 0,
    distance: 0,
    raceType: 0,
    timeOfDay: 0,
    startPoints: 0,
    placePercentage: 0,
    horseWinPercentage: 0,
    earningsPerStart: 0,
    total: 0
  };

  // FIRST: Apply volte start penalty if applicable (this is baseline normalization)
  let baseNormalizedTime = cloneKmTime(rawKmTime);
  const startMethodLower = factors.startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  if (isVolteStart) {
    baseNormalizedTime = addSecondsToKmTime(baseNormalizedTime, 1.0);
    console.log(`🔥 VOLTE START DETECTED (${factors.startMethod}) - Added 1.0s penalty (raw time assumes auto) → ${baseNormalizedTime.minutes}:${baseNormalizedTime.seconds.toString().padStart(2, '0')}.${baseNormalizedTime.tenths}`);
  } else {
    console.log(`Auto start detected (${factors.startMethod}) - No volte penalty applied`);
  }

  // Post Position Adjustment using baseline data
  const postPosAdjustment = calculatePostPositionAdjustment(
    factors.postPosition, 
    factors.startMethod
  ) * weights.postPosition;
  adjustments.postPosition = postPosAdjustment;

  // Equipment Adjustments
  const equipmentAdjustment = (
    calculateShoeAdjustment(factors.shoesFront, factors.shoesBack) +
    calculateSulkyAdjustment(factors.sulkyType)
  ) * weights.shoeType;
  adjustments.equipment = equipmentAdjustment;

  // Driver Experience Adjustment
  const driverAdjustment = calculateDriverAdjustment(
    factors.driverExperience,
    factors.driverWinPercentage,
    factors.postPosition
  ) * weights.driverExperience;
  adjustments.driver = driverAdjustment;

  // Driver 2025 Performance Adjustment
  const driver2025Adjustment = calculateDriver2025Adjustment(
    factors.driverWinPercentage2025,
    factors.postPosition
  ) * weights.driver2025Performance;
  adjustments.driver2025 = driver2025Adjustment;

  // Track Familiarity (placeholder)
  const trackAdjustment = 0 * weights.trackFamiliarity;
  adjustments.track = trackAdjustment;

  // Form Adjustment (placeholder)
  const formAdjustment = 0 * weights.form;
  adjustments.form = formAdjustment;

  // Distance Adjustment
  const distanceAdjustment = calculateDistanceAdjustment(
    factors.distance,
    factors.raceDistance
  ) * weights.distanceAdjustment;
  adjustments.distance = distanceAdjustment;

  // Race Type Adjustment
  const raceTypeAdjustment = calculateRaceTypeAdjustment(
    factors.raceType || ""
  ) * weights.raceType;
  adjustments.raceType = raceTypeAdjustment;

  // Time of Day Adjustment
  const timeOfDayAdjustment = calculateTimeOfDayAdjustment(
    factors.timeOfDay || ""
  ) * weights.timeOfDay;
  adjustments.timeOfDay = timeOfDayAdjustment;

  // NEW: Start Points Adjustment
  const startPointsAdjustment = calculateStartPointsAdjustment(
    factors.startPoints
  ) * weights.startPoints;
  adjustments.startPoints = startPointsAdjustment;

  // NEW: Place Percentage Adjustment
  const placePercentageAdjustment = calculatePlacePercentageAdjustment(
    factors.placePercentage
  ) * weights.placePercentage;
  adjustments.placePercentage = placePercentageAdjustment;

  // NEW: Horse Win Percentage Adjustment
  const horseWinPercentageAdjustment = calculateHorseWinPercentageAdjustment(
    factors.horseWinPercentage
  ) * weights.horseWinPercentage;
  adjustments.horseWinPercentage = horseWinPercentageAdjustment;

  // NEW: Earnings Per Start Adjustment
  const earningsPerStartAdjustment = calculateEarningsPerStartAdjustment(
    factors.earningsPerStart
  ) * weights.earningsPerStart;
  adjustments.earningsPerStart = earningsPerStartAdjustment;

  // Calculate total adjustment (applied to the baseline normalized time)
  adjustments.total = postPosAdjustment + equipmentAdjustment + driverAdjustment + 
                    driver2025Adjustment + trackAdjustment + formAdjustment +
                    distanceAdjustment + raceTypeAdjustment + timeOfDayAdjustment +
                    startPointsAdjustment + placePercentageAdjustment + 
                    horseWinPercentageAdjustment + earningsPerStartAdjustment;

  // Apply total adjustment to the baseline normalized KM time
  const modernNormalizedKmTime = addSecondsToKmTime(baseNormalizedTime, adjustments.total);

  console.log(`Enhanced KM Adjustments (applied to ${isVolteStart ? 'volte-normalized' : 'raw'} time):`);
  console.log(`  Post Position (${factors.postPosition}): ${postPosAdjustment.toFixed(3)}s`);
  console.log(`  Equipment: ${equipmentAdjustment.toFixed(3)}s`);
  console.log(`  Driver: ${driverAdjustment.toFixed(3)}s`);
  console.log(`  Driver 2025: ${driver2025Adjustment.toFixed(3)}s`);
  console.log(`  Distance: ${distanceAdjustment.toFixed(3)}s`);
  console.log(`  Race Type: ${raceTypeAdjustment.toFixed(3)}s`);
  console.log(`  Time of Day: ${timeOfDayAdjustment.toFixed(3)}s`);
  console.log(`  Start Points: ${startPointsAdjustment.toFixed(3)}s`);
  console.log(`  Place %: ${placePercentageAdjustment.toFixed(3)}s`);
  console.log(`  Horse Win %: ${horseWinPercentageAdjustment.toFixed(3)}s`);
  console.log(`  Earnings/Start: ${earningsPerStartAdjustment.toFixed(3)}s`);
  console.log(`  Total: ${adjustments.total.toFixed(3)}s`);
  console.log(`Enhanced Modern Normalized KM Time: ${modernNormalizedKmTime.minutes}:${modernNormalizedKmTime.seconds.toString().padStart(2, '0')}.${modernNormalizedKmTime.tenths}`);

  return {
    rawTime: cloneKmTime(rawKmTime),
    modernNormalizedTime: modernNormalizedKmTime,
    adjustments
  };
};

export const getDefaultWeights = (): NormalizationWeights => ({ ...DEFAULT_WEIGHTS });

// Re-export types for convenience
export type { 
  ModernKmNormalizedResult, 
  ModernNormalizationFactors, 
  NormalizationWeights 
} from './types';
