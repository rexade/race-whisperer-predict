import { KmTime } from '../../../services/types/kmTimeTypes';

// Enhanced safety function to ensure we never render an object as React child
export const ensureStringForDisplay = (value: any): string => {
  // Removed console logs to reduce noise
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (value && typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') {
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      return String(value.name || 'Unknown Horse');
    }
  }
  
  return String(value || 'Unknown Horse');
};

export const formatKmTime = (time: { minutes?: number; seconds?: number; tenths?: number; code?: string } | null | undefined) => {
  if (!time) return '—';
  if (typeof time.minutes !== 'number' || typeof time.seconds !== 'number') return '—';
  if (time.minutes === 0 && time.seconds === 0 && (time.tenths ?? 0) === 0) return '—';
  return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths ?? 0}`;
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
  // Enhanced validation and conversion to handle edge cases
  const frontShoe = frontHasShoe === true || frontHasShoe === 1 || frontHasShoe === "1" || frontHasShoe === "true";
  const backShoe = backHasShoe === true || backHasShoe === 1 || backHasShoe === "1" || backHasShoe === "true";
  
  // Swedish trotting notation:
  // cc = Skor runt om (shoes all around)
  // ȼc = Barfota fram, skor bak (barefoot front, shoes back)  
  // cȼ = Skor fram, barfota bak (shoes front, barefoot back)
  // ȼȼ = Barfota runt om (barefoot all around)
  
  if (!frontShoe && !backShoe) {
    return "ȼȼ"; // Barfota runt om
  }
  if (!frontShoe && backShoe) {
    return "ȼc"; // Barfota fram, skor bak
  }
  if (frontShoe && !backShoe) {
    return "cȼ"; // Skor fram, barfota bak
  }
  // Both have shoes
  return "cc"; // Skor runt om
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
  // Removed console logs to reduce noise
  
  if (!sulkyType || typeof sulkyType !== 'string') {
    return 'VA';
  }
  
  // CRITICAL FIX: Detect and handle [object Object] corruption
  if (sulkyType.includes('[object Object]') || sulkyType === '[object Object]') {
    return 'VA'; // Safe fallback
  }
  
  const type = sulkyType.toUpperCase().trim();
  
  // ENHANCED: More comprehensive sulky type mappings with ATG API codes
  switch (type) {
    // American sulky variations
    case 'AMERICAN':
    case 'AM':
    case 'A':
    case 'AMERIKANSK':
      return 'AM';
    
    // Standard/Normal sulky variations
    case 'VANLIG':
    case 'VA':
    case 'V':
    case 'NORMAL':
    case 'REGULAR':
    case 'STANDARD':
    case 'STD':
      return 'VA';
    
    // Bike sulky variations
    case 'BIKE':
    case 'B':
    case 'CYKEL':
      return 'B';
    
    // French sulky variations
    case 'FRANSK':
    case 'FRENCH':
    case 'FR':
    case 'F':
      return 'FR';
    
    // Light sulky variations
    case 'LIGHT':
    case 'LÄTT':
    case 'LT':
    case 'L':
      return 'LT';
    
    // Special cases for short codes that might come from API
    case 'VA1':
    case 'VA2':
      return 'VA';
    
    case 'AM1':
    case 'AM2':
      return 'AM';
    
    default:
      // For unknown types, try to extract meaningful code
      if (type.length >= 2) {
        return type.substring(0, 2);
      } else {
        return 'VA';
      }
  }
};
