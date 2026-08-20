
import type { HorseRawKmTime } from '../types/kmTimeTypes';

export interface CachedRawTime {
  horseKey?: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  allTimes?: unknown[];
  rawKmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  bestTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  rawBestTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  bestRecordTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  validTimesCount: number;
  updatedAt: string;
  isNotifiee?: boolean;
  dataSource?: HorseRawKmTime['dataSource'];
  oldestRecordDate?: string;
  newestRecordDate?: string;
  /** Fraction of historical starts where horse broke gait (0–1). Stored for calibration. */
  gallopRate?: number;
  /** ISO date string of most recent race. Stored for layoff calculation in calibration. */
  lastRaceDate?: string;
  /** Std-dev of recent finish positions. Stored for consistency factor in calibration. */
  consistencyScore?: number;
  /** Dates of galloped races — injected as place=15 in form calculator. */
  gallopDates?: string[];
  gallopCount?: number;
  disqualificationCount?: number;
  averageOdds?: number;
  lastOdds?: number;
  horseAge?: number;
  dataSourceChain?: string;
  usedStatisticsFallback?: boolean;
  usedExtendedFallback?: boolean;
  usedInvalidTimeFallback?: boolean;
  confidenceMultiplier?: number;
  warning?: HorseRawKmTime['warning'];
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

export interface RawTimeCandidateRecord {
  date?: string;
  raceId?: string;
  kmTime?: {
    minutes?: number;
    seconds?: number;
    tenths?: number;
    code?: string;
  };
  hasNumericKmTime?: boolean;
  place?: string | number;
  finishOrder?: number;
  galloped?: boolean;
  disqualified?: boolean;
  odds?: number;
  distance?: number;
  postPosition?: number;
  startMethod?: string;
  track?: string;
  meta?: {
    source?: string;
    code?: string;
    distance?: string;
    startMethod?: string;
    year?: string;
    isLastResort?: boolean;
  };
  rawRecord?: unknown;
}

export interface RawTimeCandidateHorse {
  startNumber?: number;
  postPosition?: number;
  horseId?: number;
  horseName?: string;
  recordCount: number;
  resultRecordCount: number;
  statisticsRecordCount: number;
  bestRecordCount: number;
  numericKmTimeCount: number;
  gallopCount: number;
  disqualifiedCount: number;
  records: RawTimeCandidateRecord[];
  error?: string;
}

export interface RawTimeCandidateData {
  raceId: string;
  raceNumber?: number;
  date?: string;
  track?: string;
  startCount: number;
  unfiltered: true;
  filtersApplied: string[];
  notes: string[];
  horses: RawTimeCandidateHorse[];
}

export interface CachedRawTimeCandidates {
  date: string;
  gameId: string;
  raceId: string;
  raceNumber: number;
  candidateData: RawTimeCandidateData;
  cachedAt: string;
  schemaVersion: number;
}

export interface RaceAnalysisHorse {
  horseKey?: string;
  horseId: number;
  horseName: string;
  startNumber?: number;
  postPosition: number;
  finalScore: number;
  rank: number;
  /** Explicitly true when the displayed prediction came from a fallback estimate. */
  isEstimated?: boolean;
  predictedTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
}

export interface RaceAnalysisData {
  raceId: string;
  raceNumber: number;
  analysisDate: string;
  timestamp: string;
  horses: RaceAnalysisHorse[];
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
  /** Literal result position from ATG, retained for win/top-3 reporting. */
  actualFinishOrder: number;
  /** Result rank compressed to the eligible matched cohort. Absent on legacy cache entries. */
  eligibleActualRank?: number;
  /** Error against the result rank compressed to the eligible matched cohort. */
  rankError: number;
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
