
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
  // Recent race finish positions for form calculation.
  // postPosition is preserved for optional trip-dependency experiments.
  recentRaces?: Array<{ place: number; date: string; postPosition?: number }>;
  /** Opt-in model experiment: reduce volte back-marker penalty for proven outside-trip horses. */
  enableTripDependencyModifier?: boolean;
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

// V37 default (2026-05-08) — promoted after post-fix latest 6mo calibration.
// Local reproduction on calibration-dataset-6mo_latest.json:
// Win 45.1%, WTop3 67.4%, WTop5 80.6%, TopPickTop3 49.2%, MRR 0.605 over 304 races.
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.108,
  shoeType: 0.000,
  sulkyType: 0.000,
  driverPerformance: 1.433,
  driverForm: 0.000,
  driverEmpirical: 4.057,
  trackFamiliarity: 0.150,
  form: 2.364,
  distanceAdjustment: 0.000,
  raceDistanceAdjustment: 1.568,
  volteStartDistancePenalty: 1.260,
  startPoints: 1.661,
  placePercentage: 0.919,
  horseWinPercentage: 1.579,
  earningsPerStart: 1.489,
  gallopRisk: 0.000,
  layoffPenalty: 1.166,
  ageFactor: 0.000,
  genderAdjustment: 0.758,
  consistencyFactor: 2.240,
  trainerPerformance: 2.059,
  oddsHistorical: 0.134,
  oddsLive: 0.000,
};
