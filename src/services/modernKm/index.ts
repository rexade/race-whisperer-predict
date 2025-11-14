
import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import { 
  ModernKmNormalizedResult, 
  ModernNormalizationFactors, 
  NormalizationWeights, 
  DEFAULT_WEIGHTS 
} from './types';
import { calculatePostPositionAdjustment } from './postPositionCalculator';
import { 
  calculateShoeAdjustment, 
  calculateSulkyAdjustment,
  calculateRobustShoeAdjustment,
  calculateRobustSulkyAdjustment
} from './equipmentCalculators';
import { EquipmentDebugger } from '../debugging/equipmentDebugger';
import { calculateDriverAdjustment } from './driverCalculators';
import { 
  calculateStartPointsAdjustment,
  calculateStartPointsAdjustmentFieldAware,
  calculatePlacePercentageAdjustment,
  calculateHorseWinPercentageAdjustment,
  calculateEarningsPerStartAdjustment,
  calculateFormAdjustment
} from './performanceCalculators';
import {
  calculateDistanceAdjustment,
  calculateRaceDistanceAdjustment,
  calculateTrackFamiliarityAdjustment,
  calculateVolteStartDistancePenalty
} from './adjustmentCalculators';

// Post position curves interface
export interface PostPositionCurves {
  auto: { [position: number]: number };
  volte: { [position: number]: number };
}

/**
 * Applies modern normalization to a RAW KM time using race-specific factors
 */
