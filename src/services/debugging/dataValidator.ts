import { KmTime } from '../types/kmTimeTypes';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  static validateKmTime(kmTime: any, context: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!kmTime) {
      result.isValid = false;
      result.errors.push(`${context}: KM time is null or undefined`);
      return result;
    }

    if (typeof kmTime.minutes !== 'number' || kmTime.minutes < 0) {
      result.isValid = false;
      result.errors.push(`${context}: Invalid minutes value: ${kmTime.minutes}`);
    }

    if (typeof kmTime.seconds !== 'number' || kmTime.seconds < 0 || kmTime.seconds >= 60) {
      result.isValid = false;
      result.errors.push(`${context}: Invalid seconds value: ${kmTime.seconds}`);
    }

    if (typeof kmTime.tenths !== 'number' || kmTime.tenths < 0 || kmTime.tenths >= 10) {
      result.isValid = false;
      result.errors.push(`${context}: Invalid tenths value: ${kmTime.tenths}`);
    }

    // Check for suspicious times
    const totalSeconds = kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
    if (totalSeconds === 0) {
      result.warnings.push(`${context}: Zero time detected`);
    } else if (totalSeconds < 60) {
      result.warnings.push(`${context}: Unusually fast time (${totalSeconds.toFixed(1)}s)`);
    } else if (totalSeconds > 120) {
      result.warnings.push(`${context}: Unusually slow time (${totalSeconds.toFixed(1)}s)`);
    }

    return result;
  }

  static validateHistoricalRecord(record: any, index: number): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const context = `Record ${index + 1}`;

    if (!record) {
      result.isValid = false;
      result.errors.push(`${context}: Record is null or undefined`);
      return result;
    }

    // Check required fields
    if (!record.date) {
      result.errors.push(`${context}: Missing date`);
    }

    if (!record.kmTime) {
      result.warnings.push(`${context}: Missing KM time`);
    } else {
      const kmTimeValidation = this.validateKmTime(record.kmTime, `${context} KM time`);
      result.errors.push(...kmTimeValidation.errors);
      result.warnings.push(...kmTimeValidation.warnings);
      if (!kmTimeValidation.isValid) {
        result.isValid = false;
      }
    }

    if (!record.start?.distance) {
      result.warnings.push(`${context}: Missing distance`);
    } else if (record.start.distance < 1000 || record.start.distance > 3000) {
      result.warnings.push(`${context}: Unusual distance: ${record.start.distance}m`);
    }

    if (!record.race?.startMethod) {
      result.warnings.push(`${context}: Missing start method`);
    }

    if (record.galloped) {
      result.warnings.push(`${context}: Horse galloped`);
    }

    if (record.disqualified) {
      result.warnings.push(`${context}: Horse disqualified`);
    }

    return result;
  }

  static validateHorseData(horse: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!horse) {
      result.isValid = false;
      result.errors.push('Horse data is null or undefined');
      return result;
    }

    if (!horse.horseId && !horse.id) {
      result.errors.push('Missing horse ID');
    }

    if (!horse.name && !horse.horseName) {
      result.warnings.push('Missing horse name');
    }

    if (!horse.postPosition) {
      result.warnings.push('Missing post position');
    }

    return result;
  }

  static logValidationResults(results: ValidationResult[], context: string): void {
    const errors = results.flatMap(r => r.errors);
    const warnings = results.flatMap(r => r.warnings);

    if (errors.length > 0) {
      console.error(`❌ ${context} Validation Errors:`, errors);
    }

    if (warnings.length > 0) {
      console.warn(`⚠️ ${context} Validation Warnings:`, warnings);
    }

    if (errors.length === 0 && warnings.length === 0) {
      console.log(`✅ ${context} Validation: All checks passed`);
    }
  }
}