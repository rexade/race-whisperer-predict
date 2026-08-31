
import { KmTime } from '../types/kmTimeTypes';

export interface ModernKmNormalizedResult {
  rawTime: KmTime;
  modernNormalizedTime: KmTime;
  /** Exact weight-independent inputs used for this prediction.
   * Persisting these keeps interactive reanalysis identical to the initial run. */
  normalizationFactors?: ModernNormalizationFactors;
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
    betDistribution: number;
    shoeChange: number;
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
  /** Game-type bet distribution (spelprocent, e.g. 24.32 = 24.32 % of bets). */
  betDistribution?: number;
  /** ATG native flag: front shoe state differs from the horse's previous start. */
  shoesFrontChanged?: boolean;
  /** ATG native flag: back shoe state differs from the horse's previous start. */
  shoesBackChanged?: boolean;
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
  /** Bet-distribution (spelprocent) signal weight — implied odds through the same curve. 0 = off. */
  betDistribution?: number;
  /** Shoe-change signal weight: switch to barefoot = intent to go fast. 0 = off. */
  shoeChange?: number;
}

/**
 * Forward-selected on 2163 training races and read once on a 604-race holdout it
 * never saw: MRR 0.5829 / win 39.1%, against 0.5578 for V42 and 0.5741 for the
 * market favourite. Best measured configuration in the repo.
 *
 * Read the shape before changing it. oddsLive and betDistribution are both at
 * the search ceiling because the market carries most of the signal, and
 * postPosition is 0 not because the gate stops mattering but because the odds
 * already price it -- a refit without market access revives it at 1.0. The
 * +2.2pp over the market is one race in 604 by McNemar (z = 1.57): this is the
 * best available configuration, not a demonstrated edge.
 *
 * trainerPerformance stays 0 -- see the note below.
 */
export const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 0.000,
  shoeType: 1.500,
  sulkyType: 2.000,
  driverPerformance: 0.250,
  driverForm: 0.000,
  driverEmpirical: 3.000,
  trackFamiliarity: 3.000,
  form: 2.000,
  distanceAdjustment: 3.000,
  raceDistanceAdjustment: 1.556,
  volteStartDistancePenalty: 3.000,
  startPoints: 0.000,
  placePercentage: 0.000,
  horseWinPercentage: 2.000,
  earningsPerStart: 0.000,
  gallopRisk: 0.000,
  layoffPenalty: 2.000,
  ageFactor: 0.000,
  genderAdjustment: 0.500,
  consistencyFactor: 1.000,
  // 0 until refitted, not because trainers do not matter. extractHorseData read
  // start.trainer, which ATG never populates, so this factor returned 0 on every
  // race and 2.059 was fitted against zeros -- an arbitrary number. The path is
  // fixed now; re-collect with trainer data and refit before raising it.
  trainerPerformance: 0.000,
  oddsHistorical: 0.000,
  oddsLive: 5.000,
  betDistribution: 5.000,
  shoeChange: 3.000,
};
