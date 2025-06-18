
export interface V75HorseResult {
  raceNumber: number;
  raceId: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: any;
  modernNormalizedResult?: any;
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
