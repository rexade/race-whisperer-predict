/**
 * ROBUST Equipment Calculators
 * Enhanced versions with comprehensive validation, corruption detection, and fallbacks
 */

export interface EquipmentCalculationResult {
  adjustment: number;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  warnings: string[];
  fallbackUsed: boolean;
}

export const calculateRobustShoeAdjustment = (
  frontShoes: any, 
  backShoes: any,
  horseId?: number
): EquipmentCalculationResult => {
  console.log(`👟 ROBUST calculateShoeAdjustment for horse ${horseId}:`, { 
    frontShoes, 
    backShoes, 
    frontType: typeof frontShoes, 
    backType: typeof backShoes 
  });
  
  const result: EquipmentCalculationResult = {
    adjustment: 0,
    confidence: 'high',
    source: 'calculated',
    warnings: [],
    fallbackUsed: false
  };
  
  // Enhanced validation with corruption detection
  const validateShoeValue = (value: any, position: string): boolean => {
    if (value === null || value === undefined) {
      result.warnings.push(`${position} shoes is null/undefined`);
      return true; // Default to shod (no adjustment)
    }
    
    if (typeof value === 'string' && value.includes('[object Object]')) {
      result.warnings.push(`${position} shoes corrupted: ${value}`);
      result.confidence = 'low';
      return true; // Safe fallback
    }
    
    return false;
  };
  
  const frontCorrupted = validateShoeValue(frontShoes, 'Front');
  const backCorrupted = validateShoeValue(backShoes, 'Back');
  
  if (frontCorrupted || backCorrupted) {
    result.fallbackUsed = true;
    result.source = 'fallback_due_to_corruption';
  }
  
  // Enhanced barefoot detection
  const isBarefoot = (value: any): boolean => {
    if (typeof value === 'boolean') return !value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim();
      return normalized === 'false' || normalized === '0' || normalized === '';
    }
    if (typeof value === 'number') return value === 0;
    return false; // Default to shod if uncertain
  };
  
  const frontBarefoot = isBarefoot(frontShoes);
  const backBarefoot = isBarefoot(backShoes);
  
  // Apply adjustments for barefoot conditions
  if (frontBarefoot) {
    result.adjustment -= 0.1;
    result.warnings.push('Front barefoot: -0.1s advantage');
  }
  
  if (backBarefoot) {
    result.adjustment -= 0.1;
    result.warnings.push('Back barefoot: -0.1s advantage');
  }
  
  console.log(`👟 Shoe calculation result for horse ${horseId}:`, result);
  return result;
};

