
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

export const getShoesDisplay = (frontHasShoe: boolean, backHasShoe: boolean) => {
  console.log('👟 getShoesDisplay - Input:', { frontHasShoe, backHasShoe });
  
  // If both front and back have no shoes (are barefoot)
  if (!frontHasShoe && !backHasShoe) {
    console.log('👟 All Barefoot');
    return "All Barefoot";
  }
  // If only front has no shoes
  if (!frontHasShoe && backHasShoe) {
    console.log('👟 Front Barefoot');
    return "Front Barefoot";
  }
  // If only back has no shoes  
  if (frontHasShoe && !backHasShoe) {
    console.log('👟 Back Barefoot');
    return "Back Barefoot";
  }
  // If both have shoes
  console.log('👟 Shod');
  return "Shod";
};

export const getShoesColor = (frontHasShoe: boolean, backHasShoe: boolean) => {
  // If any barefoot, show orange
  if (!frontHasShoe || !backHasShoe) return "text-orange-600 font-medium";
  return "text-gray-600";
};
