
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
  calculateRaceDistanceNormalization,
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
  console.log(`Race Distance: ${factors.raceDistance}m`);
  console.log(`Start Method: ${factors.startMethod}`);
  
  let adjustments = {
    postPosition: 0,
    equipment: 0,
    driver: 0,
    driver2025: 0,
    track: 0,
    form: 0,
    distance: 0,
    raceDistanceNormalization: 0,
    raceType: 0,
    timeOfDay: 0,
    startPoints: 0,
    placePercentage: 0,
    horseWinPercentage: 0,
    earningsPerStart: 0,
    total: 0
  };

  // STEP 1: Apply race distance normalization to the raw KM time (normalize to 2140m reference)
  const raceDistanceNormalizationAdjustment = calculateRaceDistanceNormalization(factors.raceDistance);
  adjustments.raceDistanceNormalization = raceDistanceNormalizationAdjustment * weights.raceDistanceNormalization;
  
  let baseNormalizedTime = addSecondsToKmTime(cloneKmTime(rawKmTime), adjustments.raceDistanceNormalization);
  console.log(`🎯 RACE DISTANCE NORMALIZED Time: ${baseNormalizedTime.minutes}:${baseNormalizedTime.seconds.toString().padStart(2, '0')}.${baseNormalizedTime.tenths}`);

  // STEP 2: Apply volte start normalization (baseline correction)
  const startMethodLower = factors.startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  if (isVolteStart) {
    baseNormalizedTime = addSecondsToKmTime(baseNormalizedTime, 1.0);
    console.log(`🔥 VOLTE START DETECTED (${factors.startMethod}) - Added 1.0s penalty → ${baseNormalizedTime.minutes}:${baseNormalizedTime.seconds.toString().padStart(2, '0')}.${baseNormalizedTime.tenths}`);
  } else {
    console.log(`Auto start detected (${factors.startMethod}) - No volte penalty applied`);
  }

  // STEP 3: Calculate all other adjustment factors
  adjustments.postPosition = calculatePostPositionAdjustment(factors.postPosition, factors.startMethod) * weights.postPosition;
  
  adjustments.equipment = (
    calculateShoeAdjustment(factors.shoesFront, factors.shoesBack) +
    calculateSulkyAdjustment(factors.sulkyType)
  ) * weights.shoeType;
  
  adjustments.driver = calculateDriverAdjustment(
    factors.driverExperience,
    factors.driverWinPercentage,
    factors.postPosition
  ) * weights.driverExperience;
  
  adjustments.driver2025 = calculateDriver2025Adjustment(
    factors.driverWinPercentage2025,
    factors.postPosition
  ) * weights.driver2025Performance;
  
  adjustments.track = 0 * weights.trackFamiliarity; // Placeholder
  adjustments.form = 0 * weights.form; // Placeholder
  
  adjustments.distance = calculateDistanceAdjustment(
    factors.distance,
    factors.raceDistance
  ) * weights.distanceAdjustment;
  
  adjustments.raceType = calculateRaceTypeAdjustment(
    factors.raceType || ""
  ) * weights.raceType;
  
  adjustments.timeOfDay = calculateTimeOfDayAdjustment(
    factors.timeOfDay || ""
  ) * weights.timeOfDay;
  
  // STEP 4: Baseline performance adjustments
  adjustments.startPoints = calculateStartPointsAdjustment(factors.startPoints) * weights.startPoints;
  adjustments.placePercentage = calculatePlacePercentageAdjustment(factors.placePercentage) * weights.placePercentage;
  adjustments.horseWinPercentage = calculateHorseWinPercentageAdjustment(factors.horseWinPercentage) * weights.horseWinPercentage;
  adjustments.earningsPerStart = calculateEarningsPerStartAdjustment(factors.earningsPerStart) * weights.earningsPerStart;

  // STEP 5: Calculate total adjustment (excluding race distance normalization which is already applied)
  adjustments.total = Object.entries(adjustments)
    .filter(([key]) => key !== 'total' && key !== 'raceDistanceNormalization')
    .reduce((sum, [, value]) => sum + value, 0);

  // STEP 6: Apply remaining adjustments to the distance-normalized and volte-normalized time
  const modernNormalizedKmTime = addSecondsToKmTime(baseNormalizedTime, adjustments.total);

  console.log(`Enhanced KM Adjustments:`);
  console.log(`  Race Distance Normalization (${factors.raceDistance}m): ${adjustments.raceDistanceNormalization.toFixed(3)}s (ALREADY APPLIED)`);
  console.log(`  Post Position (${factors.postPosition}): ${adjustments.postPosition.toFixed(3)}s`);
  console.log(`  Equipment: ${adjustments.equipment.toFixed(3)}s`);
  console.log(`  Driver: ${adjustments.driver.toFixed(3)}s`);
  console.log(`  Driver 2025: ${adjustments.driver2025.toFixed(3)}s`);
  console.log(`  Distance: ${adjustments.distance.toFixed(3)}s`);
  console.log(`  Race Type: ${adjustments.raceType.toFixed(3)}s`);
  console.log(`  Time of Day: ${adjustments.timeOfDay.toFixed(3)}s`);
  console.log(`  Start Points: ${adjustments.startPoints.toFixed(3)}s`);
  console.log(`  Place %: ${adjustments.placePercentage.toFixed(3)}s`);
  console.log(`  Horse Win %: ${adjustments.horseWinPercentage.toFixed(3)}s`);
  console.log(`  Earnings/Start: ${adjustments.earningsPerStart.toFixed(3)}s`);
  console.log(`  REMAINING TOTAL: ${adjustments.total.toFixed(3)}s`);
  console.log(`Enhanced Modern Normalized KM Time: ${modernNormalizedKmTime.minutes}:${modernNormalizedKmTime.seconds.toString().padStart(2, '0')}.${modernNormalizedKmTime.tenths}`);

  // Update total to include all adjustments for reporting
  adjustments.total = adjustments.total + adjustments.raceDistanceNormalization;

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
