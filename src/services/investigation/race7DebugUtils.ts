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
  
  static enableRace7Debugging(raceId: string, options: Race7DebugOptions = {
    enableDetailedLogging: true,
    compareWithWebsiteTimes: true,
    trackDataSources: true,
    validateNormalizationSteps: true
  }): void {
    
    console.log(`\n🔧 ===== RACE 7 DEBUG MODE ENABLED =====`);
    console.log(`🎯 Target Race ID: ${raceId}`);
    console.log(`📊 Debug Options:`, options);
    console.log(`🌐 Expected Times Reference:`, Race7Debugger.EXPECTED_TIMES);
    console.log(`=======================================\n`);
    
    // Store options globally for other debugging functions to use
    (globalThis as any).__race7Debug = {
      raceId,
      options,
      enabled: true
    };
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
  
  static createDebugSummary(raceResults: Array<{
    horseName: string;
    calculatedTime: string;
    historicalRecordsUsed: number;
  }>): void {
    
    if (!Race7Debugger.isDebugMode()) return;
    
    console.log(`\n🏁 ===== RACE 7 DEBUG SUMMARY =====`);
    
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
  
  static disableDebugMode(): void {
    delete (globalThis as any).__race7Debug;
    console.log(`🔧 Race 7 debug mode disabled`);
  }
}