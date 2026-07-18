
// Import the robust calculators
import {
  calculateRobustShoeAdjustment,
  calculateRobustSulkyAdjustment
} from './robustEquipmentCalculators';
import { log } from '@/lib/logger';

export const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  const result = calculateRobustShoeAdjustment(frontShoes, backShoes);

  log.debug('shoe adjustment result:', {
    adjustment: result.adjustment,
    confidence: result.confidence,
    source: result.source,
    warnings: result.warnings,
    fallbackUsed: result.fallbackUsed
  });

  return result.adjustment;
};

export const calculateSulkyAdjustment = (sulkyType: string): number => {
  const result = calculateRobustSulkyAdjustment(sulkyType);

  log.debug('sulky adjustment result:', {
    sulkyType,
    adjustment: result.adjustment,
    confidence: result.confidence,
    source: result.source,
    warnings: result.warnings,
    fallbackUsed: result.fallbackUsed
  });

  if (result.confidence === 'low' || result.fallbackUsed) {
    log.warn('equipment calculation low confidence:', {
      sulkyType,
      issue: result.warnings.join(', '),
      usingFallback: result.fallbackUsed
    });
  }

  return result.adjustment;
};

/**
 * Shoe-change adjustment (seconds).
 *
 * Uses ATG's native changed flags (shoe state differs from the previous start).
 * In travsport a switch TO barefoot signals intent to go for a top result
 * (barefoot is faster but riskier), while a switch back TO shod is usually
 * conservative (young horse, track condition, hoof problems).
 *
 *   changed → barefoot:  −0.15 s per axle (front/back)
 *   changed → shod:      +0.10 s per axle
 *   unchanged/unknown:    0
 *
 * `isBarefootNow` values are the extraction-normalized strings/booleans used
 * across the equipment pipeline: false/'false' = barefoot, true/'true' = shod.
 */
const SHOE_CHANGE_TO_BAREFOOT_S = -0.15;
const SHOE_CHANGE_TO_SHOD_S = 0.10;

export const calculateShoeChangeAdjustment = (
  frontShoe: unknown,
  backShoe: unknown,
  frontChanged?: boolean,
  backChanged?: boolean
): number => {
  const isShod = (v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const n = v.toLowerCase().trim();
      if (n === 'true' || n === '1') return true;
      if (n === 'false' || n === '0' || n === '') return false;
    }
    return undefined;
  };

  let adj = 0;
  for (const [shoe, changed] of [[frontShoe, frontChanged], [backShoe, backChanged]] as const) {
    if (!changed) continue;
    const shod = isShod(shoe);
    if (shod === false) adj += SHOE_CHANGE_TO_BAREFOOT_S;
    else if (shod === true) adj += SHOE_CHANGE_TO_SHOD_S;
  }

  if (adj !== 0) log.debug(`[shoeChange] front=${frontChanged} back=${backChanged} → ${adj.toFixed(2)}s`);
  return adj;
};

// Export the robust calculation functions for advanced usage
export { calculateRobustShoeAdjustment, calculateRobustSulkyAdjustment };
