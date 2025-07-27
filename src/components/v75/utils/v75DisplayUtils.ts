import { KmTime } from '../../../services/types/kmTimeTypes';

// Enhanced safety function to ensure we never render an object as React child
export const ensureStringForDisplay = (value: any): string => {
  console.log('🔍 v75DisplayUtils - ensureStringForDisplay input:', JSON.stringify(value), 'Type:', typeof value);
  
  if (typeof value === 'string') {
    console.log('✅ v75DisplayUtils - Value is already a string:', value);
    return value;
  }
  
  if (value && typeof value === 'object') {
    console.log('🔧 v75DisplayUtils - Value is object, extracting name...');
    if ('name' in value && typeof value.name === 'string') {
      console.log('✅ v75DisplayUtils - Extracted name from object.name:', value.name);
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      console.log('✅ v75DisplayUtils - Extracted name from id/name object:', value.name);
      return String(value.name || 'Unknown Horse');
    }
    console.error('❌ v75DisplayUtils - Object has no valid name property:', JSON.stringify(value));
  }
  
  console.warn('⚠️ v75DisplayUtils - Fallback conversion:', value, 'to string');
  return String(value || 'Unknown Horse');
};

export const formatKmTime = (time: { minutes: number; seconds: number; tenths: number }) => {
  return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
};

export const formatAdjustment = (adjustment: number) => {
  const sign = adjustment >= 0 ? '+' : '';
  return `${sign}${adjustment.toFixed(3)}s`;
};

export const formatEarnings = (earnings: number) => {
  const adjustedEarnings = earnings / 100;
  if (adjustedEarnings >= 1000) {
    return `${(adjustedEarnings / 1000).toFixed(0)}k`;
  }
  return adjustedEarnings.toFixed(0);
};

export const getShoesDisplay = (frontHasShoe: any, backHasShoe: any) => {
  console.log('👟 getShoesDisplay - Input:', { 
    frontHasShoe, 
    backHasShoe, 
    frontType: typeof frontHasShoe, 
    backType: typeof backHasShoe 
  });
  
  // Enhanced validation and conversion to handle edge cases
  const frontShoe = frontHasShoe === true || frontHasShoe === 1 || frontHasShoe === "1" || frontHasShoe === "true";
  const backShoe = backHasShoe === true || backHasShoe === 1 || backHasShoe === "1" || backHasShoe === "true";
  
  console.log('👟 getShoesDisplay - Processed values:', { frontShoe, backShoe });
  
  // If both front and back have no shoes (are barefoot)
  if (!frontShoe && !backShoe) {
    console.log('👟 Result: All Barefoot');
    return "All Barefoot";
  }
  // If only front has no shoes
  if (!frontShoe && backShoe) {
    console.log('👟 Result: Front Barefoot');
    return "Front Barefoot";
  }
  // If only back has no shoes  
  if (frontShoe && !backShoe) {
    console.log('👟 Result: Back Barefoot');
    return "Back Barefoot";
  }
  // If both have shoes
  console.log('👟 Result: Shod');
  return "Shod";
};

export const getShoesColor = (frontHasShoe: any, backHasShoe: any) => {
  // Enhanced validation and conversion to handle edge cases
  const frontShoe = frontHasShoe === true || frontHasShoe === 1 || frontHasShoe === "1" || frontHasShoe === "true";
  const backShoe = backHasShoe === true || backHasShoe === 1 || backHasShoe === "1" || backHasShoe === "true";
  
  // If any barefoot, show orange
  if (!frontShoe || !backShoe) return "text-orange-600 font-medium";
  return "text-gray-600";
};

export const getSulkyDisplay = (sulkyType: string | undefined) => {
  console.log('🛷 getSulkyDisplay - Input:', { sulkyType, type: typeof sulkyType });
  
  if (!sulkyType || typeof sulkyType !== 'string') {
    console.log('🛷 No valid sulky type, defaulting to VA');
    return 'VA';
  }
  
  // CRITICAL FIX: Detect and handle [object Object] corruption
  if (sulkyType.includes('[object Object]') || sulkyType === '[object Object]') {
    console.error('🚨 SULKY DATA CORRUPTION DETECTED: [object Object] found in sulky type');
    return 'VA'; // Safe fallback
  }
  
  const type = sulkyType.toUpperCase().trim();
  console.log('🛷 Processed sulky type:', type);
  
  // ENHANCED: More comprehensive sulky type mappings with ATG API codes
  switch (type) {
    // American sulky variations
    case 'AMERICAN':
    case 'AM':
    case 'A':
    case 'AMERIKANSK':
      console.log('🛷 Mapped to: AM');
      return 'AM';
    
    // Standard/Normal sulky variations
    case 'VANLIG':
    case 'VA':
    case 'V':
    case 'NORMAL':
    case 'REGULAR':
    case 'STANDARD':
    case 'STD':
      console.log('🛷 Mapped to: VA');
      return 'VA';
    
    // Bike sulky variations
    case 'BIKE':
    case 'B':
    case 'CYKEL':
      console.log('🛷 Mapped to: B');
      return 'B';
    
    // French sulky variations
    case 'FRANSK':
    case 'FRENCH':
    case 'FR':
    case 'F':
      console.log('🛷 Mapped to: FR');
      return 'FR';
    
    // Light sulky variations
    case 'LIGHT':
    case 'LÄTT':
    case 'LT':
    case 'L':
      console.log('🛷 Mapped to: LT');
      return 'LT';
    
    // Special cases for short codes that might come from API
    case 'VA1':
    case 'VA2':
      console.log('🛷 VA variant mapped to: VA');
      return 'VA';
    
    case 'AM1':
    case 'AM2':
      console.log('🛷 AM variant mapped to: AM');
      return 'AM';
    
    default:
      // For unknown types, try to extract meaningful code
      if (type.length >= 2) {
        const result = type.substring(0, 2);
        console.log('🛷 Unknown type, using first 2 chars:', result);
        return result;
      } else {
        console.log('🛷 Very short unknown type, defaulting to VA');
        return 'VA';
      }
  }
};
