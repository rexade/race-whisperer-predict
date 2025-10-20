
export type TimeSource = "normalized" | "best_raw" | "abroad" | "field_median" | "none";

export interface V75HorseResult {
  raceNumber: number;
  raceId: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: any;
  modernNormalizedResult?: any;
  bestRecordTime?: any;
  driverName: string;
  track: string;
  distance: number;
  startMethod: string;
  statistics?: {
    startPoints: number;
    placePercentage: number;
    winPercentage: number;
    earningsPerStart: number;
  };
  driver2025WinPercentage?: number;
  sulkyType?: string;
  shoesFront?: boolean;
  shoesBack?: boolean;
  homeTrack?: string;
  finalScore?: number;
  rank?: number;
  isNotifiee?: boolean;
  dataSource?: 'recent' | 'fallback';
  oldestRecordDate?: string;
  newestRecordDate?: string;
  // Confidence tracking
  hasLocalHistory?: boolean;
  hasAnyHistory?: boolean;
  confidence?: number;
  historySource?: "local" | "abroad" | "none";
  // Prediction provenance
  timeSource?: TimeSource;
  uncertain?: boolean;
  uncertaintyReason?: "no_valid_samples" | "best_only" | "abroad_only" | "other";
  // Invalid-time fallback warning
  warning?: {
    type: 'invalid-record';
    message: string;
    reason: string;
  };
}

export interface V75RaceResult {
  raceNumber: number;
  raceId: string;
  track: string;
  distance: number;
  startMethod: string;
  name: string;
  prize: number;
  date?: string;
  horses: V75HorseResult[];
  analysisComplete: boolean;
  dataQuality?: {
    hasValidPostPositions: boolean;
    duplicatePositions: number[];
    missingData: number[];
  };
}
