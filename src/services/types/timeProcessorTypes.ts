
import { ATGHistoricalRace } from '../atgApi';

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