export const calculateRobustSulkyAdjustment = (
  sulkyType: any,
  horseId?: number
): EquipmentCalculationResult => {
  console.log(`🛷 ROBUST calculateSulkyAdjustment for horse ${horseId}:`, { 
    sulkyType, 
    type: typeof sulkyType 
  });
  
  const result: EquipmentCalculationResult = {
    adjustment: 0,
    confidence: 'high',
    source: 'calculated',
    warnings: [],
    fallbackUsed: false
  };
  
  // Comprehensive validation and corruption detection
  if (!sulkyType || typeof sulkyType !== 'string') {
    result.warnings.push(`Invalid sulky type: ${sulkyType} (${typeof sulkyType})`);
    result.fallbackUsed = true;
    result.confidence = 'low';
    result.source = 'fallback_invalid_type';
    return result;
  }
  
  // Enhanced corruption detection
  const corruptionPatterns = [
    '[object Object]',
    'undefined',
    'null',
    '{}',
    '[object HTMLElement]',
    'function',
    'NaN',
    'Symbol(',
    'Error:',
    'TypeError:'
  ];
  
  const hasCorruption = corruptionPatterns.some(pattern => 
    sulkyType.includes(pattern) || sulkyType === pattern
  );
  
  if (hasCorruption) {
    console.error(`🚨 SULKY CORRUPTION detected for horse ${horseId}:`, sulkyType);
    result.warnings.push(`Corrupted sulky data: ${sulkyType}`);
    result.fallbackUsed = true;
    result.confidence = 'low';
    result.source = 'fallback_corruption_detected';
    
    // Log detailed corruption analysis
    console.error('🚨 Corruption analysis:', {
      originalValue: sulkyType,
      length: sulkyType.length,
      containsObject: sulkyType.includes('[object'),
      containsFunction: sulkyType.includes('function'),
      isStringified: sulkyType.startsWith('{') || sulkyType.startsWith('['),
      horseId
    });
    
    return result;
  }
  
  // Enhanced sulky type mapping with comprehensive coverage
  const normalizedType = sulkyType.toUpperCase().trim();
  
  const sulkyMappings: Record<string, { adjustment: number; description: string }> = {
    // American sulky variations
    'AM': { adjustment: -0.2, description: 'American sulky advantage' },
    'AMERICAN': { adjustment: -0.2, description: 'American sulky advantage' },
    'A': { adjustment: -0.2, description: 'American sulky advantage' },
    'AMERIKANSK': { adjustment: -0.2, description: 'American sulky advantage' },
    'US': { adjustment: -0.2, description: 'American sulky advantage' },
    
    // Standard/Normal sulky variations
    'VA': { adjustment: 0, description: 'Standard sulky' },
    'VANLIG': { adjustment: 0, description: 'Standard sulky' },
    'V': { adjustment: 0, description: 'Standard sulky' },
    'NORMAL': { adjustment: 0, description: 'Standard sulky' },
    'REGULAR': { adjustment: 0, description: 'Standard sulky' },
    'STANDARD': { adjustment: 0, description: 'Standard sulky' },
    'STD': { adjustment: 0, description: 'Standard sulky' },
    'TRADITIONAL': { adjustment: 0, description: 'Standard sulky' },
    
    // Other sulky types (neutral for now)
    'B': { adjustment: 0, description: 'Bike sulky' },
    'BIKE': { adjustment: 0, description: 'Bike sulky' },
    'CYKEL': { adjustment: 0, description: 'Bike sulky' },
    'FR': { adjustment: 0, description: 'French sulky' },
    'FRANSK': { adjustment: 0, description: 'French sulky' },
    'FRENCH': { adjustment: 0, description: 'French sulky' },
    'LT': { adjustment: 0, description: 'Light sulky' },
    'LIGHT': { adjustment: 0, description: 'Light sulky' },
    'LÄTT': { adjustment: 0, description: 'Light sulky' }
  };
  
  const mapping = sulkyMappings[normalizedType];
  
  if (mapping) {
    result.adjustment = mapping.adjustment;
    result.warnings.push(mapping.description);
    result.source = `mapped_${normalizedType}`;
    console.log(`🛷 ✅ Mapped sulky type "${normalizedType}" → ${mapping.adjustment}s (${mapping.description})`);
  } else {
    // Unknown type - try pattern matching for variants
    if (normalizedType.startsWith('AM') || normalizedType.includes('AMERICAN')) {
      result.adjustment = -0.2;
      result.warnings.push(`Unknown American variant: ${normalizedType} → -0.2s`);
      result.confidence = 'medium';
      result.source = 'pattern_matched_american';
    } else if (normalizedType.startsWith('VA') || normalizedType.includes('VANLIG')) {
      result.adjustment = 0;
      result.warnings.push(`Unknown standard variant: ${normalizedType} → 0s`);
      result.confidence = 'medium';
      result.source = 'pattern_matched_standard';
    } else {
      result.adjustment = 0;
      result.warnings.push(`Unknown sulky type: ${normalizedType} → default 0s`);
      result.confidence = 'low';
      result.source = 'unknown_type_fallback';
    }
  }
  
  console.log(`🛷 Sulky calculation result for horse ${horseId}:`, result);
  return result;
};

// Legacy compatibility functions
export const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  const result = calculateRobustShoeAdjustment(frontShoes, backShoes);
  return result.adjustment;
};

export const calculateSulkyAdjustment = (sulkyType: string): number => {
  const result = calculateRobustSulkyAdjustment(sulkyType);
  return result.adjustment;
};
