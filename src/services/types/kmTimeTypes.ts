
export interface KmTime {
  minutes: number;
  seconds: number;
  tenths: number;
}

export interface ProcessedKmTime {
  originalTime: KmTime;
  normalizedTime: KmTime;
  raceDate: string;
  distance: number;
  startMethod: string;
  finishOrder?: number;
  postPosition?: number;
  valid: boolean;
}

export interface HorseRawKmTime {
  horseKey?: string;
  horseId: number;
  horseName: string;
  allTimes: ProcessedKmTime[];
  bestTime: KmTime; // After confidence penalty (used for ranking)
  rawBestTime?: KmTime; // Before confidence penalty (for transparency)
  bestRecordTime: KmTime;
  validTimesCount: number;
  isNotifiee?: boolean;
  dataSource?: 'recent' | 'fallback';
  oldestRecordDate?: string;
  newestRecordDate?: string;
  confidenceMultiplier?: number;
  usedStatisticsFallback?: boolean;
  /** Fraction of historical starts where the horse broke gait (galloped).
   *  0 = never galloped; 0.25 = galloped in 1 of 4 races. */
  gallopRate?: number;
  /** Date string (YYYY-MM-DD) of the horse's most recent race (including
   *  galloped/DQ races).  Used to compute layoff days relative to race date. */
  lastRaceDate?: string;
  /** Standard deviation of the horse's last 3–8 finish positions.
   *  Low = consistent, high = boom-or-bust.  Null when < 3 races available. */
  consistencyScore?: number;
  usedExtendedFallback?: boolean;
  usedInvalidTimeFallback?: boolean;
  /** Number of gallop (stride-break) races in the last 10 historical starts. */
  gallopCount?: number;
  /** Dates (YYYY-MM-DD) of galloped races in the last 10 historical starts.
   *  Injected into the form calculator so that a galloped last race is penalised,
   *  not silently ignored. */
  gallopDates?: string[];
  /** Number of disqualified races in the last 10 historical starts. */
  disqualificationCount?: number;
  /** Mean historical odds across recent starts (market strength signal). */
  averageOdds?: number;
  /** Most recent race odds. */
  lastOdds?: number;
  /** Direct age from API (more reliable than birthYear which is often 0). */
  horseAge?: number;
  /** Logs which data sources were attempted and which provided data.
   *  e.g. "records(39)→used" or "records(0)→stats(2)→used" */
  dataSourceChain?: string;
  warning?: {
    type: 'invalid-record';
    message: string;
    reason: string;
  };
}
