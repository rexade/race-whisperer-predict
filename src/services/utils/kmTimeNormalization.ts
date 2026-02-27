import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime } from './kmTimeUtils';
import {
  REFERENCE_DISTANCE_M,
  RACE_DISTANCE_TOLERANCE_M,
  SHORTER_DISTANCE_RATE_S_PER_KM,
  LONGER_DISTANCE_RATE_S_PER_KM,
  VOLTE_HISTORICAL_ADVANTAGE_S,
} from '../modernKm/normalizationConstants';
import { log } from '@/lib/logger';

/**
 * Piecewise-linear distance adjustment (seconds) to convert a historical
 * race time TO the 2 140 m reference.
 *
 * Rates:
 *   race shorter than reference → add time  (3.2 s / 1 000 m)
 *   race longer  than reference → subtract  (2.0 s / 1 000 m)
 *
 * Note: the rates are deliberately asymmetric — shorter distances produce
 * faster per-km times at a steeper gradient than longer ones.
 */
const calculatePiecewiseDistanceAdjustmentSeconds = (
  distance: number,
  referenceDistance: number
): number => {
  if (Math.abs(distance - referenceDistance) <= RACE_DISTANCE_TOLERANCE_M) return 0;

  const diffKm = Math.abs(distance - referenceDistance) / 1000;
  return distance < referenceDistance
    ?  diffKm * SHORTER_DISTANCE_RATE_S_PER_KM   // shorter → add time
    : -diffKm * LONGER_DISTANCE_RATE_S_PER_KM;   // longer  → subtract time
};

/**
 * Normalise a HISTORICAL race KM time to the 2 140 m auto reference.
 *
 * Steps:
 * 1. Piecewise-linear distance adjustment → 2 140 m equivalent.
 * 2. Volte-start adjustment: subtract {@link VOLTE_HISTORICAL_ADVANTAGE_S}
 *    (volte starts produce intrinsically faster km times than auto starts).
 *
 * This function is called ONCE per historical record in horseProcessing.
 * The modern normalization engine (modernKm/index.ts) NEVER re-applies
 * these corrections — it only adjusts FROM this reference TO the race.
 */
export const normalizeKmTimeForHistory = (
  kmTime: KmTime,
  distance: number,
  startMethod: string
): KmTime => {
  log.debug(`[historyNorm] raw ${kmTime.minutes}:${String(kmTime.seconds).padStart(2,'0')}.${kmTime.tenths} ${distance}m ${startMethod}`);

  const distAdj = calculatePiecewiseDistanceAdjustmentSeconds(distance, REFERENCE_DISTANCE_M);
  let normalised = addSecondsToKmTime(kmTime, distAdj);

  const s = String(startMethod ?? '').toLowerCase();
  const isVolte = s.includes('volte') || s === 'v';

  if (isVolte) {
    normalised = subtractSecondsFromKmTime(normalised, VOLTE_HISTORICAL_ADVANTAGE_S);
    log.debug(`[historyNorm] volte: −${VOLTE_HISTORICAL_ADVANTAGE_S}s applied`);
  }

  log.debug(`[historyNorm] → ${normalised.minutes}:${String(normalised.seconds).padStart(2,'0')}.${normalised.tenths} (2140m auto ref)`);
  return normalised;
};

/**
 * @deprecated Use {@link normalizeKmTimeForHistory} instead.
 * Kept for backward compatibility with existing callers.
 */
export const normalizeKmTimeSimplified = normalizeKmTimeForHistory;
