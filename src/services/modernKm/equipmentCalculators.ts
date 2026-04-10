
// Import the robust calculators
import {
  calculateRobustShoeAdjustment,
  calculateRobustSulkyAdjustment,
  type EquipmentCalculationResult
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

// Export the robust calculation functions for advanced usage
export { calculateRobustShoeAdjustment, calculateRobustSulkyAdjustment };
