import {
  REFERENCE_DISTANCE_M,
  RACE_DISTANCE_TOLERANCE_M,
  SHORTER_DISTANCE_RATE_S_PER_KM,
  LONGER_DISTANCE_RATE_S_PER_KM,
  HOME_TRACK_ADJ_S,
  VOLTE_BACK_MARKER_PENALTY_S,
  TRIP_DEPENDENCY_OUTSIDE_THRESHOLD,
  TRIP_DEPENDENCY_MIN_OUTSIDE,
  TRIP_DEPENDENCY_MIN_RECORDS,
  TRIP_DEPENDENCY_MAX_MODIFIER,
  TRIP_DEPENDENCY_MIN_MODIFIER,
  TRIP_DEPENDENCY_OUTSIDE_RATE_SCALE,
  GALLOP_PENALTY_PER_RACE_S,
  DISQ_PENALTY_PER_RACE_S,
  GALLOP_RELIABILITY_MAX_PENALTY_S,
} from './normalizationConstants';
import { log } from '@/lib/logger';

/**
 * Per-horse distance adjustment: penalty/bonus when the horse's preferred
 * distance differs from the current race distance.
 *
 * Formula: (horseDistance − raceDistance) × 0.001 s/m
 * e.g. horse runs 2500 m but race is 2140 m → +0.36 s (slightly slower).
 */
