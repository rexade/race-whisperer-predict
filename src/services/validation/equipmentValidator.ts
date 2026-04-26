import { HorseDebugger } from '../debugging/horseDebugger';
import { log } from '@/lib/logger';

export interface EquipmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: {
    sulkyType: string;
    frontShoes: string;
    backShoes: string;
  };
}

export class EquipmentValidator {
  static validateAndCorrectEquipmentData(
    horseId: number,
    horseName: string,
    sulkyType: any,
    frontShoes: any,
    backShoes: any
  ): EquipmentValidationResult {
    const result: EquipmentValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Log equipment data for debugging
    HorseDebugger.logEquipmentData(horseId, horseName, sulkyType, frontShoes, backShoes);

    // Validate and correct sulky type
    let correctedSulkyType = "VA"; // Default fallback
    if (sulkyType === null || sulkyType === undefined) {
      result.warnings.push(`Sulky type is null/undefined, using default: VA`);
    } else if (typeof sulkyType !== 'string') {
      if (String(sulkyType).includes('[object Object]')) {
        result.errors.push(`CRITICAL: Sulky type corrupted to [object Object]`);
        HorseDebugger.logDataCorruption(horseId, horseName, 'sulkyType', sulkyType);
        result.isValid = false;
      } else {
        correctedSulkyType = String(sulkyType);
        result.warnings.push(`Sulky type converted from ${typeof sulkyType} to string: ${correctedSulkyType}`);
      }
    } else {
      correctedSulkyType = sulkyType;
    }

    // Validate and correct shoes data
    let correctedFrontShoes = "1"; // Default to shod
    let correctedBackShoes = "1";

    // Front shoes validation
    if (typeof frontShoes === 'boolean') {
      correctedFrontShoes = frontShoes ? "1" : "0";
    } else if (typeof frontShoes === 'string') {
      correctedFrontShoes = frontShoes;
    } else if (frontShoes === null || frontShoes === undefined) {
      result.warnings.push(`Front shoes is null/undefined, defaulting to shod (1)`);
    } else {
      correctedFrontShoes = String(frontShoes);
      result.warnings.push(`Front shoes converted from ${typeof frontShoes} to string: ${correctedFrontShoes}`);
    }

    // Back shoes validation
    if (typeof backShoes === 'boolean') {
      correctedBackShoes = backShoes ? "1" : "0";
    } else if (typeof backShoes === 'string') {
      correctedBackShoes = backShoes;
    } else if (backShoes === null || backShoes === undefined) {
      result.warnings.push(`Back shoes is null/undefined, defaulting to shod (1)`);
    } else {
      correctedBackShoes = String(backShoes);
      result.warnings.push(`Back shoes converted from ${typeof backShoes} to string: ${correctedBackShoes}`);
    }

    result.correctedData = {
      sulkyType: correctedSulkyType,
      frontShoes: correctedFrontShoes,
      backShoes: correctedBackShoes
    };

    // Log final validation result
    log.debug(`🛡️ Equipment validation for ${horseName}:`, result.correctedData);

    return result;
  }

  static validateSulkyType(sulkyType: any): { isValid: boolean; corrected: string; issues: string[] } {
    const issues: string[] = [];
    let corrected = "VA";

    if (sulkyType === null || sulkyType === undefined) {
      issues.push("Sulky type is null/undefined");
      return { isValid: false, corrected, issues };
    }

    if (typeof sulkyType !== 'string') {
      if (String(sulkyType).includes('[object Object]')) {
        issues.push("CRITICAL: [object Object] corruption detected");
        return { isValid: false, corrected, issues };
      }
      
      corrected = String(sulkyType);
      issues.push(`Type conversion: ${typeof sulkyType} → string`);
      return { isValid: true, corrected, issues };
    }

    // Valid string - normalize
    corrected = sulkyType.toUpperCase().trim();
    const validTypes = ['VA', 'AM', 'B', 'FR', 'LT', 'VANLIG', 'AMERICAN'];
    
    if (!validTypes.includes(corrected) && corrected.length > 2) {
      issues.push(`Unknown sulky type: ${corrected}`);
    }

    return { isValid: true, corrected, issues };
  }
}