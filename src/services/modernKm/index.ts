
import { KmTime, addSecondsToKmTime, cloneKmTime } from '../utils/kmTimeUtils';
import {
  ModernKmNormalizedResult,
  ModernNormalizationFactors,
  NormalizationWeights,
  DEFAULT_WEIGHTS
} from './types';
import { calculatePostPositionAdjustment, DEFAULT_AUTO_CURVE, DEFAULT_VOLTE_CURVE } from './postPositionCalculator';
import {
  calculateRobustShoeAdjustment,
  calculateRobustSulkyAdjustment,
  calculateShoeChangeAdjustment
} from './equipmentCalculators';
import { calculateDriverAdjustment, calculateDriverFormAdjustment, calculateTrainerAdjustment } from './driverCalculators';
import {
  calculateStartPointsAdjustment,
  calculateStartPointsAdjustmentFieldAware,
  calculatePlacePercentageAdjustment,
  calculateHorseWinPercentageAdjustment,
  calculateEarningsPerStartAdjustment,
  calculateFormAdjustment,
  calculateGallopRiskAdjustment,
  calculateLayoffAdjustment,
  calculateAgeFactor,
  calculateGenderAdjustment,
  calculateConsistencyAdjustment,
  calculateOddsAdjustment,
} from './performanceCalculators';
import {
  calculateDistanceAdjustment,
  calculateRaceDistanceAdjustment,
  calculateTrackFamiliarityAdjustment,
  calculateVolteStartDistancePenalty,
  calculateTripDependencyModifier
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
  DRIVER_CAP_S,
} from './normalizationConstants';
import { log } from '@/lib/logger';
import { assertResponseOk, isPersistenceApiEnabled } from '@/services/apiClient';
import { loadBrowserDefaultWeights, parseNormalizationWeights } from './weightConfig';

// Post position curves interface
import type { DistanceBucket } from './postPositionCalculator';
export interface PostPositionCurves {
  auto: { [position: number]: number };
  volte: { [position: number]: number };
  /** Optional distance-bucketed variant. When present, the calculator uses
   *  byDistance[startMethod][bucket] instead of the legacy single curve. */
  byDistance?: {
    auto: Record<DistanceBucket, { [position: number]: number }>;
    volte: Record<DistanceBucket, { [position: number]: number }>;
  };
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

  const adjustments = {
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
    gallopRisk:                0,
    layoffPenalty:             0,
    ageFactor:                 0,
    genderAdjustment:          0,
    consistencyFactor:         0,
    trainer:                   0,
    oddsHistorical:            0,
    oddsLive:                  0,
    betDistribution:           0,
    shoeChange:                0,
    total:                     0,
  };

  // STEP 1: Base time is already at 2140 m auto reference.
  const baseTime = cloneKmTime(rawKmTime);

  // STEP 2: Adjust FROM 2140 m reference TO current race distance.
  adjustments.raceDistanceAdjustment =
    calculateRaceDistanceAdjustment(factors.raceDistance) * weights.raceDistanceAdjustment;

  // STEP 3: Race-specific adjustments
  adjustments.postPosition =
    calculatePostPositionAdjustment(factors.postPosition, factors.startMethod, postPositionCurves, factors.raceDistance)
    * weights.postPosition;

  // Equipment — shoes and sulky weighted independently
  const shoeResult  = calculateRobustShoeAdjustment(factors.shoesFront, factors.shoesBack, factors.horseId);
  const sulkyResult = calculateRobustSulkyAdjustment(factors.sulkyType, factors.horseId);
  adjustments.equipment = shoeResult.adjustment * weights.shoeType
                        + sulkyResult.adjustment * weights.sulkyType;

  // Driver — absolute win-rate signal
  adjustments.driver =
    calculateDriverAdjustment(factors.driverWinPercentage) * weights.driverPerformance;

  // Driver form — field-relative signal: how does this driver rank vs others in THIS race?
  if ((weights.driverForm ?? 0) > 0 && (factors.fieldDriverWinRates?.length ?? 0) >= 3) {
    adjustments.driver += calculateDriverFormAdjustment(
      factors.driverWinPercentage,
      factors.fieldDriverWinRates!,
      DRIVER_CAP_S
    ) * (weights.driverForm ?? 0);
  }

  // Driver empirical — V85/V75-specific win rate from our calibration dataset.
  // More precise than ATG's career stat since it's specific to this race format.
  if ((weights.driverEmpirical ?? 0) > 0 && factors.driverEmpiricalWinRate !== undefined) {
    adjustments.driver += calculateDriverAdjustment(factors.driverEmpiricalWinRate)
      * (weights.driverEmpirical ?? 0);
  }

  log.debug(`[normalization] driver adj (perf+form+empirical) weighted=${adjustments.driver.toFixed(3)}s`);

  // Track / distance / volte
  adjustments.track =
    calculateTrackFamiliarityAdjustment(factors.homeTrack, factors.raceTrack) * weights.trackFamiliarity;
  adjustments.form =
    calculateFormAdjustment(factors.recentRaces, factors.horseWinPercentage) * weights.form;
  adjustments.distance =
    calculateDistanceAdjustment(factors.distance, factors.raceDistance) * weights.distanceAdjustment;
  adjustments.volteStartDistancePenalty =
    calculateVolteStartDistancePenalty(factors.startMethod, factors.distance, factors.raceDistance)
    * weights.volteStartDistancePenalty
    * (factors.enableTripDependencyModifier ? calculateTripDependencyModifier(factors.recentRaces) : 1);

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

