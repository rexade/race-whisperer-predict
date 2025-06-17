
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
  validTimesCount: number;
}

export interface ModernKmNormalizedResult {
  rawTime: KmTime;
  modernNormalizedTime: KmTime;
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    driver2025: number;
    track: number;
    form: number;
    distance: number;
    raceType: number;
    timeOfDay: number;
    total: number;
  };
}
