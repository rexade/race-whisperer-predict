import { log } from '@/lib/logger';

/**
 * Post-position default curves (seconds).
 *
 * Negative = advantage (inner positions), positive = penalty (outer).
 * Values represent the raw adjustment BEFORE the postPosition weight is
 * applied.  Custom curves from the UI override these.
 */
export const DEFAULT_AUTO_CURVE: Record<number, number> = {
   1: -0.138,
   2: -0.075,
   3: -0.150,
   4: -0.250,
   5: -0.025,
   6: -0.050,
   7:  0.300,
   8:  0.350,
   9:  0.550,
  10:  0.750,
  11:  0.675,
  12:  0.800,
  13:  1.000,
  14:  0.875,
  15:  0.850,
};

export const DEFAULT_VOLTE_CURVE: Record<number, number> = {
   1: -0.350,
   2: -0.350,
   3: -0.125,
   4:  0.100,
   5:  0.150,
   6: -0.075,
   7:  0.250,
   8:  0.175,
   9:  0.475,
  10:  0.450,
  11:  0.750,
  12:  0.775,
  13:  1.000,
  14:  0.913,
  15:  0.875,
};

/** Fallback value for any position beyond the curve table. */
const POSITION_OVERFLOW_ADJ = 1.00;

/**
 * Post-position time adjustment.
 *
 * @param postPosition    Starting gate number (1-based).
 * @param startMethod     Race start method string ("Auto", "Volte", etc.).
 * @param customCurves    Optional user-defined curves from the UI.
 * @returns               Adjustment in seconds (negative = faster).
 */
export const calculatePostPositionAdjustment = (
  postPosition: number,
  startMethod: string,
  customCurves?: { auto: Record<number, number>; volte: Record<number, number> }
): number => {
  if (!Number.isFinite(postPosition) || postPosition <= 0) {
    log.warn(`[postPos] invalid postPosition "${postPosition}" — returning 0s`);
    return 0;
  }

  const s = String(startMethod ?? '').trim().toLowerCase();
  const isVolte = s.startsWith('volt') || s === 'v';

  const curve = isVolte
    ? (customCurves?.volte ?? DEFAULT_VOLTE_CURVE)
    : (customCurves?.auto  ?? DEFAULT_AUTO_CURVE);

  const adjustment = curve[postPosition] ?? POSITION_OVERFLOW_ADJ;
  log.debug(`[postPos] pos ${postPosition} ${isVolte ? 'VOLTE' : 'AUTO'}${customCurves ? ' (custom)' : ''} → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};
