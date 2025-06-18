
import { KmTime } from '../types/kmTimeTypes';

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

export interface ModernNormalizationFactors {
  postPosition: number;
  distance: number;
  raceDistance: number;
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  driverWinPercentage2025: number;
  horseForm: number;
  raceType?: string;
  timeOfDay?: string;
  startPoints: number;
  placePercentage: number;
  horseWinPercentage: number;
  earningsPerStart: number;
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverExperience: number;
  driver2025Performance: number;
  trackFamiliarity: number;
  form: number;
  distanceAdjustment: number;
  raceDistanceAdjustment: number;
  raceType: number;
  timeOfDay: number;
  startPoints: number;
  placePercentage: number;
  horseWinPercentage: number;
  earningsPerStart: number;
}

export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.0,
  shoeType: 0.8,
  sulkyType: 0.6,
  driverExperience: 0.9,
  driver2025Performance: 1.1,
  trackFamiliarity: 0.7,
  form: 1.2,
  distanceAdjustment: 1.0,
  raceDistanceAdjustment: 1.0,
  raceType: 0.9,
  timeOfDay: 0.5,
  startPoints: 0.8,
  placePercentage: 0.9,
  horseWinPercentage: 1.0,
  earningsPerStart: 0.7
};
