/**
 * Race 7 Specific Debugging Utilities
 * 
 * Tools to investigate specific time discrepancies in Race 7,
 * particularly focusing on Xander's time calculation.
 */

export interface Race7DebugOptions {
  enableDetailedLogging: boolean;
  compareWithWebsiteTimes: boolean;
  trackDataSources: boolean;
  validateNormalizationSteps: boolean;
}

export class Race7Debugger {
  
  static readonly EXPECTED_TIMES: Record<string, string> = {
    "xander": "1:14.6", // Website reference time
    // Add other horses as needed for comparison
  };

  static isRace7(raceNumber: number, raceName?: string): boolean {
    // Check if this is race 7 by number or name patterns
    if (raceNumber === 7) return true;
    if (raceName && raceName.toLowerCase().includes('race 7')) return true;
    return false;
  }

  static isXanderHorse(horseName: string): boolean {
    return horseName.toLowerCase().includes('xander');
  }
  
  static enableRace7Debugging(analysisDate: string, options: Race7DebugOptions = {
    enableDetailedLogging: true,
    compareWithWebsiteTimes: true,
    trackDataSources: true,
    validateNormalizationSteps: true
  }): void {
    
    console.log(`\n🔧 ===== RACE 7 & XANDER DEBUG MODE ENABLED =====`);
    console.log(`🎯 Analysis Date: ${analysisDate}`);
    console.log(`📊 Debug Options:`, options);
    console.log(`🌐 Expected Times Reference:`, Race7Debugger.EXPECTED_TIMES);
    console.log(`🐎 Xander Detection: ACTIVE`);
    console.log(`🏁 Race 7 Auto-Detection: ACTIVE`);
    console.log(`=======================================\n`);
    
    // Store options globally for other debugging functions to use
    (globalThis as any).__race7Debug = {
      analysisDate,
      options,
      enabled: true,
      investigationResults: []
    };
  }

  static shouldDebugRace(raceNumber: number, raceName?: string): boolean {
    if (!Race7Debugger.isDebugMode()) return false;
    return Race7Debugger.isRace7(raceNumber, raceName);
  }

  static shouldDebugHorse(horseName: string): boolean {
    if (!Race7Debugger.isDebugMode()) return false;
    return Race7Debugger.isXanderHorse(horseName);
  }
  
  static isDebugMode(): boolean {
    return !!(globalThis as any).__race7Debug?.enabled;
  }
  
  static getRaceDebugOptions(): Race7DebugOptions | null {
    return (globalThis as any).__race7Debug?.options || null;
  }
  
  static getExpectedTimeForHorse(horseName: string): string | null {
    const normalizedName = horseName.toLowerCase();
    for (const [key, time] of Object.entries(Race7Debugger.EXPECTED_TIMES)) {
      if (normalizedName.includes(key.toLowerCase())) {
        return time;
      }
    }
    return null;
  }
  
  static logDataSourceComparison(
    horseName: string,
    apiRecordsCount: number,
    filteredRecordsCount: number,
    calculatedTime: string
  ): void {
    
    if (!Race7Debugger.isDebugMode()) return;
    
    const expectedTime = Race7Debugger.getExpectedTimeForHorse(horseName);
    
    console.log(`\n📊 DATA SOURCE COMPARISON: ${horseName.toUpperCase()}`);
    console.log(`   API Records Retrieved: ${apiRecordsCount}`);
    console.log(`   After Filtering: ${filteredRecordsCount}`);
    console.log(`   Calculated Time: ${calculatedTime}`);
    
    if (expectedTime) {
      console.log(`   Expected Website Time: ${expectedTime}`);
      
      const parseTime = (timeStr: string): number => {
        const [minutes, rest] = timeStr.split(':');
        const [seconds, tenths] = rest.split('.');
        return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(tenths) / 10;
      };
      
      const calculatedSeconds = parseTime(calculatedTime);
      const expectedSeconds = parseTime(expectedTime);
      const discrepancy = calculatedSeconds - expectedSeconds;
      
      console.log(`   Discrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy.toFixed(2)}s`);
      
      if (Math.abs(discrepancy) > 1.0) {
        console.log(`   ⚠️  SIGNIFICANT DISCREPANCY DETECTED!`);
      }
    }
    
    console.log(`==================================================`);
  }
  
