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
