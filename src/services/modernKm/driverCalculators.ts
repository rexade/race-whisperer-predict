import {
  DRIVER_BASELINE_WIN_PCT,
  DRIVER_SCALE,
  DRIVER_CAP_S,
  TRAINER_BASELINE_WIN_PCT,
  TRAINER_SCALE,
  TRAINER_CAP_S,
} from './normalizationConstants';
import { log } from '@/lib/logger';

/**
 * Driver win-rate → time adjustment (seconds/km).
 *
 * Uses a tanh-saturated curve so extreme win percentages don't produce
 * unrealistic bonuses.  Range: ±DRIVER_CAP_S.
 *
 *   x          = (winPctFraction − baseline) / scale
 *   adjustment = −cap × tanh(x)
 *
 * Examples (baseline 12 %, scale 0.10):
 *   9 %  → +0.09 s  (slower — below-average driver)
 *  12 %  →  0.00 s  (neutral)
 *  15 %  → −0.09 s  (faster — above-average driver)
 *  25 %+ → ≈ −0.30 s (capped)
 *
 * @param winPercentage  Driver win rate — accepts 0–1, 0–100, or basis-point
 *                       (0–10 000) format; normalised internally.
 */
export const calculateDriverAdjustment = (winPercentage: number): number => {
  const wpRaw = Number.isFinite(winPercentage) ? winPercentage : 0;

  // Normalise to 0–1 fraction regardless of input format
  let wpFraction: number;
  if (wpRaw > 1 && wpRaw <= 100) {
    wpFraction = wpRaw / 100;
  } else if (wpRaw > 100) {
    wpFraction = wpRaw / 10_000;
  } else {
    wpFraction = Math.max(0, Math.min(1, wpRaw));
  }

  const x = (wpFraction - DRIVER_BASELINE_WIN_PCT) / DRIVER_SCALE;
  const adjustment = -DRIVER_CAP_S * Math.tanh(x);

  log.debug(`[driver] ${(wpFraction * 100).toFixed(1)}% → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Trainer win-rate → time adjustment (seconds/km).
 *
 * Same tanh-saturated curve as driver but capped at ±TRAINER_CAP_S (0.20 s)
 * since trainer influence is real but smaller than direct driver skill.
 *
 *   Baseline 12 % → 0 s
 *   Below 12 %    → slower (positive)
 *   Above 12 %    → faster (negative)
 *
 * @param winPercentage  Trainer win rate — accepts 0–1, 0–100, or basis-point format.
 */
/**
 * Driver form — field-relative driver signal.
 *
 * Compares THIS driver's win rate to the distribution of all drivers in the
 * same race (median + IQR).  Unlike calculateDriverAdjustment which compares
 * against a fixed 12% global baseline, this captures "top driver in THIS race"
 * — a 15% win-rate driver facing a field of 10% drivers is a much bigger edge
 * than facing a field of 18% drivers.
 *
 * Uses the same tanh/IQR approach as the field-aware start-points calculator.
 * Returns 0 if fewer than 3 valid field rates are available.
 *
 * @param driverWinRate      This driver's win percentage (0–1, 0–100, or bp).
 * @param fieldDriverWinRates All drivers' win rates in the race (same format).
 * @param cap                 Maximum raw adjustment magnitude (default = DRIVER_CAP_S).
 */
export const calculateDriverFormAdjustment = (
  driverWinRate: number,
  fieldDriverWinRates: number[],
  cap: number = DRIVER_CAP_S
): number => {
  const norm = (r: number): number => {
    if (!Number.isFinite(r) || r < 0) return 0;
    if (r > 100) return r / 10_000;
    if (r > 1)   return r / 100;
    return r;
  };

  const driverRate = norm(driverWinRate);
  const rates = fieldDriverWinRates.map(norm).filter(r => Number.isFinite(r) && r >= 0).sort((a, b) => a - b);
  if (rates.length < 3) return 0;

  const q = (p: number): number => {
    const idx = (rates.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return (1 - (idx - lo)) * rates[lo] + (idx - lo) * rates[hi];
  };
  const median = q(0.5);
  const iqr    = Math.max(0.02, q(0.75) - q(0.25));

  const x = (driverRate - median) / iqr;
  const adjustment = -cap * Math.tanh(x);

  log.debug(`[driverForm] ${(driverRate * 100).toFixed(1)}% vs field median ${(median * 100).toFixed(1)}% (IQR ${(iqr * 100).toFixed(1)}%) → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};

export const calculateTrainerAdjustment = (winPercentage: number): number => {
  const wpRaw = Number.isFinite(winPercentage) ? winPercentage : 0;

  let wpFraction: number;
  if (wpRaw > 1 && wpRaw <= 100) {
    wpFraction = wpRaw / 100;
  } else if (wpRaw > 100) {
    wpFraction = wpRaw / 10_000;
  } else {
    wpFraction = Math.max(0, Math.min(1, wpRaw));
  }

  const x = (wpFraction - TRAINER_BASELINE_WIN_PCT) / TRAINER_SCALE;
  const adjustment = -TRAINER_CAP_S * Math.tanh(x);

  log.debug(`[trainer] ${(wpFraction * 100).toFixed(1)}% → ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s`);
  return adjustment;
};
