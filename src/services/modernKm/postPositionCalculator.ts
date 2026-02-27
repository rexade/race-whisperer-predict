import { log } from '@/lib/logger';

/**
 * Post-position default curves (seconds).
 *
 * Negative = advantage (inner positions), positive = penalty (outer).
 * Values represent the raw adjustment BEFORE the postPosition weight is
 * applied.  Custom curves from the UI override these.
 */
const DEFAULT_AUTO_CURVE: Record<number, number> = {
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

const DEFAULT_VOLTE_CURVE: Record<number, number> = {
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