export const applyModernKmNormalization = (
  rawKmTime: KmTime,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS,
  postPositionCurves?: PostPositionCurves
): ModernKmNormalizedResult => {
  console.log(`🚀 [MODERN NORMALIZATION] Starting for ${factors.horseName || 'Unknown Horse'} - Driver: ${factors.driverWinPercentage}%`);
  console.log(`\n=== Enhanced Modern KM Normalization ===`);
  console.log(`RAW Time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);
  console.log(`Race Distance: ${factors.raceDistance}m`);
  console.log(`Start Method: ${factors.startMethod}`);
  
  let adjustments = {
    postPosition: 0,
    equipment: 0,
    driver: 0,
    track: 0,
    form: 0,
    distance: 0,
    raceDistanceAdjustment: 0,
    raceType: 0,
    timeOfDay: 0,
    volteStartDistancePenalty: 0,
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
  adjustments.postPosition = calculatePostPositionAdjustment(factors.postPosition, factors.startMethod, postPositionCurves) * weights.postPosition;
  
  // Equipment adjustments with enhanced debugging
  const shoeResult = calculateRobustShoeAdjustment(factors.shoesFront, factors.shoesBack, factors.horseId);
  const sulkyResult = calculateRobustSulkyAdjustment(factors.sulkyType, factors.horseId);
  
  // Log equipment calculations for debugging
  if (factors.horseId !== undefined) {
    EquipmentDebugger.logEquipmentCalculation(
      factors.horseId, 
      factors.horseName || 'Unknown', 
      'shoes', 
      { front: factors.shoesFront, back: factors.shoesBack }, 
      shoeResult
    );
    
    EquipmentDebugger.logEquipmentCalculation(
      factors.horseId,
      factors.horseName || 'Unknown',
      'sulky',
      factors.sulkyType,
      sulkyResult
    );
  }
  
  adjustments.equipment = (shoeResult.adjustment + sulkyResult.adjustment) * weights.shoeType;
  
  // Driver adjustment with detailed logging
  console.log(`[NORMALIZATION DEBUG] Driver calculation for ${factors.horseName || 'Unknown'}:`);
  console.log(`[NORMALIZATION DEBUG] Driver win percentage: ${factors.driverWinPercentage}%`);
  console.log(`[NORMALIZATION DEBUG] Post position: ${factors.postPosition}`);
  console.log(`[NORMALIZATION DEBUG] Driver weight: ${weights.driverPerformance}`);
  
  const rawDriverAdjustment = calculateDriverAdjustment(
    factors.driverWinPercentage,
    factors.postPosition
  );
  adjustments.driver = rawDriverAdjustment * weights.driverPerformance;
  
  console.log(`[NORMALIZATION DEBUG] Raw driver adjustment: ${rawDriverAdjustment}s`);
  console.log(`[NORMALIZATION DEBUG] Weighted driver adjustment: ${adjustments.driver}s`);
  
  adjustments.track = calculateTrackFamiliarityAdjustment(
    factors.homeTrack,
    factors.raceTrack
  ) * weights.trackFamiliarity;
  
  // Calculate form adjustment based on recent race performance
  const rawFormAdjustment = calculateFormAdjustment(
    factors.recentRaces,
    factors.horseWinPercentage
  );
  adjustments.form = rawFormAdjustment * weights.form;
  
  adjustments.distance = calculateDistanceAdjustment(
    factors.distance,
    factors.raceDistance
  ) * weights.distanceAdjustment;
  
  adjustments.raceType = 0; // Removed - always trot races
  adjustments.timeOfDay = 0; // Removed - not needed
  
  adjustments.volteStartDistancePenalty = calculateVolteStartDistancePenalty(
    factors.startMethod,
    factors.distance,
    factors.raceDistance
  ) * weights.volteStartDistancePenalty;
  
  // STEP 4: Baseline performance adjustments
  // Use field-aware start points when field data is available (>=3 horses)
  // Reduced impact: maxImpact halved to prevent over-rewarding high start points
  const spAdj =
    (factors.fieldStartPoints?.length ?? 0) >= 3
      ? calculateStartPointsAdjustmentFieldAware(
          factors.startPoints,
          factors.fieldStartPoints!,
          { beta: 2.0, maxImpact: 0.25 }  // Reduced from 0.50
        )
      : calculateStartPointsAdjustment(
          factors.startPoints,
          { baseline: 1200, alpha: 0.60, maxImpact: 0.30 }  // Reduced from 0.60
        );
  
  // Apply weight and enforce hard cap on final weighted adjustment
  const spWeighted = spAdj * weights.startPoints;
  const MAX_FINAL_SP_IMPACT = 0.30; // Reduced from 0.60 - absolute cap on final weighted adjustment
  adjustments.startPoints = Math.max(
    Math.min(spWeighted, MAX_FINAL_SP_IMPACT),
    -MAX_FINAL_SP_IMPACT
  );
  
  console.log(`🔍 START POINTS DEBUG for ${factors.horseName}:`, {
    startPoints: factors.startPoints,
    rawAdj: spAdj.toFixed(3),
    weight: weights.startPoints,
    weighted: spWeighted.toFixed(3),
    capped: adjustments.startPoints.toFixed(3)
  });
  adjustments.placePercentage = calculatePlacePercentageAdjustment(factors.placePercentage) * weights.placePercentage;
  adjustments.horseWinPercentage = calculateHorseWinPercentageAdjustment(factors.horseWinPercentage) * weights.horseWinPercentage;
  const epsRaw = calculateEarningsPerStartAdjustment(factors.earningsPerStart);
  const epsWeighted = epsRaw * weights.earningsPerStart;
  adjustments.earningsPerStart = Math.max(epsWeighted, -0.2);

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
  console.log(`  Distance: ${adjustments.distance.toFixed(3)}s`);
  console.log(`  Race Distance Adjustment (${factors.raceDistance}m): ${adjustments.raceDistanceAdjustment.toFixed(3)}s`);
  console.log(`  Track Familiarity: ${adjustments.track.toFixed(3)}s`);
  console.log(`  Volte Start Penalty: ${adjustments.volteStartDistancePenalty.toFixed(3)}s`);
  console.log(`  Form (Recent): ${adjustments.form.toFixed(3)}s`);
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

export const getDefaultWeights = (): NormalizationWeights => {
  try {
    const saved = localStorage.getItem('customDefaultWeights');
    if (saved) {
      const customDefaults = JSON.parse(saved);
      // Validate that all required keys exist
      const defaultKeys = Object.keys(DEFAULT_WEIGHTS) as (keyof NormalizationWeights)[];
      const hasAllKeys = defaultKeys.every(key => key in customDefaults);
      if (hasAllKeys) {
        return customDefaults;
      }
    }
  } catch (error) {
    console.warn('Failed to load custom default weights, using factory defaults:', error);
  }
  return { ...DEFAULT_WEIGHTS };
};

// Re-export types for convenience
export type { 
  ModernKmNormalizedResult, 
  ModernNormalizationFactors, 
  NormalizationWeights 
} from './types';
