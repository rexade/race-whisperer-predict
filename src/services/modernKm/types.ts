
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
  /** Trainer win-rate adjustment weight. 0 = off. */
  trainerPerformance?: number;
}

// Balanced weights — v10 (2026-04-27) — Win 40.0%, MRR 0.556
// Multi-start from V9: trackFamiliarity↑0.1 (first non-zero), distanceAdjustment↓0.8,
// raceDistanceAdjustment↓1.1, genderAdjustment↓0.3. Human signals still dominant.
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 0.900,
  shoeType: 0.275,
  sulkyType: 0.500,
  driverPerformance: 3.000,
  driverForm: 5.000,
  trackFamiliarity: 0.100,
  form: 0.900,
  distanceAdjustment: 0.800,
  raceDistanceAdjustment: 1.100,
  volteStartDistancePenalty: 1.400,
  startPoints: 0.500,
  placePercentage: 0.600,
  horseWinPercentage: 0.200,
  earningsPerStart: 0.100,
  gallopRisk: 0.500,
  layoffPenalty: 0.600,
  ageFactor: 0.500,
  genderAdjustment: 0.300,
  consistencyFactor: 0.500,
  trainerPerformance: 3.000,
};
