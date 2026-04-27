
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

// Balanced weights — v3 (2026-04-26)
// Key changes vs v2:
//   form 0.8→1.0       — form is the strongest per-race signal; boost to full weight
//   postPosition 0.9→0.7 — post position influence capped; strong form should dominate
// MAE eval (48 races, 6 dates, Jan–Apr 2026): V3=2.653, V2=2.690, V1=2.716
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 0.7,          // meaningful, but capped — form should dominate
  shoeType: 0.4,              // equipment helps, but rarely game-breaking
  sulkyType: 0.5,
  driverPerformance: 1.0,     // kusk tabell ±0.30 s/km; 1.0 = visa exakt tabellvärde
  trackFamiliarity: 0.6,
  form: 1.0,                  // recent form — primary current-condition signal
  distanceAdjustment: 0.8,    // horse's preferred distance vs race distance
  raceDistanceAdjustment: 1.0,// global course length effect from 2140 reference
  volteStartDistancePenalty: 1.1, // standing start/extra distance hurts
  startPoints: 0.5,           // saturated log-scale; kept moderate
  placePercentage: 0.6,       // avoid stacking with startPoints
  horseWinPercentage: 0.2,    // overlap with place% and startPoints — reduced
  earningsPerStart: 0.1,      // class/purse inflation bias — minimal
  gallopRisk: 0.5,            // penalty for horses with history of breaking gait
  layoffPenalty: 0.6,         // penalty for extended rest period (14+ days)
  ageFactor: 0.5,             // age-based adjustment (peak 5–7yo)
  genderAdjustment: 0.4,      // mare penalty in mixed-gender fields
  consistencyFactor: 0.5,     // consistent finishers rank more predictably
  driverForm: 0.8,            // driver recent form trend (last 20 starts)
  trainerPerformance: 0.7,   // trainer win-rate adjustment (±0.20 s/km max)
};
