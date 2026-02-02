
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
  valid: boolean;
}

export interface HorseRawKmTime {
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
  usedExtendedFallback?: boolean;
  usedInvalidTimeFallback?: boolean;
  warning?: {
    type: 'invalid-record';
    message: string;
    reason: string;
  };
}

export interface ModernKmNormalizedResult {
  rawTime: KmTime;
  modernNormalizedTime: KmTime;
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    track: number;
    form: number;
    distance: number;
    raceDistanceAdjustment: number;
    raceType: number;
    timeOfDay: number;
    startPoints: number;
    placePercentage: number;
    horseWinPercentage: number;
    earningsPerStart: number;
    total: number;
  };
}
