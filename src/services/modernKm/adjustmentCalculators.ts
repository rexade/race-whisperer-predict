import {
  REFERENCE_DISTANCE_M,
  RACE_DISTANCE_TOLERANCE_M,
  SHORTER_DISTANCE_RATE_S_PER_KM,
  LONGER_DISTANCE_RATE_S_PER_KM,
  HOME_TRACK_ADJ_S,
  VOLTE_BACK_MARKER_PENALTY_S,
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

// Re-export so callers that reference REFERENCE_DISTANCE_M from this module
// continue to work without changes.
export { REFERENCE_DISTANCE_M } from './normalizationConstants';
