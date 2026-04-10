/**
 * Per-horse confidence and sanity flags.
 *
 * Flags do not change scores — they annotate trust so the user can decide
 * how much weight to give a prediction.
 */

import type { HorseRawKmTime } from '../../../services/types/kmTimeTypes';

export interface HorseConfidenceFlags {
  /** Fewer than 5 valid km-time samples — score rests on thin data. */
  lowSampleSize: boolean;
  /** No km time could be derived — horse is scored on a fallback estimate only. */
  noKmTime: boolean;
  /** Driver's 2025 win percentage is unavailable — driver factor defaulted. */
  noDriverStats: boolean;
  /** 2 or more gallops in the last 10 starts — reliability concern. */
  gallopRisk: boolean;
  /** Most recent race is more than 90 days ago — form data may be stale. */
  staleForm: boolean;
  /** Number of valid km-time samples (for display in the lowSampleSize label). */
  validTimesCount: number;
  /** Number of gallops in the last 10 starts (for display in the gallopRisk label). */
  gallopCount: number;
}

export const NO_FLAGS: HorseConfidenceFlags = {
  lowSampleSize: false,
  noKmTime: false,
  noDriverStats: false,
  gallopRisk: false,
  staleForm: false,
  validTimesCount: 0,
  gallopCount: 0,
};

/** True when at least one flag is raised. */
export function hasAnyFlag(flags: HorseConfidenceFlags): boolean {
  return flags.lowSampleSize || flags.noKmTime || flags.noDriverStats || flags.gallopRisk || flags.staleForm;
}

/**
 * Compute a 1–5 reliability score for a horse prediction.
 *
 * 5 = fully reliable — normalized time, clean data, no concerns.
 * 1 = very unreliable — no usable time or severe data gaps.
 *
 * Score is an annotation only — it does not affect the km-time ranking.
 * It tells the user how much to trust the predicted time for this horse.
 *
 * Deduction table:
 *   timeSource === 'none'          : -3   (no usable time at all)
 *   uncertain (best-raw fallback)  : -1   (not fully normalised)
 *   historySource === 'abroad'     : -1   (foreign-track data)
 *   confidenceMultiplier < 0.5    : -0.5 (very thin raw-data quality)
 *   gallopRisk flag                : -0.5 (reliability concern)
 *   staleForm flag                 : -0.5 (90+ days since last race)
 *   lowSampleSize flag             : -0.5 (< 5 valid km-time samples)
 *   noDriverStats flag             : -0.5 (driver factor defaulted)
 *
 * Result is floored and clamped to [1, 5].
 */
export function computeReliabilityScore(
  flags: HorseConfidenceFlags | undefined,
  timeSource: string | undefined,
  uncertain: boolean | undefined,
  historySource: string | undefined,
  confidenceMultiplier: number | undefined,
): number {
  let score = 5.0;

  // Primary: is there a usable, normalised time?
  if (timeSource === 'none') {
    score -= 3; // No time at all — fallback guess only
  } else if (uncertain) {
    score -= 1; // Using raw best-time fallback, not fully normalised
  }

  // History origin: foreign-track data is less reliable for Swedish V75 conditions
  if (historySource === 'abroad') score -= 1;

  // Very low confidence multiplier indicates poor raw-data quality
  if (confidenceMultiplier !== undefined && confidenceMultiplier < 0.5) score -= 0.5;

  // Per-horse sanity flags (independent of time source)
  if (flags?.gallopRisk) score -= 0.5;
  if (flags?.staleForm) score -= 0.5;
  if (flags?.lowSampleSize) score -= 0.5;
  if (flags?.noDriverStats) score -= 0.5;

  return Math.max(1, Math.min(5, Math.floor(score)));
}

const STALE_FORM_DAYS = 90;
const GALLOP_RISK_THRESHOLD = 2; // out of the last 10 starts
const LOW_SAMPLE_THRESHOLD = 5;

function isZeroTime(t: { minutes: number; seconds: number; tenths: number } | undefined | null): boolean {
  if (!t) return true;
  return t.minutes === 0 && t.seconds === 0 && t.tenths === 0;
}

/**
 * Derive confidence flags from the data available at scoring time.
 *
 * @param rawTimeData  The processed km-time record for this horse (may be undefined).
 * @param rawKmTime    The best km-time passed into normalization (the un-penalised time).
 * @param driver2025WinPct  Driver's 2025 win percentage from the ATG horse entry.
 * @param today        Date to measure stale-form against (injectable for testing).
 */
export function computeConfidenceFlags(
  rawTimeData: HorseRawKmTime | undefined,
  rawKmTime: { minutes: number; seconds: number; tenths: number } | undefined | null,
  driver2025WinPct: number | undefined | null,
  today: Date = new Date()
): HorseConfidenceFlags {
  // No km time: raw time is missing or zero
  const noKmTime = !rawKmTime || isZeroTime(rawKmTime);

  // Low sample size: we have some time data but very few valid samples
  const validTimesCount = rawTimeData?.validTimesCount ?? 0;
  const lowSampleSize = !noKmTime && validTimesCount < LOW_SAMPLE_THRESHOLD;

  // No driver stats: win percentage is absent
  const noDriverStats = driver2025WinPct === undefined || driver2025WinPct === null || driver2025WinPct === 0;

  // Gallop risk: 2+ gallops in last 10 starts
  const gallopCount = rawTimeData?.gallopCount ?? 0;
  const gallopRisk = gallopCount >= GALLOP_RISK_THRESHOLD;

  // Stale form: newest race date is more than 90 days before today
  let staleForm = false;
  const newestRecordDate = rawTimeData?.newestRecordDate;
  if (newestRecordDate) {
    const diffMs = today.getTime() - new Date(newestRecordDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    staleForm = diffDays > STALE_FORM_DAYS;
  }

  return { lowSampleSize, noKmTime, noDriverStats, gallopRisk, staleForm, validTimesCount, gallopCount };
}
