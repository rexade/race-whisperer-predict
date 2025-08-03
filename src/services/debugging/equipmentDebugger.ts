/**
 * Equipment Data Debugging and Validation Service
 * Provides comprehensive logging and analysis for equipment-related data corruption
 */

interface EquipmentDebugEntry {
  horseId: number;
  horseName: string;
  timestamp: string;
  stage: string;
  data: {
    sulkyType?: any;
    frontShoes?: any;
    backShoes?: any;
    originalSource?: string;
    extractedValues?: any;
    validationResult?: any;
    calculationType?: string;
    input?: any;
    result?: any;
    fieldName?: string;
    corruptedValue?: any;
    detectionMethod?: string;
    valueType?: string;
    valueLength?: number;
  };
  issues: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class EquipmentDebugger {
  private static debugEntries: EquipmentDebugEntry[] = [];
  private static isEnabled = true; // Enable by default for equipment issues

  static setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    console.log(`🔧 Equipment Debugger ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  static logEquipmentExtraction(
    horseId: number,
    horseName: string,
    rawData: any,
    extractedData: any,
    source: string
  ) {
    if (!this.isEnabled) return;

    const issues: string[] = [];
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';

    // Check for sulky corruption
    if (extractedData.sulkyType && extractedData.sulkyType.includes('[object Object]')) {
      issues.push('SULKY CORRUPTION: [object Object] detected');
      severity = 'critical';
    }

    // Check for missing equipment data
    if (!rawData.sulky && !rawData.equipment?.sulky) {
      issues.push('No sulky data found in source');
      severity = 'warning';
    }

    this.addEntry({
      horseId,
      horseName,
      timestamp: new Date().toISOString(),
      stage: 'extraction',
      data: {
        originalSource: source,
        sulkyType: extractedData.sulkyType,
        frontShoes: extractedData.frontShoes,
        backShoes: extractedData.backShoes,
        extractedValues: extractedData
      },
      issues,
      severity
    });

    if (severity === 'critical') {
      console.error(`🚨 CRITICAL EQUIPMENT ISSUE - Horse ${horseName} (${horseId}):`, issues);
      console.error('Raw data:', rawData);
      console.error('Extracted data:', extractedData);
    }
  }

  static logEquipmentValidation(
    horseId: number,
    horseName: string,
    validationResult: any,
    originalValues: any
  ) {
    if (!this.isEnabled) return;

    const issues: string[] = [];
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';

    if (!validationResult.isValid) {
      issues.push(...validationResult.errors);
      severity = 'error';
    }

    if (validationResult.warnings?.length > 0) {
      issues.push(...validationResult.warnings);
      if (severity === 'info') severity = 'warning';
    }

    this.addEntry({
      horseId,
      horseName,
      timestamp: new Date().toISOString(),
      stage: 'validation',
      data: {
        validationResult,
        sulkyType: originalValues.sulkyType,
        frontShoes: originalValues.frontShoes,
        backShoes: originalValues.backShoes
      },
      issues,
      severity
    });
  }

  static logEquipmentCalculation(
    horseId: number,
    horseName: string,
    calculationType: 'shoes' | 'sulky',
    input: any,
    result: any
  ) {
    if (!this.isEnabled) return;

    const issues: string[] = [];
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';

    if (result.fallbackUsed) {
      issues.push(`Fallback used for ${calculationType} calculation`);
      severity = 'warning';
    }

    if (result.confidence === 'low') {
      issues.push(`Low confidence ${calculationType} calculation`);
      severity = 'warning';
    }

    if (result.warnings?.length > 0) {
      issues.push(...result.warnings);
    }

    this.addEntry({
      horseId,
      horseName,
      timestamp: new Date().toISOString(),
      stage: `${calculationType}_calculation`,
      data: {
        calculationType,
        input,
        result
      },
      issues,
      severity
    });
  }

  static logCorruptionPattern(
    horseId: number,
    horseName: string,
    fieldName: string,
    corruptedValue: any,
    detectionMethod: string
  ) {
    if (!this.isEnabled) return;

    this.addEntry({
      horseId,
      horseName,
      timestamp: new Date().toISOString(),
      stage: 'corruption_detection',
      data: {
        fieldName,
        corruptedValue,
        detectionMethod,
        valueType: typeof corruptedValue,
        valueLength: corruptedValue?.length || 0
      },
      issues: [`CORRUPTION: ${fieldName} = ${corruptedValue}`],
      severity: 'critical'
    });

    console.error(`🚨 CORRUPTION DETECTED - Horse ${horseName} (${horseId}):`, {
      field: fieldName,
      value: corruptedValue,
      detection: detectionMethod
    });
  }

  private static addEntry(entry: EquipmentDebugEntry) {
    this.debugEntries.push(entry);
    
    // Keep only last 1000 entries to prevent memory issues
    if (this.debugEntries.length > 1000) {
      this.debugEntries = this.debugEntries.slice(-1000);
    }

    // Log based on severity
    const logData = {
      horse: `${entry.horseName} (${entry.horseId})`,
      stage: entry.stage,
      issues: entry.issues
    };

    switch (entry.severity) {
      case 'critical':
        console.error('🚨 CRITICAL EQUIPMENT ISSUE:', logData);
        break;
      case 'error':
        console.error('❌ EQUIPMENT ERROR:', logData);
        break;
      case 'warning':
        console.warn('⚠️ EQUIPMENT WARNING:', logData);
        break;
      case 'info':
        console.log('ℹ️ Equipment Info:', logData);
        break;
    }
  }

  static getDebugSummary() {
    const summary = {
      totalEntries: this.debugEntries.length,
      bySeverity: {} as Record<string, number>,
      byStage: {} as Record<string, number>,
      recentCritical: this.debugEntries
        .filter(e => e.severity === 'critical')
        .slice(-10)
        .map(e => ({
          horse: `${e.horseName} (${e.horseId})`,
          stage: e.stage,
          issues: e.issues,
          timestamp: e.timestamp
        }))
    };

    this.debugEntries.forEach(entry => {
      summary.bySeverity[entry.severity] = (summary.bySeverity[entry.severity] || 0) + 1;
      summary.byStage[entry.stage] = (summary.byStage[entry.stage] || 0) + 1;
    });

    return summary;
  }

  static exportDebugReport(): string {
    return JSON.stringify({
      metadata: {
        totalEntries: this.debugEntries.length,
        generatedAt: new Date().toISOString(),
        isEnabled: this.isEnabled
      },
      summary: this.getDebugSummary(),
      entries: this.debugEntries
    }, null, 2);
  }

  static clearDebugData() {
    this.debugEntries = [];
    console.log('🧹 Equipment debug data cleared');
  }

  static getEntriesForHorse(horseId: number): EquipmentDebugEntry[] {
    return this.debugEntries.filter(entry => entry.horseId === horseId);
  }

  static getCriticalIssues(): EquipmentDebugEntry[] {
    return this.debugEntries.filter(entry => entry.severity === 'critical');
  }
}