  adjustments.gallopRisk =
    calculateGallopRiskAdjustment(factors.gallopRisk ?? 0) * weights.gallopRisk;

  adjustments.layoffPenalty =
    calculateLayoffAdjustment(factors.layoffDays ?? 0) * weights.layoffPenalty;

  adjustments.ageFactor =
    calculateAgeFactor(factors.horseBirthYear ?? 0, factors.raceYear ?? new Date().getFullYear())
    * weights.ageFactor;

  adjustments.genderAdjustment =
    calculateGenderAdjustment(factors.horseSex ?? '') * weights.genderAdjustment;

  adjustments.consistencyFactor =
    calculateConsistencyAdjustment(factors.consistencyScore ?? 0) * weights.consistencyFactor;

  const trainerWinPercentage = factors.trainerWinPercentage;
  adjustments.trainer =
    trainerWinPercentage !== undefined && Number.isFinite(trainerWinPercentage) && trainerWinPercentage > 0
      ? calculateTrainerAdjustment(trainerWinPercentage) * (weights.trainerPerformance ?? 0)
      : 0;

  // STEP 4b: Odds-based adjustments
  if ((weights.oddsHistorical ?? 0) > 0 && factors.averageOdds != null) {
    adjustments.oddsHistorical =
      calculateOddsAdjustment(factors.averageOdds) * (weights.oddsHistorical ?? 0);
  }
  if ((weights.oddsLive ?? 0) > 0 && factors.liveOdds != null) {
    adjustments.oddsLive =
      calculateOddsAdjustment(factors.liveOdds) * (weights.oddsLive ?? 0);
  }
  // Bet distribution (spelprocent) → implied odds through the same sigmoid.
  // 25 % of bets ≈ implied odds 4 (favorite bonus); 2 % ≈ odds 50 (penalty).
  if ((weights.betDistribution ?? 0) > 0 && factors.betDistribution != null && factors.betDistribution > 0) {
    adjustments.betDistribution =
      calculateOddsAdjustment(100 / factors.betDistribution) * (weights.betDistribution ?? 0);
  }

  // STEP 4c: Shoe change — ATG native flag, switch to barefoot = intent signal
  if ((weights.shoeChange ?? 0) > 0) {
    adjustments.shoeChange =
      calculateShoeChangeAdjustment(
        factors.shoesFront, factors.shoesBack,
        factors.shoesFrontChanged, factors.shoesBackChanged
      ) * (weights.shoeChange ?? 0);
  }

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
    ` gallop=${adjustments.gallopRisk.toFixed(3)}` +
    ` layoff=${adjustments.layoffPenalty.toFixed(3)}` +
    ` age=${adjustments.ageFactor.toFixed(3)}` +
    ` gender=${adjustments.genderAdjustment.toFixed(3)}` +
    ` consist=${adjustments.consistencyFactor.toFixed(3)}` +
    ` trainer=${adjustments.trainer.toFixed(3)}` +
    ` oddsHist=${adjustments.oddsHistorical.toFixed(3)}` +
    ` oddsLive=${adjustments.oddsLive.toFixed(3)}` +
    ` betDist=${adjustments.betDistribution.toFixed(3)}` +
    ` shoeChg=${adjustments.shoeChange.toFixed(3)}` +
    ` TOTAL=${adjustments.total.toFixed(3)}s`
  );

  return {
    rawTime: cloneKmTime(rawKmTime),
    modernNormalizedTime: modernNormalizedKmTime,
    adjustments,
  };
};

// Module-level cache for weights loaded from the API
let _cachedWeights: NormalizationWeights | null = null;

/** Fetch active custom weights from backend and populate the cache. Call once on app startup. */
export const initWeightsFromApi = async (): Promise<{ weights: NormalizationWeights; postPositionCurves?: PostPositionCurves }> => {
  const fallbackWeights = loadBrowserDefaultWeights() ?? { ...DEFAULT_WEIGHTS };

  if (!isPersistenceApiEnabled()) {
    _cachedWeights = fallbackWeights;
    return { weights: _cachedWeights };
  }

  try {
    const resp = await fetch('/api/weights');
    assertResponseOk(resp, 'Load weights');
    const data = await resp.json();
    if (data?.weights) {
      // Backfill weight keys added after the stored config was saved — otherwise
      // a schema addition would silently reset the user to factory defaults.
      const parsed = parseNormalizationWeights(data.weights);
      if (parsed) {
        _cachedWeights = parsed;
        return { weights: _cachedWeights, postPositionCurves: data.postPositionCurves };
      }
    }
  } catch {
    log.warn('Failed to load custom weights from API, using browser or factory defaults');
  }
  _cachedWeights = fallbackWeights;
  return { weights: _cachedWeights };
};

export const getDefaultWeights = (): NormalizationWeights => {
  return _cachedWeights ?? loadBrowserDefaultWeights() ?? { ...DEFAULT_WEIGHTS };
};

// V41 default (2026-07-04): the flat calculator curves the V41 weights were
// calibrated with. Pairing V41 with the V39 bucketed set scored slightly worse
// on the clean holdout — bucketed curves remain available via presets/editor.
export const getDefaultPostPositionCurves = (): PostPositionCurves => ({
  auto: { ...DEFAULT_AUTO_CURVE },
  volte: { ...DEFAULT_VOLTE_CURVE },
});

// Re-export types for convenience
export type {
  ModernKmNormalizedResult,
  ModernNormalizationFactors,
  NormalizationWeights
} from './types';
