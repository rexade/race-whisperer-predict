import { KmTime } from '../types/kmTimeTypes';
import { ATGHistoricalRace } from '../horseProcessing';

export interface HorseDebugInfo {
  horseId: number;
  horseName: string;
  stage: string;
  data: any;
  timestamp: string;
}

export class HorseDebugger {
  private static STORAGE_KEY = 'xander_debug_logs_v1';
  private static debugLogs: HorseDebugInfo[] = [];
  private static targetHorses: string[] = [];
  private static debugAllHorses = true; // Debug all horses by default
  private static isHydrated = false;

  private static hydrateFromStorage(): void {
    if (this.isHydrated) return;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        this.debugLogs = Array.isArray(parsed) ? parsed : (parsed?.logs || []);
      }
    } catch (e) {
      console.warn('XANDER DEBUG: Failed to hydrate logs from storage', e);
    } finally {
      this.isHydrated = true;
    }
  }

  private static persist(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.debugLogs));
      }
    } catch (e) {
      console.warn('XANDER DEBUG: Failed to persist logs to storage', e);
    }
  }
  static shouldDebugHorse(horseName: string): boolean {
    // If debugging all horses, always return true
    if (this.debugAllHorses) return true;
    
    // Otherwise check if horse name matches any target
    return this.targetHorses.some(target => 
      horseName.toLowerCase().includes(target.toLowerCase())
    );
  }

  static setTargetHorses(horses: string[]): void {
    this.targetHorses = horses;
    this.debugAllHorses = false;
  }

  static setDebugAllHorses(debug: boolean): void {
    this.debugAllHorses = debug;
  }

  static log(horseId: number, horseName: string, stage: string, data: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] ${stage.toUpperCase()}`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Data:`, data);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

    this.debugLogs.push({
      horseId,
      horseName,
      stage,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logHistoricalData(horseId: number, horseName: string, records: any[]): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] HISTORICAL_DATA_RECEIVED`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Total records: ${records?.length || 0}`);
    
    if (records && records.length > 0) {
      console.log(`   Sample record structure:`, {
        keys: Object.keys(records[0]),
        firstRecord: records[0]
      });
      
      records.forEach((record, index) => {
        console.log(`   Record ${index + 1}:`, {
          date: record.date,
          kmTime: record.kmTime,
          distance: record.start?.distance,
          startMethod: record.race?.startMethod,
          place: record.place,
          galloped: record.galloped,
          disqualified: record.disqualified
        });
      });
    }

    // Store the debug log entry for UI consumption
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'HISTORICAL_DATA_RECEIVED',
      data: {
        length: records?.length || 0,
        records: records || [],
        sampleRecord: records && records.length > 0 ? records[0] : null
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logProcessedTimes(horseId: number, horseName: string, processedTimes: any[], best3Average: KmTime): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] PROCESSED_TIMES_RESULT`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Valid processed times: ${processedTimes.length}`);
    console.log(`   Best time: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
    
    if (processedTimes.length > 0) {
      console.log(`   All processed times:`);
      processedTimes.forEach((time, index) => {
        console.log(`     ${index + 1}. Original: ${time.originalTime.minutes}:${time.originalTime.seconds.toString().padStart(2, '0')}.${time.originalTime.tenths} → Normalized: ${time.normalizedTime.minutes}:${time.normalizedTime.seconds.toString().padStart(2, '0')}.${time.normalizedTime.tenths} (${time.distance}m, ${time.startMethod})`);
      });
    }

    // Store the debug log entry for UI consumption
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'PROCESSED_TIMES',
      data: {
        validProcessedTimes: processedTimes.length,
        best3Average,
        processedTimes: processedTimes.map(time => ({
          originalTime: time.originalTime,
          normalizedTime: time.normalizedTime,
          distance: time.distance,
          startMethod: time.startMethod
        }))
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logNormalizationStep(horseId: number, horseName: string, step: string, before: any, after: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] NORMALIZATION_${step.toUpperCase()}`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Before: ${JSON.stringify(before)}`);
    console.log(`   After: ${JSON.stringify(after)}`);
  }

  static logFinalResult(horseId: number, horseName: string, rawKmTime: KmTime | undefined, normalizedResult: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] FINAL_RESULT`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Raw KM Time: ${rawKmTime ? `${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}` : 'NONE'}`);
    console.log(`   Normalized Result: ${normalizedResult ? 'EXISTS' : 'NONE'}`);
    if (normalizedResult?.modernNormalizedTime) {
      const time = normalizedResult.modernNormalizedTime;
      console.log(`   Final Predicted Time: ${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`);
    }
  }

  static logHistoricalNormalization(horseId: number, horseName: string, originalRace: any, normalizedTime: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] HISTORICAL_NORMALIZATION_STEP`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Race Date: ${originalRace.date}`);
    console.log(`   Distance: ${originalRace.distance}m`);
    console.log(`   Start Method: ${originalRace.startMethod}`);
    console.log(`   Original KM Time: ${originalRace.kmTime}`);
    console.log(`   Normalized to 2140m: ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
    
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'historical_normalization_step',
      data: {
        raceDate: originalRace.date,
        distance: originalRace.distance,
        startMethod: originalRace.startMethod,
        originalKmTime: originalRace.kmTime,
        normalizedKmTime: normalizedTime,
        place: originalRace.place,
        galloped: originalRace.galloped,
        disqualified: originalRace.disqualified
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logValidationStats(horseId: number, horseName: string, stats: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] VALIDATION_STATISTICS`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Total Historical Records: ${stats.totalRecords}`);
    console.log(`   Valid Records: ${stats.validRecords}`);
    console.log(`   Disqualified: ${stats.disqualified}`);
    console.log(`   Galloped: ${stats.galloped}`);
    console.log(`   Missing KM Times: ${stats.missingKmTimes}`);
    console.log(`   Best time used: ${stats.best3TimesUsed}`);
    
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'validation_statistics',
      data: stats,
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logModernNormalizationBreakdown(horseId: number, horseName: string, rawTime: any, adjustments: any, finalTime: any): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] MODERN_NORMALIZATION_BREAKDOWN`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Raw KM Time: ${rawTime.minutes}:${rawTime.seconds.toString().padStart(2, '0')}.${rawTime.tenths}`);
    console.log(`   Total Adjustment: ${adjustments.total?.toFixed(3)}s`);
    console.log(`   Final Time: ${finalTime.minutes}:${finalTime.seconds.toString().padStart(2, '0')}.${finalTime.tenths}`);
    
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'modern_normalization_breakdown',
      data: {
        rawTime,
        adjustments,
        finalTime,
        adjustmentBreakdown: {
          postPosition: adjustments.postPosition,
          equipment: adjustments.equipment,
          driver: adjustments.driver,
          track: adjustments.track,
          form: adjustments.form,
          distance: adjustments.distance,
          raceDistanceAdjustment: adjustments.raceDistanceAdjustment,
          raceType: adjustments.raceType,
          timeOfDay: adjustments.timeOfDay,
          startPoints: adjustments.startPoints,
          placePercentage: adjustments.placePercentage,
          horseWinPercentage: adjustments.horseWinPercentage,
          earningsPerStart: adjustments.earningsPerStart
        }
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logEquipmentData(horseId: number, horseName: string, sulkyType: any, frontShoes: any, backShoes: any): void {
    if (!this.shouldDebugHorse(horseName)) return;
    
    console.log(`🐎 [XANDER DEBUG] EQUIPMENT_VALIDATION`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Sulky Type: "${sulkyType}" (${typeof sulkyType})`);
    console.log(`   Front Shoes: "${frontShoes}" (${typeof frontShoes})`);
    console.log(`   Back Shoes: "${backShoes}" (${typeof backShoes})`);
    
    if (String(sulkyType).includes('[object Object]')) {
      console.error(`   🚨 SULKY CORRUPTION DETECTED!`);
    }
    
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'equipment_validation',
      data: { 
        sulkyType, 
        sulkyTypeType: typeof sulkyType,
        frontShoes, 
        frontShoesType: typeof frontShoes,
        backShoes,
        backShoesType: typeof backShoes,
        hasCorruption: String(sulkyType).includes('[object Object]')
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static logDataCorruption(horseId: number, horseName: string, fieldName: string, corruptedValue: any): void {
    console.error(`🐎 [XANDER DEBUG] DATA_CORRUPTION_DETECTED`);
    console.error(`   Horse: ${horseName} (ID: ${horseId})`);
    console.error(`   Field: ${fieldName}`);
    console.error(`   Corrupted Value: "${corruptedValue}" (${typeof corruptedValue})`);
    console.error(`   Is Object String: ${String(corruptedValue).includes('[object Object]')}`);
    
    this.debugLogs.push({
      horseId,
      horseName,
      stage: 'data_corruption',
      data: { 
        fieldName,
        corruptedValue,
        valueType: typeof corruptedValue,
        isObjectCorruption: String(corruptedValue).includes('[object Object]')
      },
      timestamp: new Date().toISOString()
    });
    this.persist();
  }

  static getDebugLogs(): HorseDebugInfo[] {
    this.hydrateFromStorage();
    return this.debugLogs;
  }

  static clearLogs(): void {
    this.debugLogs = [];
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch {}
  }

  static exportDebugReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      targetHorses: this.targetHorses,
      logs: this.debugLogs
    };
    return JSON.stringify(report, null, 2);
  }
}
