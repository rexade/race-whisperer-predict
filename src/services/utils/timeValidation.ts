
import { KmTime } from '../types/kmTimeTypes';
import { kmTimeToSeconds, formatKmTime } from './kmTimeUtils';

/**
 * Validation result for time calculations
 */
export interface TimeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedTime?: KmTime;
}

/**
 * Validates a KM time object for correctness
 */
export const validateKmTime = (kmTime: KmTime, context?: string): TimeValidationResult => {
  const result: TimeValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  const prefix = context ? `${context}: ` : '';

  // Check for valid numeric values
  if (!Number.isInteger(kmTime.minutes) || kmTime.minutes < 0) {
    result.errors.push(`${prefix}Invalid minutes value: ${kmTime.minutes}`);
    result.isValid = false;
  }

  if (!Number.isInteger(kmTime.seconds) || kmTime.seconds < 0 || kmTime.seconds >= 60) {
    result.errors.push(`${prefix}Invalid seconds value: ${kmTime.seconds} (must be 0-59)`);
    result.isValid = false;
  }

  if (!Number.isInteger(kmTime.tenths) || kmTime.tenths < 0 || kmTime.tenths >= 10) {
    result.errors.push(`${prefix}Invalid tenths value: ${kmTime.tenths} (must be 0-9)`);
    result.isValid = false;
  }

  // Check for reasonable time ranges
  const totalSeconds = kmTimeToSeconds(kmTime);
  if (totalSeconds < 60) {
    result.warnings.push(`${prefix}Unusually fast time: ${formatKmTime(kmTime)} (< 1:00.0)`);
  }

  if (totalSeconds > 120) {
    result.warnings.push(`${prefix}Unusually slow time: ${formatKmTime(kmTime)} (> 2:00.0)`);
  }

  // Check for zero time (invalid)
  if (totalSeconds === 0) {
    result.errors.push(`${prefix}Zero time is invalid`);
    result.isValid = false;
  }

  return result;
};

/**
 * Validates adjustment values for reasonableness
 */
export const validateAdjustment = (
  adjustment: number, 
  adjustmentType: string, 
  maxReasonableAdjustment: number = 10
): TimeValidationResult => {
  const result: TimeValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!Number.isFinite(adjustment)) {
    result.errors.push(`${adjustmentType}: Invalid adjustment value: ${adjustment}`);
    result.isValid = false;
    return result;
  }

  if (Math.abs(adjustment) > maxReasonableAdjustment) {
    result.warnings.push(`${adjustmentType}: Large adjustment detected: ${adjustment.toFixed(3)}s`);
  }

  return result;
};

/**
 * Validates a complete normalization result
 */
export const validateNormalizationResult = (
  rawTime: KmTime,
  normalizedTime: KmTime,
  totalAdjustment: number
): TimeValidationResult => {
  const result: TimeValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Validate individual times
  const rawValidation = validateKmTime(rawTime, 'Raw time');
  const normalizedValidation = validateKmTime(normalizedTime, 'Normalized time');

  result.errors.push(...rawValidation.errors, ...normalizedValidation.errors);
  result.warnings.push(...rawValidation.warnings, ...normalizedValidation.warnings);

  if (!rawValidation.isValid || !normalizedValidation.isValid) {
    result.isValid = false;
    return result;
  }

  // Check adjustment consistency
  const rawSeconds = kmTimeToSeconds(rawTime);
  const normalizedSeconds = kmTimeToSeconds(normalizedTime);
  const actualAdjustment = normalizedSeconds - rawSeconds;

  if (Math.abs(actualAdjustment - totalAdjustment) > 0.1) {
    result.warnings.push(
      `Adjustment inconsistency: Expected ${totalAdjustment.toFixed(3)}s, actual ${actualAdjustment.toFixed(3)}s`
    );
  }

  return result;
};

/**
 * Batch validates multiple KM times
 */
export const validateKmTimes = (times: Array<{ time: KmTime; label?: string }>): TimeValidationResult => {
  const result: TimeValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  times.forEach(({ time, label }, index) => {
    const validation = validateKmTime(time, label || `Time ${index + 1}`);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
    
    if (!validation.isValid) {
      result.isValid = false;
    }
  });

  return result;
};
