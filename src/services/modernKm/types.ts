
import { KmTime } from '../types/kmTimeTypes';

export interface ModernKmNormalizedResult {
  rawTime: KmTime;
  modernNormalizedTime: KmTime;
  /** True when generated from a fallback estimate (no raw KM time available).
   *  Estimated results are displayed only — never stored for post-race comparison. */
  isEstimated?: boolean;
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    track: number;
    form: number;
    distance: number;
    raceDistanceAdjustment: number;
    volteStartDistancePenalty: number;
    startPoints: number;
    placePercentage: number;
    horseWinPercentage: number;
    earningsPerStart: number;
    gallopRisk: number;
    layoffPenalty: number;
    ageFactor: number;
    genderAdjustment: number;
    consistencyFactor: number;
    total: number;
  };
}

export interface ModernNormalizationFactors {
  postPosition: number;
  /** Horse's preferred/historical distance (m) — used for individual distance adjustment. */
  distance: number;
  /** Current race distance (m). */
  raceDistance: number;
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  raceTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  /** Horse's career win percentage in basis points (e.g. 434 = 4.34 %). */
  horseWinPercentage: number;
  /** Career start points (form rating). */
  startPoints: number;
  /** Place percentage in basis points (e.g. 3478 = 34.78 %). */
  placePercentage: number;
  /** Earnings per start in öre (÷100 → SEK). */
  earningsPerStart: number;
  // Optional fields for debugging
  horseId?: number;
  horseName?: string;
  // Field-aware adjustment: all start-points values in this race's field
  fieldStartPoints?: number[];
  // Recent race finish positions for form calculation
  recentRaces?: Array<{ place: number; date: string }>;
  /** Fraction of historical starts where horse broke gait (0–1). */
  gallopRisk?: number;
  /** Days since the horse last raced (any result including gallop/DQ). */
  layoffDays?: number;
  /** Horse birth year (e.g. 2019). Race year is derived from the race date. */
  horseBirthYear?: number;
  /** Race year — used together with horseBirthYear to compute age. */
  raceYear?: number;
  /** ATG sex code: 'S'=mare, 'H'=stallion, 'V'=gelding. */
  horseSex?: string;
  /** Std-dev of recent finish positions (low = consistent, high = boom-or-bust). */
  consistencyScore?: number;
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
  gallopRisk: number;
  layoffPenalty: number;
  ageFactor: number;
  genderAdjustment: number;
  consistencyFactor: number;
}

// Realistic Balanced weights (2025)
// - De-duplicates form factors (start points, place%, win%, earnings)
// - Boosts race-specific factors (driver, post position)
// - Uses saturated start points function to prevent runaway bonuses
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 0.9,          // meaningful, but not decisive alone
  shoeType: 0.4,              // equipment helps, but rarely game-breaking
  sulkyType: 0.5,
  driverPerformance: 1.0,     // kusk tabell ±0.30 s/km; 1.0 = visa exakt tabellvärde
  trackFamiliarity: 0.6,
  form: 0.5,                  // recent raw form - reduced to prevent extreme adjustments
  distanceAdjustment: 0.8,    // horse's preferred distance vs race distance
  raceDistanceAdjustment: 1.0,// global course length effect from 2140 reference
  volteStartDistancePenalty: 1.1, // standing start/extra distance hurts
  startPoints: 0.5,           // lower because function now saturates
  placePercentage: 0.6,       // avoid stacking with startPoints
  horseWinPercentage: 0.4,    // avoid stacking with place%
  earningsPerStart: 0.2,      // purse inflation & class bias → keep small
  gallopRisk: 0.5,            // penalty for horses with history of breaking gait
  layoffPenalty: 0.6,         // penalty for extended rest period (21+ days)
  ageFactor: 0.5,             // age-based adjustment (peak 5–7yo)
  genderAdjustment: 0.4,      // mare penalty in mixed-gender fields
  consistencyFactor: 0.3,     // penalty for inconsistent finish positions
};
