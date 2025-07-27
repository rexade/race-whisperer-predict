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
  private static debugLogs: HorseDebugInfo[] = [];
  private static targetHorses = ['xander', 'Xander', 'rock solid', 'Rock Solid', 'ROCK SOLID'];

  static shouldDebugHorse(horseName: string): boolean {
    return this.targetHorses.some(target => 
      horseName.toLowerCase().includes(target.toLowerCase())
    );
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
  }

  static logProcessedTimes(horseId: number, horseName: string, processedTimes: any[], best3Average: KmTime): void {
    if (!this.shouldDebugHorse(horseName)) return;

    console.log(`🐎 [XANDER DEBUG] PROCESSED_TIMES_RESULT`);
    console.log(`   Horse: ${horseName} (ID: ${horseId})`);
    console.log(`   Valid processed times: ${processedTimes.length}`);
    console.log(`   Best 3 average: ${best3Average.minutes}:${best3Average.seconds.toString().padStart(2, '0')}.${best3Average.tenths}`);
    
    if (processedTimes.length > 0) {
      console.log(`   All processed times:`);
      processedTimes.forEach((time, index) => {
        console.log(`     ${index + 1}. Original: ${time.originalTime.minutes}:${time.originalTime.seconds.toString().padStart(2, '0')}.${time.originalTime.tenths} → Normalized: ${time.normalizedTime.minutes}:${time.normalizedTime.seconds.toString().padStart(2, '0')}.${time.normalizedTime.tenths} (${time.distance}m, ${time.startMethod})`);
      });
    }
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
  }

  static getDebugLogs(): HorseDebugInfo[] {
    return this.debugLogs;
  }

  static clearLogs(): void {
    this.debugLogs = [];
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