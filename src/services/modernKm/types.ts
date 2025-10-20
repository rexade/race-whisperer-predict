
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

// Realistic Balanced weights (2025)
// - De-duplicates form factors (start points, place%, win%, earnings)
// - Boosts race-specific factors (driver, post position)
// - Uses saturated start points function to prevent runaway bonuses
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 0.9,          // meaningful, but not decisive alone
  shoeType: 0.4,              // equipment helps, but rarely game-breaking
  sulkyType: 0.5,
  driverPerformance: 1.4,     // driver matters, especially in starts/trips
  trackFamiliarity: 0.6,
  form: 1.0,                  // recent raw form (but keep moderate)
  distanceAdjustment: 0.8,    // horse's preferred distance vs race distance
  raceDistanceAdjustment: 1.0,// global course length effect from 2140 reference
  volteStartDistancePenalty: 1.1, // standing start/extra distance hurts
  startPoints: 0.5,           // lower because function now saturates
  placePercentage: 0.6,       // avoid stacking with startPoints
  horseWinPercentage: 0.4,    // avoid stacking with place%
  earningsPerStart: 0.2       // purse inflation & class bias → keep small
};
