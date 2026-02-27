/**
 * Single source of truth for every tunable constant in the normalization pipeline.
 *
 * Using `as const` so TypeScript infers the narrowest literal types and all
 * values are readonly — callers cannot accidentally mutate them.
 *
 * Each group is documented with its calibration rationale so values can be
 * revisited without hunting across multiple files.
 */

// ---------------------------------------------------------------------------
// Distance normalization
// ---------------------------------------------------------------------------

/** Reference distance (m). Raw KM times are always normalised to this value
 *  in horseProcessing (normalizeKmTimeSimplified). The modern engine only
 *  adjusts FROM this reference TO the current race distance. */
export const REFERENCE_DISTANCE_M = 2140 as const;

/** If the current race distance is within this many metres of the reference,
 *  the race-distance adjustment is 0 (raw time is already at reference). */
export const RACE_DISTANCE_TOLERANCE_M = 10 as const;

/** Seconds per 1 000 m when the race is SHORTER than the reference.
 *  Shorter races produce faster per-km times, so we subtract time. */
export const SHORTER_DISTANCE_RATE_S_PER_KM = 3.2 as const;

/** Seconds per 1 000 m when the race is LONGER than the reference.
 *  Longer races produce slightly slower per-km times. */
export const LONGER_DISTANCE_RATE_S_PER_KM = 2.0 as const;

// ---------------------------------------------------------------------------
// Volte (standing-start) normalization
// ---------------------------------------------------------------------------

/** Time subtracted when normalising a HISTORICAL volte-start race to the
 *  2 140 m auto reference (volte starts produce intrinsically faster km
 *  times because the horse is already moving).  Applied ONLY in
 *  normalizeKmTimeForHistory — never repeated in the modern engine. */
export const VOLTE_HISTORICAL_ADVANTAGE_S = 1.0 as const;

/** Penalty added in the modern engine when a horse started from a longer
 *  distance in a volte race (back-marker position). */
export const VOLTE_BACK_MARKER_PENALTY_S = 0.4 as const;

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/** Time bonus for each barefoot shoe position (front or back).
 *  Applied independently; combined barefoot → -0.2 s total. */
export const BAREFOOT_SHOE_ADJ_S = -0.1 as const;

/** Advantage of an American-style sulky over the baseline Vanlig/Standard. */
export const AMERICAN_SULKY_ADJ_S = -0.2 as const;

// ---------------------------------------------------------------------------
// Driver performance
// ---------------------------------------------------------------------------

/** Win-percentage level at which the driver adjustment is exactly 0 s. */
export const DRIVER_BASELINE_WIN_PCT = 0.12 as const;   // 12 %

/** tanh scale factor: controls how quickly the curve saturates.
 *  Higher = softer curve (3 % gap = ~0.09 s, not ~0.15 s). */
export const DRIVER_SCALE = 0.10 as const;

/** Absolute cap on the driver adjustment (±0.30 s/km). */
export const DRIVER_CAP_S = 0.30 as const;

// ---------------------------------------------------------------------------
// Track familiarity
// ---------------------------------------------------------------------------

/** Time bonus applied when the horse races at its registered home track. */
export const HOME_TRACK_ADJ_S = -0.15 as const;

// ---------------------------------------------------------------------------
// Start-points (form rating)
// ---------------------------------------------------------------------------

/** Field-neutral start-points level (no adjustment). */
export const START_POINTS_BASELINE = 1_200 as const;

/** Log-scale tightness for the tanh saturation function.
 *  Lower → steeper curve; higher → flatter. */
export const START_POINTS_ALPHA = 0.60 as const;

/** Maximum adjustment from the non-field-aware calculator (before weight). */
export const START_POINTS_MAX_IMPACT_S = 0.60 as const;

/** Maximum adjustment from the field-aware calculator (before weight). */
export const START_POINTS_FIELD_AWARE_MAX_IMPACT_S = 0.25 as const;

/** IQR scaling factor for the field-aware calculator. */
export const START_POINTS_FIELD_AWARE_BETA = 2.0 as const;

/** Minimum field size required to use field-aware mode. */
export const START_POINTS_FIELD_MIN_SIZE = 3 as const;

/** Hard cap applied to the FINAL WEIGHTED start-points adjustment. */
export const START_POINTS_FINAL_CAP_S = 0.30 as const;

// ---------------------------------------------------------------------------
// Place-percentage baseline
// ---------------------------------------------------------------------------

/** Place-rate at which the adjustment is 0 (50 % = neutral). */
export const PLACE_PCT_BASELINE = 50 as const;     // percent

/** Seconds of adjustment per 1 percentage-point deviation from baseline. */
export const PLACE_PCT_SCALE_S = 0.001 as const;

// ---------------------------------------------------------------------------
// Horse win-percentage baseline
// ---------------------------------------------------------------------------

/** Win-rate at which the adjustment is 0. */
export const WIN_PCT_BASELINE = 15 as const;       // percent

/** Seconds of adjustment per 1 percentage-point deviation from baseline. */
export const WIN_PCT_SCALE_S = 0.015 as const;

// ---------------------------------------------------------------------------
// Earnings-per-start baseline
// ---------------------------------------------------------------------------

/** Earnings level (SEK/start) at which the adjustment is 0. */
export const EARNINGS_BASELINE_SEK = 3_000 as const;

/** Seconds per 1 SEK deviation from baseline. */
export const EARNINGS_SCALE_S = 0.00001 as const;

/** Hard cap on the earnings bonus to prevent purse-inflation bias. */
export const EARNINGS_MAX_BONUS_S = -0.2 as const;

// ---------------------------------------------------------------------------
// Recent-form calculation
// ---------------------------------------------------------------------------

/** Form-score assigned to a race win. */
export const FORM_SCORE_WIN = -1.0 as const;
/** Form-score for a 2nd or 3rd place. */
export const FORM_SCORE_PLACE = -0.5 as const;
/** Form-score for 4th or 5th. */
export const FORM_SCORE_GOOD = -0.2 as const;
/** Form-score for 6th–10th. */
export const FORM_SCORE_MID = 0.3 as const;
/** Form-score for 11th or worse. */
export const FORM_SCORE_POOR = 0.6 as const;

/** Scale factor converting weighted form score to seconds. */
export const FORM_SCALE_S = 0.05 as const;

/** Maximum number of recent races considered in the form calculation. */
export const FORM_MAX_RECENT_RACES = 8 as const;

/** Win-percentage baseline used when no recent-race results are available. */
export const FORM_FALLBACK_BASELINE_PCT = 10 as const;

/** Seconds per percentage-point deviation in the win-% form fallback. */
export const FORM_FALLBACK_SCALE_S = 0.01 as const;

// ---------------------------------------------------------------------------
// Outlier detection
// ---------------------------------------------------------------------------

/** Minimum plausible km time (seconds/km).  Below this → suspiciously fast. */
export const KM_MIN_SECONDS = 67 as const;   // 1:07.0 / km

/** Maximum plausible km time (seconds/km).  Above this → suspiciously slow. */
export const KM_MAX_SECONDS = 125 as const;  // 2:05.0 / km

// ---------------------------------------------------------------------------
// Data confidence
// ---------------------------------------------------------------------------

/** Multiplier applied to times sourced from statistics records (not results).
 *  Values < 1 penalise uncertain data so estimated times rank lower. */
export const STATISTICS_CONFIDENCE_MULTIPLIER = 0.7 as const;
