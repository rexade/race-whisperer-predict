
export const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  console.log('👟 ENHANCED calculateShoeAdjustment:', { frontShoes, backShoes, frontType: typeof frontShoes, backType: typeof backShoes });
  
  let adjustment = 0;
  let details = [];
  
  // Enhanced validation and logging
  if (frontShoes === "0" || frontShoes === "" || frontShoes === "false") {
    adjustment -= 0.1;
    details.push('Front barefoot: -0.1s');
  }
  if (backShoes === "0" || backShoes === "" || backShoes === "false") {
    adjustment -= 0.1;
    details.push('Back barefoot: -0.1s');
  }
  
  console.log('👟 Shoe adjustment details:', details.join(', '), `Total: ${adjustment}s`);
  return adjustment;
};

export const calculateSulkyAdjustment = (sulkyType: string): number => {
  console.log('🛷 ENHANCED calculateSulkyAdjustment:', { sulkyType, type: typeof sulkyType });
  
  // Enhanced validation to catch corruption
  if (!sulkyType || typeof sulkyType !== 'string') {
    console.warn('🚨 Invalid sulky type, defaulting to 0 adjustment:', sulkyType);
    return 0;
  }
  
  // Detect multiple corruption patterns
  const corruptionPatterns = [
    '[object Object]',
    'undefined',
    'null',
    '{}',
    '[object HTMLElement]',
    'function',
    'NaN'
  ];
  
  const hasCorruption = corruptionPatterns.some(pattern => 
    sulkyType.includes(pattern) || sulkyType === pattern
  );
  
  if (hasCorruption) {
    console.error('🚨 SULKY DATA CORRUPTION detected:', sulkyType);
    // Report corruption pattern for analysis
    console.error('🚨 Corruption pattern analysis:', {
      originalValue: sulkyType,
      length: sulkyType.length,
      containsObject: sulkyType.includes('[object'),
      containsFunction: sulkyType.includes('function'),
      isStringified: sulkyType.startsWith('{') || sulkyType.startsWith('[')
    });
    return 0; // Safe fallback
  }
  
  const normalizedType = sulkyType.toUpperCase().trim();
  let adjustment = 0;
  
  switch (normalizedType) {
    case "AM":
    case "AMERICAN":
      adjustment = -0.2;
      console.log('🛷 American sulky detected: -0.2s advantage');
      break;
    case "VA":
    case "VANLIG":
      adjustment = 0;
      console.log('🛷 Standard sulky detected: 0s adjustment');
      break;
    default:
      adjustment = 0;
      console.log('🛷 Unknown sulky type, no adjustment:', normalizedType);
      console.log('🛷 Valid sulky types: AM/AMERICAN (-0.2s), VA/VANLIG (0s)');
  }
  
  return adjustment;
};
