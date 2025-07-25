
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
  calculateRaceDistanceAdjustment,
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
    raceDistanceAdjustment: 0,
    raceType: 0,
    timeOfDay: 0,
    startPoints: 0,
    placePercentage: 0,
    horseWinPercentage: 0,
    earningsPerStart: 0,
    total: 0
  };

  // STEP 1: The rawKmTime is already normalized to 2140m AUTO start
  // No additional volte penalty needed - it's already applied in historical normalization
  let baseTime = cloneKmTime(rawKmTime);
  
  console.log(`Base time (already normalized to 2140m auto): ${baseTime.minutes}:${baseTime.seconds.toString().padStart(2, '0')}.${baseTime.tenths}`);
  console.log(`Current race start method: ${factors.startMethod} (no additional volte penalty needed)`);
  
  // NOTE: Volte penalty was already applied during historical RAW time normalization
  // The rawKmTime represents the horse's ability on a 2140m auto start baseline

  // STEP 2: Calculate race distance adjustment (FROM 2140m reference TO actual race distance)
  const raceDistanceAdjustmentValue = calculateRaceDistanceAdjustment(factors.raceDistance);
  adjustments.raceDistanceAdjustment = raceDistanceAdjustmentValue * weights.raceDistanceAdjustment;

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

  // STEP 5: Calculate total adjustment (all adjustments)
  adjustments.total = Object.entries(adjustments)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + value, 0);

  // STEP 6: Apply all adjustments to the base time (volte-corrected)
  const modernNormalizedKmTime = addSecondsToKmTime(baseTime, adjustments.total);

  console.log(`Enhanced KM Adjustments:`);
  console.log(`  Post Position (${factors.postPosition}): ${adjustments.postPosition.toFixed(3)}s`);
  console.log(`  Equipment: ${adjustments.equipment.toFixed(3)}s`);
  console.log(`  Driver: ${adjustments.driver.toFixed(3)}s`);
  console.log(`  Driver 2025: ${adjustments.driver2025.toFixed(3)}s`);
  console.log(`  Distance: ${adjustments.distance.toFixed(3)}s`);
  console.log(`  Race Distance Adjustment (${factors.raceDistance}m): ${adjustments.raceDistanceAdjustment.toFixed(3)}s`);
  console.log(`  Race Type: ${adjustments.raceType.toFixed(3)}s`);
  console.log(`  Time of Day: ${adjustments.timeOfDay.toFixed(3)}s`);
  console.log(`  Start Points: ${adjustments.startPoints.toFixed(3)}s`);
  console.log(`  Place %: ${adjustments.placePercentage.toFixed(3)}s`);
  console.log(`  Horse Win %: ${adjustments.horseWinPercentage.toFixed(3)}s`);
  console.log(`  Earnings/Start: ${adjustments.earningsPerStart.toFixed(3)}s`);
  console.log(`  TOTAL: ${adjustments.total.toFixed(3)}s`);
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