export const calculateDistanceAdjustment = (
  horseDistance: number,
  raceDistance: number
): number => {
  const diff = horseDistance - raceDistance;
  if (diff === 0) return 0;
  const adjustment = diff * 0.001;
  log.debug(`[distAdj] horse ${horseDistance}m vs race ${raceDistance}m → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Race-distance adjustment FROM the 2140 m reference TO the actual race
 * distance.  Raw KM times are always pre-normalised to 2140 m, so this
 * function only converts in the forward direction (never back to 2140 m).
 *
 * Piecewise-linear rates:
 *   shorter races  3.2 s / 1 000 m  (subtracted — faster per km)
 *   longer  races  2.0 s / 1 000 m  (added    — slightly slower per km)
 */
export const calculateRaceDistanceAdjustment = (raceDistance: number): number => {
  const ref = REFERENCE_DISTANCE_M;
  if (Math.abs(raceDistance - ref) <= RACE_DISTANCE_TOLERANCE_M) {
    log.debug(`[raceDistAdj] ${raceDistance}m ≈ ${ref}m → 0.000s`);
    return 0;
  }

  const diffKm = Math.abs(raceDistance - ref) / 1000;
  const adjustment = raceDistance < ref
    ? -(diffKm * SHORTER_DISTANCE_RATE_S_PER_KM)
    :  (diffKm * LONGER_DISTANCE_RATE_S_PER_KM);

  log.debug(`[raceDistAdj] ${raceDistance}m (${raceDistance < ref ? 'shorter' : 'longer'}) → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Home-track familiarity bonus: applied when the horse races at its
 * registered home track.
 */
export const calculateTrackFamiliarityAdjustment = (
  horseHomeTrack: string,
  raceTrack: string
): number => {
  if (!horseHomeTrack || !raceTrack) return 0;

  const same =
    horseHomeTrack.trim().toUpperCase() === raceTrack.trim().toUpperCase();

  const adjustment = same ? HOME_TRACK_ADJ_S : 0;
  log.debug(`[trackAdj] home="${horseHomeTrack}" race="${raceTrack}" → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Volte back-marker penalty: added when a horse starts from a longer
 * distance than the race distance in a volte (standing-start) race.
 */
export const calculateVolteStartDistancePenalty = (
  startMethod: string,
  horseDistance: number,
  raceDistance: number
): number => {
  const isVolte = Boolean(startMethod) &&
    startMethod.toLowerCase().includes('volte');

  if (!isVolte || horseDistance <= raceDistance) {
    log.debug(`[voltePenalty] not applicable → 0.000s`);
    return 0;
  }

  log.debug(`[voltePenalty] volte back-marker (${horseDistance}m > ${raceDistance}m) → +${VOLTE_BACK_MARKER_PENALTY_S.toFixed(3)}s`);
  return VOLTE_BACK_MARKER_PENALTY_S;
};

/**
 * Trip-dependency modifier: scales the volte back-marker penalty for horses
 * that have shown they can place well from outside starting positions.
 *
 * Horses regularly drawn at post ≥ 7 and placing top-3 from those draws
 * handle wide trips better than average. Their volte penalty is reduced
 * proportionally to their outside place rate.
 *
 * Returns a multiplier in [0.6, 1.0]:
 *  - 1.0 = no data or too few outside races → full penalty unchanged
 *  - 0.6 = very high outside place rate → maximum 40% penalty reduction
 *
 * Example: 4 outside races, 2 placed → outsidePlaceRate = 0.50
 *   modifier = max(1.0 − 0.50×0.5, 0.6) = max(0.75, 0.6) = 0.75
 */
export const calculateTripDependencyModifier = (
  recentRaces?: Array<{ place: number; date: string; postPosition?: number }>
): number => {
  if (!recentRaces || recentRaces.length === 0) {
    log.debug('[tripDep] no recent races → modifier=1.0');
    return TRIP_DEPENDENCY_MAX_MODIFIER;
  }

  const withPosition = recentRaces.filter(
    r => r.postPosition !== undefined && r.postPosition > 0
  );

  if (withPosition.length < TRIP_DEPENDENCY_MIN_RECORDS) {
    log.debug(`[tripDep] ${withPosition.length} positioned records < ${TRIP_DEPENDENCY_MIN_RECORDS} required → modifier=1.0`);
    return TRIP_DEPENDENCY_MAX_MODIFIER;
  }

  const outsideRaces = withPosition.filter(
    r => r.postPosition! >= TRIP_DEPENDENCY_OUTSIDE_THRESHOLD
  );

  if (outsideRaces.length < TRIP_DEPENDENCY_MIN_OUTSIDE) {
    log.debug(`[tripDep] ${outsideRaces.length} outside races < ${TRIP_DEPENDENCY_MIN_OUTSIDE} required → modifier=1.0`);
    return TRIP_DEPENDENCY_MAX_MODIFIER;
  }

  const outsidePlaceRate = outsideRaces.filter(r => r.place <= 3).length / outsideRaces.length;
  const modifier = Math.max(
    TRIP_DEPENDENCY_MAX_MODIFIER - outsidePlaceRate * TRIP_DEPENDENCY_OUTSIDE_RATE_SCALE,
    TRIP_DEPENDENCY_MIN_MODIFIER
  );

  log.debug(
    `[tripDep] ${outsideRaces.length} outside races, ` +
    `placeRate=${(outsidePlaceRate * 100).toFixed(1)}% → modifier=${modifier.toFixed(3)}`
  );
  return modifier;
};

/**
 * Gallop reliability penalty: adds seconds when a horse has a history of
 * breaking stride (galloping) or being disqualified in recent starts.
 *
 * Ported from v85-briefing-engine feature_extract/reliability.py.
 *
 * Formula: min(gallopCount × GALLOP_PENALTY_PER_RACE_S
 *            + disqCount   × DISQ_PENALTY_PER_RACE_S,
 *              GALLOP_RELIABILITY_MAX_PENALTY_S)
 *
 * A horse with 0 gallops and 0 disqualifications gets 0 penalty.
 * Examples (before weight):
 *   1 gallop  → +0.15 s
 *   2 gallops → +0.30 s
 *   3 gallops → +0.45 s
 *   3 gallops + 1 disq → capped at +0.50 s
 */
export const calculateGallopReliabilityPenalty = (
  gallopCount: number = 0,
  disqualificationCount: number = 0
): number => {
  if (gallopCount === 0 && disqualificationCount === 0) {
    log.debug('[gallopRel] no gallops/disqs → 0.000s');
    return 0;
  }

  const penalty = Math.min(
    gallopCount * GALLOP_PENALTY_PER_RACE_S + disqualificationCount * DISQ_PENALTY_PER_RACE_S,
    GALLOP_RELIABILITY_MAX_PENALTY_S
  );

  log.debug(
    `[gallopRel] ${gallopCount} gallop(s) × ${GALLOP_PENALTY_PER_RACE_S}s` +
    ` + ${disqualificationCount} disq(s) × ${DISQ_PENALTY_PER_RACE_S}s` +
    ` → +${penalty.toFixed(3)}s`
  );
  return penalty;
};

// Re-export so callers that reference REFERENCE_DISTANCE_M from this module
// continue to work without changes.
export { REFERENCE_DISTANCE_M } from './normalizationConstants';
