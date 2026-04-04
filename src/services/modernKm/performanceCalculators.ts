import {
  START_POINTS_BASELINE,
  START_POINTS_ALPHA,
  START_POINTS_MAX_IMPACT_S,
  START_POINTS_FIELD_AWARE_BETA,
  START_POINTS_FIELD_AWARE_MAX_IMPACT_S,
  PLACE_PCT_BASELINE,
  PLACE_PCT_SCALE_S,
  WIN_PCT_BASELINE,
  WIN_PCT_SCALE_S,
  EARNINGS_BASELINE_SEK,
  EARNINGS_SCALE_S,
  FORM_SCORE_WIN,
  FORM_SCORE_PLACE,
  FORM_SCORE_GOOD,
  FORM_SCORE_MID,
  FORM_SCORE_POOR,
  FORM_SCALE_S,
  FORM_MAX_RECENT_RACES,
  FORM_FALLBACK_BASELINE_PCT,
  FORM_FALLBACK_SCALE_S,
  GALLOP_RISK_MAX_S,
  GALLOP_RISK_SCALE,
} from './normalizationConstants';
import { log } from '@/lib/logger';

/**
 * Start-points → time adjustment (seconds).
 *
 * Log-scale + tanh saturation prevents runaway bonuses for very high
 * start-points values.  Negative adjustment = faster (bonus).
 *
 *   delta = log1p(startPoints) − log1p(baseline)
 *   adj   = −maxImpact × tanh(delta / alpha)
 *
 * Examples (defaults — baseline 1 200, alpha 0.60, cap 0.60):
 *    900 pts → +0.267 s (penalty)
 *  1 200 pts →  0.000 s (neutral)
 *  2 000 pts → −0.415 s (bonus)
 *  5 000 pts → ≈ −0.590 s
 * 16 000 pts → ≈ −0.600 s (capped)
 */
