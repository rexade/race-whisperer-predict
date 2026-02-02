
export interface CachedRawTime {
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
