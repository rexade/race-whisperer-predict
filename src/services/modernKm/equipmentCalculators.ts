
// Import the robust calculators
import { 
  calculateRobustShoeAdjustment, 
  calculateRobustSulkyAdjustment,
  type EquipmentCalculationResult 
} from './robustEquipmentCalculators';

export const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  const result = calculateRobustShoeAdjustment(frontShoes, backShoes);
  
  // Enhanced logging with result details
  console.log('👟 ENHANCED shoe adjustment result:', {
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
  
  // Enhanced logging with result details
  console.log('🛷 ENHANCED sulky adjustment result:', {
    sulkyType,
    adjustment: result.adjustment,
    confidence: result.confidence,
    source: result.source,
    warnings: result.warnings,
    fallbackUsed: result.fallbackUsed
  });
  
  // Alert on low confidence or fallback usage
  if (result.confidence === 'low' || result.fallbackUsed) {
    console.warn('⚠️ EQUIPMENT CALCULATION WARNING:', {
      sulkyType,
      issue: result.warnings.join(', '),
      usingFallback: result.fallbackUsed
    });
  }
  
  return result.adjustment;
};

// Export the robust calculation functions for advanced usage
export { calculateRobustShoeAdjustment, calculateRobustSulkyAdjustment };
