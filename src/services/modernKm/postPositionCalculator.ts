import { log } from '@/lib/logger';
import { getDistanceBucket } from './distanceBuckets';
import type { PostPositionCurves } from './index';

/**
 * Post-position default curves (seconds).
 *
 * Negative = advantage (inner positions), positive = penalty (outer).
 * Values represent the raw adjustment BEFORE the postPosition weight is
 * applied.  Custom curves from the UI override these.
 */
export const DEFAULT_AUTO_CURVE: Record<number, number> = {
   1: -0.30,  // rail — strong advantage
   2: -0.25,
   3: -0.20,
   4: -0.10,
   5:  0.00,  // baseline
   6:  0.05,
   7:  0.15,
   8:  0.30,
   9:  0.55,
  10:  0.65,
  11:  0.75,
  12:  0.85,
  13:  0.90,
  14:  0.95,
  15:  1.00,
};

export const DEFAULT_VOLTE_CURVE: Record<number, number> = {
   1: -0.25,  // front-row inside
   2: -0.20,
   3: -0.10,
   4:  0.00,  // baseline
   5:  0.05,
   6:  0.20,
   7:  0.25,
   8:  0.30,
   9:  0.50,  // second row
  10:  0.60,
  11:  0.75,
  12:  0.85,
  13:  0.90,
  14:  0.95,
  15:  1.00,
};

/** Fallback value for any position beyond the curve table. */
const POSITION_OVERFLOW_ADJ = 1.00;

/**
 * Post-position time adjustment.
 *
 * Lookup precedence:
 *   1. `customCurves.byDistance[startMethod][bucket][position]` — bucketed.
 *   2. `customCurves[startMethod][position]` — flat per-startMethod curve.
 *   3. `DEFAULT_*_CURVE[position]` — engine default.
 *   4. `POSITION_OVERFLOW_ADJ` — out-of-range gates.
 *
 * @param postPosition    Starting gate number (1-based).
 * @param startMethod     Race start method string ("Auto", "Volte", etc.).
 * @param raceDistance    Race distance in meters; selects byDistance bucket.
 * @param customCurves    Optional user/calibration-provided curves.
 * @returns               Adjustment in seconds (negative = faster).
 */
export const calculatePostPositionAdjustment = (
  postPosition: number,
  startMethod: string,
  raceDistance: number,
  customCurves?: PostPositionCurves,
): number => {
  if (!Number.isFinite(postPosition) || postPosition <= 0) {
    log.warn(`[postPos] invalid postPosition "${postPosition}" — returning 0s`);
    return 0;
  }

  const s = String(startMethod ?? '').trim().toLowerCase();
  const isVolte = s.startsWith('volt') || s === 'v';
  const sm: 'auto' | 'volte' = isVolte ? 'volte' : 'auto';

  // 1. Per-distance bucketed curve, if available.
  const bucket = getDistanceBucket(raceDistance);
  const bucketedCurve = customCurves?.byDistance?.[sm]?.[bucket];
  const bucketedAdj = bucketedCurve?.[postPosition];
  if (typeof bucketedAdj === 'number' && Number.isFinite(bucketedAdj)) {
    log.debug(`[postPos] pos ${postPosition} ${sm.toUpperCase()} bucket=${bucket} (byDistance) → ${bucketedAdj >= 0 ? '+' : ''}${bucketedAdj.toFixed(3)}s`);
    return bucketedAdj;
  }

  // 2. Flat per-startMethod curve (custom or default).
  const flat = isVolte
    ? (customCurves?.volte ?? DEFAULT_VOLTE_CURVE)
    : (customCurves?.auto  ?? DEFAULT_AUTO_CURVE);

  const adjustment = flat[postPosition] ?? POSITION_OVERFLOW_ADJ;
  log.debug(`[postPos] pos ${postPosition} ${sm.toUpperCase()}${customCurves ? ' (custom)' : ''} → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};
