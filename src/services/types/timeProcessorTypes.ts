
import { KmTime, ProcessedKmTime, HorseRawKmTime } from './kmTimeTypes';

// Legacy interfaces for backward compatibility
export interface ProcessedTime {
  originalTime: number; // in seconds
  normalizedTime: number; // normalized using simplified formula
  raceDate: string;
  distance: number;
  startMethod: string;
  finishOrder?: number;
  valid: boolean;
}

export interface HorseRawTime {
  horseId: number;
  horseName: string;
  allTimes: ProcessedTime[];
  best3Average: number;
  validTimesCount: number;
}

// Re-export new KM time types
export type { KmTime, ProcessedKmTime, HorseRawKmTime };
