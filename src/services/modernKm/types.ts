
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
    trainer: number;
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
  /** Trainer win percentage — same format as driverWinPercentage (0–1, 0–100, or basis points). */
  trainerWinPercentage?: number;
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
  // Field driver win rates — used for field-relative driverForm adjustment
  fieldDriverWinRates?: number[];
  /** Empirical V85/V75 win rate for this driver from our calibration dataset (0–1).
   *  More specific than ATG's career stat — absent when no calibration data exists. */
  driverEmpiricalWinRate?: number;
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
  /** Driver × horse form: win rate of current driver on this horse (recent starts). 0 = off. */
  driverForm?: number;
  /** Empirical driver win rate from calibration dataset (V85/V75-specific). 0 = off. */
  driverEmpirical?: number;
  /** Trainer win-rate adjustment weight. 0 = off. */
  trainerPerformance?: number;
}

// Balanced weights — v19 (2026-04-27) — Win 48.7%, MRR 0.631
// Post-Refresh: all signals fully trained. form 4.922, earningsPerStart 4.489, ageFactor 3.098 dominate.
// StrongHorse start won. driverEmpirical→0, layoffPenalty 0.073→1.958, raceDistance 0→3.634.
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.538,
  shoeType: 0.000,
  sulkyType: 0.827,
  driverPerformance: 1.215,
  driverForm: 0.837,
  driverEmpirical: 0.000,
  trackFamiliarity: 0.856,
  form: 4.922,
  distanceAdjustment: 2.083,
  raceDistanceAdjustment: 3.634,
  volteStartDistancePenalty: 1.882,
  startPoints: 2.355,
  placePercentage: 1.294,
  horseWinPercentage: 1.320,
  earningsPerStart: 4.489,
  gallopRisk: 2.664,
  layoffPenalty: 1.958,
  ageFactor: 3.098,
  genderAdjustment: 2.595,
  consistencyFactor: 1.542,
  trainerPerformance: 0.465,
};