export const calculateStartPointsAdjustment = (
  startPoints: number,
  opts?: { baseline?: number; alpha?: number; maxImpact?: number }
): number => {
  if (!Number.isFinite(startPoints) || startPoints <= 0) return 0;

  const baseline  = opts?.baseline  ?? START_POINTS_BASELINE;
  const alpha     = opts?.alpha     ?? START_POINTS_ALPHA;
  const maxImpact = opts?.maxImpact ?? START_POINTS_MAX_IMPACT_S;

  const delta = Math.log1p(startPoints) - Math.log1p(baseline);
  const adj   = -maxImpact * Math.tanh(delta / alpha);

  if (!Number.isFinite(adj)) return 0;
  log.debug(`[startPts] ${startPoints} pts (baseline ${baseline}) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Field-aware start-points adjustment.
 *
 * Normalises the horse's start points to the race field's median/IQR, so
 * the adjustment measures advantage *within today's race* rather than
 * against a fixed historical baseline.
 *
 * Falls back to {@link calculateStartPointsAdjustment} when fewer than 3
 * horses have valid start-points data.
 */
export const calculateStartPointsAdjustmentFieldAware = (
  startPoints: number,
  fieldStartPoints: number[],
  opts?: { beta?: number; maxImpact?: number }
): number => {
  const valid = fieldStartPoints.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!Number.isFinite(startPoints) || valid.length < 3) {
    return calculateStartPointsAdjustment(startPoints);
  }

  const q = (p: number) => {
    const idx = (valid.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return (1 - (idx - lo)) * valid[lo] + (idx - lo) * valid[hi];
  };

  const median = q(0.5);
  const iqr    = Math.max(1, q(0.75) - q(0.25));
  const beta      = opts?.beta      ?? START_POINTS_FIELD_AWARE_BETA;
  const maxImpact = opts?.maxImpact ?? START_POINTS_FIELD_AWARE_MAX_IMPACT_S;

  const adj = -maxImpact * Math.tanh((startPoints - median) / (iqr * beta));
  log.debug(`[startPts/field] ${startPoints} pts (median ${median.toFixed(0)}, IQR ${iqr.toFixed(0)}) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Place-percentage baseline adjustment.
 *
 * @param placePercentageBasisPoints  e.g. 3 478 = 34.78 %
 */
export const calculatePlacePercentageAdjustment = (
  placePercentageBasisPoints: number
): number => {
  const pct = placePercentageBasisPoints / 100;
  const adj = (PLACE_PCT_BASELINE - pct) * PLACE_PCT_SCALE_S;
  log.debug(`[place%] ${pct.toFixed(1)}% (baseline ${PLACE_PCT_BASELINE}%) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Horse win-percentage baseline adjustment.
 *
 * @param winPercentageBasisPoints  e.g. 434 = 4.34 %
 */
export const calculateHorseWinPercentageAdjustment = (
  winPercentageBasisPoints: number
): number => {
  const pct = winPercentageBasisPoints / 100;
  const adj = (WIN_PCT_BASELINE - pct) * WIN_PCT_SCALE_S;
  log.debug(`[win%] ${pct.toFixed(1)}% (baseline ${WIN_PCT_BASELINE}%) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Earnings-per-start baseline adjustment.
 *
 * @param earningsPerStartOre  Earnings in öre (Swedish cents); ÷100 → SEK.
 */
export const calculateEarningsPerStartAdjustment = (
  earningsPerStartOre: number
): number => {
  const sek = earningsPerStartOre / 100;
  const adj = (EARNINGS_BASELINE_SEK - sek) * EARNINGS_SCALE_S;
  log.debug(`[earnings] ${sek.toFixed(0)} SEK/start (baseline ${EARNINGS_BASELINE_SEK}) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Recent-form adjustment based on finish positions.
 *
 * Analyses the last {@link FORM_MAX_RECENT_RACES} races, weighted towards
 * the most recent.  Falls back to a win-percentage proxy when no race
 * results are available.
 *
 * Form scores per finish position:
 *  1st          → {@link FORM_SCORE_WIN}   (strong positive form)
 *  2nd–3rd      → {@link FORM_SCORE_PLACE} (good form)
 *  4th–5th      → {@link FORM_SCORE_GOOD}  (slight positive)
 *  6th–10th     → {@link FORM_SCORE_MID}   (mid-pack → negative form)
 *  11th+        → {@link FORM_SCORE_POOR}  (poor finish)
 *
 * Adjustment range (with default scale {@link FORM_SCALE_S}):
 *  ≈ −0.05 s (perfect recent form) … +0.03 s (poor recent form)
 */
export const calculateFormAdjustment = (
  recentRaces?: Array<{ place: number; date: string }>,
  winPercentageBasisPoints?: number,
  maxRecentRaces: number = FORM_MAX_RECENT_RACES
): number => {
  if (recentRaces && recentRaces.length > 0) {
    const sorted = [...recentRaces]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, maxRecentRaces);

    let formScore   = 0;
    let totalWeight = 0;

    sorted.forEach((race, index) => {
      const weight = maxRecentRaces - index;
      let score: number;
      if      (race.place === 1)                        score = FORM_SCORE_WIN;
      else if (race.place >= 2 && race.place <= 3)      score = FORM_SCORE_PLACE;
      else if (race.place >= 4 && race.place <= 5)      score = FORM_SCORE_GOOD;
      else if (race.place >= 6 && race.place <= 10)     score = FORM_SCORE_MID;
      else                                              score = FORM_SCORE_POOR;

      formScore   += score * weight;
      totalWeight += weight;
    });

    const avg = totalWeight > 0 ? formScore / totalWeight : 0;
    const adj = avg * FORM_SCALE_S;
    log.debug(`[form] ${sorted.length} races → avg score ${avg.toFixed(3)} → ${adj >= 0 ? '+' : ''}${adj.toFixed(3)}s`);
    return adj;
  }

  if (winPercentageBasisPoints !== undefined && Number.isFinite(winPercentageBasisPoints)) {
    const pct = winPercentageBasisPoints > 100
      ? winPercentageBasisPoints / 100
      : winPercentageBasisPoints;
    const adj = (FORM_FALLBACK_BASELINE_PCT - pct) * FORM_FALLBACK_SCALE_S;
    log.debug(`[form/fallback] win% ${pct.toFixed(1)}% → ${adj >= 0 ? '+' : ''}${adj.toFixed(3)}s`);
    return adj;
  }

  log.debug('[form] no data → 0.000s');
  return 0;
};

/**
 * Gallop-risk time penalty.
 *
 * Horses that frequently break gait are unpredictable — a tanh curve
 * converts their historical gallop rate into a positive (slower) time
 * adjustment.  Zero gallop history → 0 s (no bonus for reliability).
 *
 *   adjustment = GALLOP_RISK_MAX_S × tanh(gallopRate / GALLOP_RISK_SCALE)
 *
 * Examples (defaults — max 0.50 s, scale 0.15):
 *   0 %  → +0.00 s  (never galloped — no effect)
 *  10 %  → +0.32 s  (occasional gallop risk)
 *  15 %  → +0.38 s  (regular gallop risk, ≈ half field position)
 *  30 %+ → ≈ +0.49 s (capped — serial offender)
 */
export const calculateGallopRiskAdjustment = (gallopRate: number): number => {
  if (!Number.isFinite(gallopRate) || gallopRate <= 0) return 0;
  const rate = Math.max(0, Math.min(1, gallopRate));
  const adj = GALLOP_RISK_MAX_S * Math.tanh(rate / GALLOP_RISK_SCALE);
  log.debug(`[gallopRisk] rate=${(rate * 100).toFixed(1)}% → +${adj.toFixed(3)}s`);
  return adj;
};
