
/**
 * Start points → time adjustment (robust & capped).
 * 
 * Uses log scale + tanh saturation to prevent extreme bonuses for very high start points.
 * - Log scale compresses very large values (16000+ pts doesn't blow up the model)
 * - tanh caps extreme impact at ±maxImpact seconds
 * - Negative adjustment = faster (bonus), Positive = slower (penalty)
 *
 * Tunables:
 *   baseline: field-neutral level (≈ 1200 by observation)
 *   alpha:    how quickly it saturates (higher = softer curve)
 *   maxImpact: absolute cap in seconds (|adj| ≤ maxImpact)
 * 
 * Examples with defaults:
 *   900 pts  → +0.267 s (penalty)
 *   1200 pts → 0.000 s (neutral)
 *   2000 pts → −0.415 s (bonus)
 *   5000 pts → ≈ −0.590 s
 *   16000 pts → ≈ −0.600 s (capped, no runaway bonuses)
 */
export const calculateStartPointsAdjustment = (
  startPoints: number,
  opts?: { baseline?: number; alpha?: number; maxImpact?: number }
): number => {
  if (!Number.isFinite(startPoints) || startPoints <= 0) {
    console.log(`Start Points adjustment: ${startPoints} points → 0.000s (invalid)`);
    return 0;
  }

  const baseline  = opts?.baseline  ?? 1200;  // typical median
  const alpha     = opts?.alpha     ?? 0.60;  // curve tightness
  const maxImpact = opts?.maxImpact ?? 0.60;  // cap in seconds

  // log1p to avoid log(0) and compress scale
  const delta = Math.log1p(startPoints) - Math.log1p(baseline);

  // Saturated, signed adjustment (negative means faster)
  const adj = -maxImpact * Math.tanh(delta / alpha);

  // Sanity check
  if (!Number.isFinite(adj)) {
    console.log(`Start Points adjustment: ${startPoints} points → 0.000s (calculation error)`);
    return 0;
  }
  
  console.log(`Start Points adjustment: ${startPoints} points (baseline: ${baseline}) → ${adj.toFixed(3)}s [log+tanh saturated]`);
  return adj;
};

/**
 * Field-aware start points adjustment (optional, more sophisticated).
 * 
 * Normalizes to the race field's median/IQR so adjustment measures
 * advantage *within today's race* rather than against a fixed baseline.
 * 
 * Falls back to the log/tanh method if field data is insufficient.
 */
export const calculateStartPointsAdjustmentFieldAware = (
  startPoints: number,
  fieldStartPoints: number[],
  opts?: { beta?: number; maxImpact?: number }
): number => {
  if (!Number.isFinite(startPoints) || !Array.isArray(fieldStartPoints) || fieldStartPoints.length < 3) {
    // Fallback to standard method
    return calculateStartPointsAdjustment(startPoints, { baseline: 1200, alpha: 0.60, maxImpact: 0.60 });
  }

  const sorted = fieldStartPoints.filter(n => Number.isFinite(n) && n > 0).sort((a,b)=>a-b);
  if (sorted.length < 3) {
    return calculateStartPointsAdjustment(startPoints, { baseline: 1200, alpha: 0.60, maxImpact: 0.60 });
  }

  // Quantile function
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    const w = idx - lo;
    return (1 - w) * sorted[lo] + w * sorted[hi];
  };
  
  const median = q(0.5);
  const iqr = Math.max(1, q(0.75) - q(0.25)); // avoid division by 0

  const beta = opts?.beta ?? 2.0;            // scaling in "IQR units"
  const maxImpact = opts?.maxImpact ?? 0.50; // cap a bit lower when field-aware

  const z_iqr = (startPoints - median) / iqr;
  const adj = -maxImpact * Math.tanh(z_iqr / beta);
  
  console.log(`Start Points adjustment (field-aware): ${startPoints} points (median: ${median.toFixed(0)}, IQR: ${iqr.toFixed(0)}) → ${adj.toFixed(3)}s`);
  return adj;
};

/**
 * Calculate place percentage baseline adjustment
 * Higher place % = better consistency = faster times
 * Input: percentage as basis points (e.g., 3478 for 34.78%)
 */
export const calculatePlacePercentageAdjustment = (placePercentageBasisPoints: number): number => {
  // Convert from basis points to actual percentage
  const actualPercentage = placePercentageBasisPoints / 100;
  
  // Baseline: 50% place rate = 0 adjustment
  // Every 10% above/below baseline = -/+ 0.01s (reduced from 0.1s)
  const baseline = 50;
  const adjustment = (baseline - actualPercentage) * 0.001;
  
  console.log(`Place % adjustment: ${actualPercentage.toFixed(1)}% (baseline: ${baseline}%) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate horse win percentage baseline adjustment
 * Higher win % = better quality = faster times
 * Input: percentage as basis points (e.g., 434 for 4.34%)
 */
export const calculateHorseWinPercentageAdjustment = (winPercentageBasisPoints: number): number => {
  // Convert from basis points to actual percentage
  const actualPercentage = winPercentageBasisPoints / 100;
  
  // Baseline: 15% win rate = 0 adjustment
  // Every 5% above/below baseline = -/+ 0.075s (halved from 0.15s)
  const baseline = 15;
  const adjustment = (baseline - actualPercentage) * 0.015;
  
  console.log(`Horse Win % adjustment: ${actualPercentage.toFixed(1)}% (baseline: ${baseline}%) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate earnings per start baseline adjustment
 * Higher earnings = better quality = faster times
 * Input: earnings in öre (Swedish cents)
 */
export const calculateEarningsPerStartAdjustment = (earningsPerStartOre: number): number => {
  // Convert from öre to SEK
  const earningsInSek = earningsPerStartOre / 100;
  
  // Baseline: 3000 SEK per start = 0 adjustment
  // Every 1000 SEK above/below baseline = -/+ 0.01s (halved from 0.02s)
  const baseline = 3000;
  const adjustment = (baseline - earningsInSek) * 0.00001;
  
  console.log(`💰 Earnings/Start adjustment: ${earningsPerStartOre} öre = ${earningsInSek.toFixed(0)} SEK (baseline: ${baseline} SEK) → ${adjustment.toFixed(3)}s`);
  
  // Additional validation logging
  if (earningsInSek > 10000) {
    console.warn(`⚠️  High earnings detected: ${earningsInSek} SEK/start - adjustment: ${adjustment.toFixed(3)}s`);
  }
  if (earningsInSek < 500) {
    console.warn(`⚠️  Low earnings detected: ${earningsInSek} SEK/start - adjustment: ${adjustment.toFixed(3)}s`);
  }
  
  return adjustment;
};
