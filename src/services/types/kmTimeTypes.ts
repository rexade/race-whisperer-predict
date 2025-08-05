
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
  best3Average: KmTime;
  bestRecordTime: KmTime;
  validTimesCount: number;
  isNotifiee?: boolean;
  dataSource?: 'recent' | 'fallback';
  oldestRecordDate?: string;
  newestRecordDate?: string;
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
