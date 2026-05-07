
export interface CachedRawTime {
  horseKey?: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  validTimesCount: number;
  updatedAt: string;
  /** Fraction of historical starts where horse broke gait (0–1). Stored for calibration. */
  gallopRate?: number;
  /** ISO date string of most recent race. Stored for layoff calculation in calibration. */
  lastRaceDate?: string;
  /** Std-dev of recent finish positions. Stored for consistency factor in calibration. */
  consistencyScore?: number;
  /** Dates of galloped races — injected as place=15 in form calculator. */
  gallopDates?: string[];
}

export interface CachedV75RawTimes {
  date: string;
  gameId: string;
  raceId: string;
  raceNumber: number;
  rawTimes: CachedRawTime[];
  cachedAt: string;
  schemaVersion: number;
}

export interface RaceAnalysisData {
  raceId: string;
  raceNumber: number;
  analysisDate: string;
  timestamp: string;
  horses: Array<{
    horseKey?: string;
    horseId: number;
    horseName: string;
    postPosition: number;
    finalScore: number;
    rank: number;
    predictedTime?: {
      minutes: number;
      seconds: number;
      tenths: number;
    };
  }>;
}

export interface RaceAnalysisSummary {
  raceId: string;
  raceNumber: number;
  analysisDate: string;
  timestamp: string;
}

export interface HorseMAEEntry {
  horseKey?: string;
  horseId: number;
  horseName: string;
  predictedRank: number;
  actualFinishOrder: number;
  rankError: number; // |predictedRank - actualFinishOrder|
}

export interface RaceMAEResult {
  raceId: string;
  raceNumber: number;
  analysisDate: string;
  computedAt: string;
  meanRankError: number;
  horseCount: number;
  horses: HorseMAEEntry[];
}

export interface CacheInfo {
  raceIds: string[];
  totalSize: number;
  cacheEntries: Array<{
    raceId: string;
    raceNumber: number;
    date: string;
    horseCount: number;
  }>;
}
