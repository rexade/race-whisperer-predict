
import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import { TimeLogger } from '../utils/enhancedLogging';
import { validateNormalizationResult, validateAdjustment } from '../utils/timeValidation';
import { validateAdjustmentBounds } from '../utils/adjustmentCalibration';
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
  const horseContext = `Horse ${factors.postPosition}`;
  
  TimeLogger.logNormalization('Starting modern normalization', factors.postPosition, {
    rawTime: rawKmTime,
    raceDistance: factors.raceDistance,
    startMethod: factors.startMethod
  }, horseContext);

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

  // STEP 1: Apply volte start normalization (baseline correction)
  const startMethodLower = factors.startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  let baseTime = cloneKmTime(rawKmTime);
  
  if (isVolteStart) {
    baseTime = addSecondsToKmTime(baseTime, 1.0);
    TimeLogger.logAdjustment('Volte Start Penalty', 1.0, { startMethod: factors.startMethod }, horseContext);
    console.log(`🔥 VOLTE START DETECTED (${factors.startMethod}) - Added 1.0s penalty → ${baseTime.minutes}:${baseTime.seconds.toString().padStart(2, '0')}.${baseTime.tenths}`);
  } else {
    console.log(`Auto start detected (${factors.startMethod}) - No volte penalty applied`);
  }

  // STEP 2: Calculate and validate all adjustment factors
  try {
    // Race distance adjustment
    const raceDistanceAdjustmentValue = calculateRaceDistanceAdjustment(factors.raceDistance);
    const raceDistanceValidation = validateAdjustment(raceDistanceAdjustmentValue, 'Race Distance', 5.0);
    const raceDistanceBoundsCheck = validateAdjustmentBounds('distance', raceDistanceAdjustmentValue);
    
    if (!raceDistanceValidation.isValid || !raceDistanceBoundsCheck.isValid) {
      TimeLogger.logValidation('Race Distance Adjustment', false, {
        value: raceDistanceAdjustmentValue,
        validationErrors: raceDistanceValidation.errors,
        boundsWarning: raceDistanceBoundsCheck.warning
      }, horseContext);
    }
    
    adjustments.raceDistanceAdjustment = raceDistanceAdjustmentValue * weights.raceDistanceAdjustment;
    TimeLogger.logAdjustment('Race Distance', adjustments.raceDistanceAdjustment, { raceDistance: factors.raceDistance }, horseContext);

    // Post position adjustment
    const postPositionValue = calculatePostPositionAdjustment(factors.postPosition, factors.startMethod);
    const postPositionValidation = validateAdjustment(postPositionValue, 'Post Position', 2.0);
    const postPositionBoundsCheck = validateAdjustmentBounds('postPosition', postPositionValue);
    
    adjustments.postPosition = postPositionValue * weights.postPosition;
    TimeLogger.logAdjustment('Post Position', adjustments.postPosition, { position: factors.postPosition }, horseContext);
    
    // Equipment adjustments
    const shoeAdjustmentValue = calculateShoeAdjustment(factors.shoesFront, factors.shoesBack);
    const sulkyAdjustmentValue = calculateSulkyAdjustment(factors.sulkyType);
    const equipmentTotal = (shoeAdjustmentValue + sulkyAdjustmentValue) * weights.shoeType;
    const equipmentValidation = validateAdjustment(equipmentTotal, 'Equipment', 1.0);
    const equipmentBoundsCheck = validateAdjustmentBounds('equipment', equipmentTotal);
    
    adjustments.equipment = equipmentTotal;
    TimeLogger.logAdjustment('Equipment', adjustments.equipment, { 
      shoes: { front: factors.shoesFront, back: factors.shoesBack },
      sulky: factors.sulkyType 
    }, horseContext);
    
    // Driver adjustments
    const driverValue = calculateDriverAdjustment(
      factors.driverExperience,
      factors.driverWinPercentage,
      factors.postPosition
    );
    const driverValidation = validateAdjustment(driverValue, 'Driver', 2.0);
    const driverBoundsCheck = validateAdjustmentBounds('driver', driverValue);
    
    adjustments.driver = driverValue * weights.driverExperience;
    TimeLogger.logAdjustment('Driver', adjustments.driver, { 
      experience: factors.driverExperience,
      winPercentage: factors.driverWinPercentage 
    }, horseContext);
    
    const driver2025Value = calculateDriver2025Adjustment(
      factors.driverWinPercentage2025,
      factors.postPosition
    );
    adjustments.driver2025 = driver2025Value * weights.driver2025Performance;
    TimeLogger.logAdjustment('Driver 2025', adjustments.driver2025, { 
      winPercentage2025: factors.driverWinPercentage2025 
    }, horseContext);
    
    // Distance adjustment
    const distanceValue = calculateDistanceAdjustment(factors.distance, factors.raceDistance);
    adjustments.distance = distanceValue * weights.distanceAdjustment;
    TimeLogger.logAdjustment('Distance', adjustments.distance, { 
      horseDistance: factors.distance,
      raceDistance: factors.raceDistance 
    }, horseContext);
    
    // Race type and time adjustments
    const raceTypeValue = calculateRaceTypeAdjustment(factors.raceType || "");
    adjustments.raceType = raceTypeValue * weights.raceType;
    
    const timeOfDayValue = calculateTimeOfDayAdjustment(factors.timeOfDay || "");
    adjustments.timeOfDay = timeOfDayValue * weights.timeOfDay;
    
    // Performance-based adjustments
    const startPointsValue = calculateStartPointsAdjustment(factors.startPoints);
    adjustments.startPoints = startPointsValue * weights.startPoints;
    
    const placePercentageValue = calculatePlacePercentageAdjustment(factors.placePercentage);
    adjustments.placePercentage = placePercentageValue * weights.placePercentage;
    
    const horseWinPercentageValue = calculateHorseWinPercentageAdjustment(factors.horseWinPercentage);
    adjustments.horseWinPercentage = horseWinPercentageValue * weights.horseWinPercentage;
    
    const earningsPerStartValue = calculateEarningsPerStartAdjustment(factors.earningsPerStart);
    adjustments.earningsPerStart = earningsPerStartValue * weights.earningsPerStart;

    // Placeholders for future implementation
    adjustments.track = 0 * weights.trackFamiliarity;
    adjustments.form = 0 * weights.form;

  } catch (error) {
    TimeLogger.logValidation('Adjustment Calculation', false, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, horseContext);
    console.error('Error calculating adjustments:', error);
  }

  // STEP 3: Calculate total adjustment
  adjustments.total = Object.entries(adjustments)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + value, 0);

  // Validate total adjustment
  const totalAdjustmentValidation = validateAdjustment(adjustments.total, 'Total Adjustment', 15.0);
  if (!totalAdjustmentValidation.isValid) {
    TimeLogger.logValidation('Total Adjustment', false, totalAdjustmentValidation.errors, horseContext);
    console.warn('Large total adjustment detected:', adjustments.total);
  }

  // STEP 4: Apply all adjustments to the base time
  const modernNormalizedKmTime = addSecondsToKmTime(baseTime, adjustments.total);

  // STEP 5: Validate the final result
  const normalizationValidation = validateNormalizationResult(rawKmTime, modernNormalizedKmTime, adjustments.total);
  if (!normalizationValidation.isValid) {
    TimeLogger.logValidation('Normalization Result', false, normalizationValidation.errors, horseContext);
    console.warn('Normalization validation failed:', normalizationValidation.errors);
  }

  if (normalizationValidation.warnings.length > 0) {
    TimeLogger.logValidation('Normalization Warnings', true, normalizationValidation.warnings, horseContext);
    console.warn('Normalization warnings:', normalizationValidation.warnings);
  }

  // Log detailed results
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

  TimeLogger.logNormalization('Completed modern normalization', factors.postPosition, {
    totalAdjustment: adjustments.total,
    finalTime: modernNormalizedKmTime,
    validationPassed: normalizationValidation.isValid
  }, horseContext);

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
