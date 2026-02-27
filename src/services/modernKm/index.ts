
import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import {
  ModernKmNormalizedResult,
  ModernNormalizationFactors,
  NormalizationWeights,
  DEFAULT_WEIGHTS
} from './types';
import { calculatePostPositionAdjustment } from './postPositionCalculator';
import {
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
import {
  START_POINTS_BASELINE,
  START_POINTS_ALPHA,
  START_POINTS_MAX_IMPACT_S,
  START_POINTS_FIELD_AWARE_MAX_IMPACT_S,
  START_POINTS_FIELD_AWARE_BETA,
  START_POINTS_FIELD_MIN_SIZE,
  START_POINTS_FINAL_CAP_S,
  EARNINGS_MAX_BONUS_S,
} from './normalizationConstants';
import { log } from '@/lib/logger';

// Post position curves interface
export interface PostPositionCurves {
  auto: { [position: number]: number };
  volte: { [position: number]: number };
}

/**
 * Applies modern normalization to a RAW KM time using race-specific factors.
 *
 * The raw time MUST already be normalised to the 2140 m auto reference
 * (done in horseProcessing via normalizeKmTimeForHistory).  This function
 * only adjusts FROM 2140 m TO the current race conditions.
 */
export const applyModernKmNormalization = (
  rawKmTime: KmTime,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS,
  postPositionCurves?: PostPositionCurves
): ModernKmNormalizedResult => {
  log.debug(`[normalization] ${factors.horseName ?? 'Unknown'} — driver ${factors.driverWinPercentage}%, raw ${rawKmTime.minutes}:${String(rawKmTime.seconds).padStart(2,'0')}.${rawKmTime.tenths}, ${factors.raceDistance}m ${factors.startMethod}`);

  let adjustments = {
    postPosition:              0,
    equipment:                 0,
    driver:                    0,
    track:                     0,
    form:                      0,
    distance:                  0,
    raceDistanceAdjustment:    0,
    volteStartDistancePenalty: 0,
    startPoints:               0,
    placePercentage:           0,
    horseWinPercentage:        0,
    earningsPerStart:          0,
    total:                     0,
  };

  // STEP 1: Base time is already at 2140 m auto reference.
  const baseTime = cloneKmTime(rawKmTime);

  // STEP 2: Adjust FROM 2140 m reference TO current race distance.
  adjustments.raceDistanceAdjustment =
    calculateRaceDistanceAdjustment(factors.raceDistance) * weights.raceDistanceAdjustment;

  // STEP 3: Race-specific adjustments
  adjustments.postPosition =
    calculatePostPositionAdjustment(factors.postPosition, factors.startMethod, postPositionCurves)
    * weights.postPosition;

  // Equipment
  const shoeResult  = calculateRobustShoeAdjustment(factors.shoesFront, factors.shoesBack, factors.horseId);
  const sulkyResult = calculateRobustSulkyAdjustment(factors.sulkyType, factors.horseId);
  if (factors.horseId !== undefined) {
    EquipmentDebugger.logEquipmentCalculation(factors.horseId, factors.horseName ?? 'Unknown', 'shoes',  { front: factors.shoesFront, back: factors.shoesBack }, shoeResult);
    EquipmentDebugger.logEquipmentCalculation(factors.horseId, factors.horseName ?? 'Unknown', 'sulky',  factors.sulkyType, sulkyResult);
  }
  adjustments.equipment = (shoeResult.adjustment + sulkyResult.adjustment) * weights.shoeType;

  // Driver
  adjustments.driver =
    calculateDriverAdjustment(factors.driverWinPercentage) * weights.driverPerformance;
  log.debug(`[normalization] driver adj raw=${(adjustments.driver / weights.driverPerformance).toFixed(3)}s weighted=${adjustments.driver.toFixed(3)}s`);

  // Track / distance / volte
  adjustments.track =
    calculateTrackFamiliarityAdjustment(factors.homeTrack, factors.raceTrack) * weights.trackFamiliarity;
  adjustments.form =
    calculateFormAdjustment(factors.recentRaces, factors.horseWinPercentage) * weights.form;
  adjustments.distance =
    calculateDistanceAdjustment(factors.distance, factors.raceDistance) * weights.distanceAdjustment;
  adjustments.volteStartDistancePenalty =
    calculateVolteStartDistancePenalty(factors.startMethod, factors.distance, factors.raceDistance)
    * weights.volteStartDistancePenalty;

  // STEP 4: Baseline performance adjustments
  const spAdj =
    (factors.fieldStartPoints?.length ?? 0) >= START_POINTS_FIELD_MIN_SIZE
      ? calculateStartPointsAdjustmentFieldAware(
          factors.startPoints,
          factors.fieldStartPoints!,
          { beta: START_POINTS_FIELD_AWARE_BETA, maxImpact: START_POINTS_FIELD_AWARE_MAX_IMPACT_S }
        )
      : calculateStartPointsAdjustment(
          factors.startPoints,
          { baseline: START_POINTS_BASELINE, alpha: START_POINTS_ALPHA, maxImpact: START_POINTS_MAX_IMPACT_S }
        );

  const spWeighted = spAdj * weights.startPoints;
  adjustments.startPoints = Math.max(
    Math.min(spWeighted,  START_POINTS_FINAL_CAP_S),
                          -START_POINTS_FINAL_CAP_S
  );
  log.debug(`[normalization] startPoints raw=${spAdj.toFixed(3)}s weighted=${spWeighted.toFixed(3)}s capped=${adjustments.startPoints.toFixed(3)}s`);

  adjustments.placePercentage =
    calculatePlacePercentageAdjustment(factors.placePercentage) * weights.placePercentage;
  adjustments.horseWinPercentage =
    calculateHorseWinPercentageAdjustment(factors.horseWinPercentage) * weights.horseWinPercentage;
  adjustments.earningsPerStart = Math.max(
    calculateEarningsPerStartAdjustment(factors.earningsPerStart) * weights.earningsPerStart,
    EARNINGS_MAX_BONUS_S
  );

  // STEP 5: Total
  adjustments.total = Object.entries(adjustments)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, v]) => sum + v, 0);

  // STEP 6: Apply to base time
  const modernNormalizedKmTime = addSecondsToKmTime(baseTime, adjustments.total);

  log.debug(
    `[normalization] ${factors.horseName ?? '?'} adjustments:` +
    ` postPos=${adjustments.postPosition.toFixed(3)}` +
    ` equip=${adjustments.equipment.toFixed(3)}` +
    ` driver=${adjustments.driver.toFixed(3)}` +
    ` track=${adjustments.track.toFixed(3)}` +
    ` form=${adjustments.form.toFixed(3)}` +
    ` dist=${adjustments.distance.toFixed(3)}` +
    ` raceDist=${adjustments.raceDistanceAdjustment.toFixed(3)}` +
    ` volte=${adjustments.volteStartDistancePenalty.toFixed(3)}` +
    ` sp=${adjustments.startPoints.toFixed(3)}` +
    ` place%=${adjustments.placePercentage.toFixed(3)}` +
    ` win%=${adjustments.horseWinPercentage.toFixed(3)}` +
    ` earn=${adjustments.earningsPerStart.toFixed(3)}` +
    ` TOTAL=${adjustments.total.toFixed(3)}s`
  );

  return {
    rawTime: cloneKmTime(rawKmTime),
    modernNormalizedTime: modernNormalizedKmTime,
    adjustments,
  };
};

export const getDefaultWeights = (): NormalizationWeights => {
  try {
    const saved = localStorage.getItem('customDefaultWeights');
    if (saved) {
      const customDefaults = JSON.parse(saved);
      const defaultKeys = Object.keys(DEFAULT_WEIGHTS) as (keyof NormalizationWeights)[];
      if (defaultKeys.every(key => key in customDefaults)) {
        return customDefaults;
      }
    }
  } catch {
    log.warn('Failed to load custom default weights, using factory defaults');
  }
  return { ...DEFAULT_WEIGHTS };
};

// Re-export types for convenience
export type {
  ModernKmNormalizedResult,
  ModernNormalizationFactors,
  NormalizationWeights
} from './types';
