
import { KmTime } from '../types/kmTimeTypes';

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
    volteStartDistancePenalty: number;
    startPoints: number;
    placePercentage: number;
    horseWinPercentage: number;
    earningsPerStart: number;
    total: number;
  };
}

export interface ModernNormalizationFactors {
  postPosition: number;
  distance: number;
  raceDistance: number;
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  raceTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  horseForm: number;
  startPoints: number;
  placePercentage: number;
  // Optional fields for debugging
  horseId?: number;
  horseName?: string;
  horseWinPercentage: number;
  earningsPerStart: number;
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverPerformance: number;
  trackFamiliarity: number;
  form: number;
  distanceAdjustment: number;
  raceDistanceAdjustment: number;
  volteStartDistancePenalty: number;
  startPoints: number;
  placePercentage: number;
  horseWinPercentage: number;
  earningsPerStart: number;
}

export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.0,
  shoeType: 0.8,
  sulkyType: 0.6,
  driverPerformance: 2.0,
  trackFamiliarity: 1.0,
  form: 1.2,
  distanceAdjustment: 1.0,
  raceDistanceAdjustment: 1.0,
  volteStartDistancePenalty: 1.0,
  startPoints: 0.4,
  placePercentage: 0.9,
  horseWinPercentage: 0.3,
  earningsPerStart: 0.2
};