  static validateNormalizationStep(
    horseName: string,
    stepName: string,
    beforeTime: string,
    afterTime: string,
    adjustmentSeconds: number,
    reason: string
  ): void {
    
    if (!Race7Debugger.isDebugMode()) return;
    
    const options = Race7Debugger.getRaceDebugOptions();
    if (!options?.validateNormalizationSteps) return;
    
    console.log(`\n🔧 NORMALIZATION STEP: ${horseName} - ${stepName}`);
    console.log(`   Before: ${beforeTime}`);
    console.log(`   After: ${afterTime}`);
    console.log(`   Adjustment: ${adjustmentSeconds > 0 ? '+' : ''}${adjustmentSeconds.toFixed(3)}s`);
    console.log(`   Reason: ${reason}`);
  }
  
  static storeInvestigationResult(result: any): void {
    if (!Race7Debugger.isDebugMode()) return;
    
    const debugState = (globalThis as any).__race7Debug;
    if (debugState && debugState.investigationResults) {
      debugState.investigationResults.push(result);
    }
  }

  static createDebugSummary(raceResults: Array<{
    horseName: string;
    calculatedTime: string;
    historicalRecordsUsed: number;
  }>): void {
    
    if (!Race7Debugger.isDebugMode()) return;
    
    console.log(`\n🏁 ===== RACE 7 & XANDER DEBUG SUMMARY =====`);
    
    raceResults.forEach(result => {
      const expectedTime = Race7Debugger.getExpectedTimeForHorse(result.horseName);
      console.log(`\n🐎 ${result.horseName}:`);
      console.log(`   Calculated: ${result.calculatedTime}`);
      console.log(`   Records Used: ${result.historicalRecordsUsed}`);
      
      if (expectedTime) {
        console.log(`   Expected: ${expectedTime}`);
        
        const parseTime = (timeStr: string): number => {
          const [minutes, rest] = timeStr.split(':');
          const [seconds, tenths] = rest.split('.');
          return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(tenths) / 10;
        };
        
        const calculatedSeconds = parseTime(result.calculatedTime);
        const expectedSeconds = parseTime(expectedTime);
        const discrepancy = calculatedSeconds - expectedSeconds;
        
        console.log(`   Discrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy.toFixed(2)}s`);
        
        if (Math.abs(discrepancy) > 0.5) {
          console.log(`   ⚠️  Issue detected!`);
        } else {
          console.log(`   ✅ Within acceptable range`);
        }
      }
    });
    
    console.log(`\n=================================`);
  }

  static generatePostAnalysisReport(): void {
    if (!Race7Debugger.isDebugMode()) return;

    const debugState = (globalThis as any).__race7Debug;
    if (!debugState || !debugState.investigationResults) return;

    console.log(`\n📋 ===== POST-ANALYSIS INVESTIGATION REPORT =====`);
    console.log(`🗓️  Analysis Date: ${debugState.analysisDate}`);
    console.log(`🔍 Investigation Results Count: ${debugState.investigationResults.length}`);
    
    debugState.investigationResults.forEach((result: any, index: number) => {
      console.log(`\n--- Investigation ${index + 1} ---`);
      console.log(`🐎 Horse: ${result.horseName || 'Unknown'}`);
      console.log(`⏱️  Time: ${result.calculatedTime || 'N/A'}`);
      console.log(`📊 Records: ${result.historicalRecordsUsed || 0}`);
      if (result.expectedTime) {
        console.log(`🎯 Expected: ${result.expectedTime}`);
        console.log(`📈 Discrepancy: ${result.discrepancy || 'N/A'}`);
      }
    });
    
    console.log(`\n===============================================`);
  }
  
  static disableDebugMode(): void {
    delete (globalThis as any).__race7Debug;
    console.log(`🔧 Race 7 debug mode disabled`);
  }
}