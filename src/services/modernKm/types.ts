
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
    oddsHistorical: number;
    oddsLive: number;
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
  /** Mean historical odds across recent starts (lower = market thinks better). */
  averageOdds?: number;
  /** Live/current odds from the win pool (when available). */
  liveOdds?: number;
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
  /** Historical odds signal weight. Lower odds = expected faster. 0 = off. */
  oddsHistorical?: number;
  /** Live odds signal weight. 0 = off. */
  oddsLive?: number;
}

// Balanced weights — v22 (2026-04-27) — Train 38.2%, TEST 31.6% (truth), MRR 0.558
// First L2-regularized result. 6-month data, held-out 1-month test set.
// V23 (2026-04-27) — 5-fold CV optimized, multi-start. CV-Win 34.6%, Full-Win 34.7%, MRR 0.516.
// form dominates (5.0), clean signals only. No overfitting (CV-Full gap 0.1pp).
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.500,
  shoeType: 0.000,
  sulkyType: 0.500,
  driverPerformance: 2.200,
  driverForm: 0.000,
  driverEmpirical: 0.000,
  trackFamiliarity: 0.000,
  form: 5.000,
  distanceAdjustment: 1.000,
  raceDistanceAdjustment: 1.500,
  volteStartDistancePenalty: 2.200,
  startPoints: 2.500,
  placePercentage: 0.400,
  horseWinPercentage: 1.000,
  earningsPerStart: 1.300,
  gallopRisk: 0.000,
  layoffPenalty: 1.900,
  ageFactor: 0.000,
  genderAdjustment: 0.900,
  consistencyFactor: 2.000,
  trainerPerformance: 1.500,
  oddsHistorical: 0.000,
  oddsLive: 0.000,
};
