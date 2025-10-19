/**
 * Confidence scoring and fallback prediction utilities
 * for horses with limited or foreign-only history
 */

export interface ConfidenceMetrics {
  localStarts: number;
  foreignStarts: number;
  daysSinceLastStart?: number;
  samplesSpeed: number;
  hasRawKmTime: boolean;
}

export interface ConfidenceResult {
  hasLocalHistory: boolean;
  hasAnyHistory: boolean;
  confidence: number;
  historySource: "local" | "abroad" | "none";
}

/**
 * Compute confidence score (0-100) based on data quality
 * Higher score = more reliable prediction
 */
export function computeConfidence(metrics: ConfidenceMetrics): number {
  const { localStarts, foreignStarts, daysSinceLastStart, samplesSpeed, hasRawKmTime } = metrics;
  
  const totalStarts = localStarts + foreignStarts;
  let score = 0;
  
  // Volume: up to 60 points (more starts = more data)
  score += Math.min(totalStarts, 10) * 6;
  
  // Sample quality: up to 20 points (actual km-time samples)
  if (hasRawKmTime) {
    score += Math.min(samplesSpeed, 10) * 2;
  }
  
  // Recency bonus: up to 20 points
  if (daysSinceLastStart !== undefined) {
    if (daysSinceLastStart < 14) {
      score += 20; // Very recent
    } else if (daysSinceLastStart < 35) {
      score += 10; // Recent
    }
  }
  
  // Local data bonus (more reliable than foreign)
  if (localStarts > 0) {
    score += 10;
  }
  
  // Clamp between 5-100 (never zero to avoid edge cases)
  return Math.max(5, Math.min(100, score));
}

/**
 * Determine history source and confidence metrics
 */
export function analyzeHistorySource(
  horse: any,
  rawTimeData?: any
): ConfidenceResult {
  // Extract metrics from horse statistics
  const localStarts = horse.statistics?.life?.starts || 0;
  const foreignStarts = 0; // Not available in current API, placeholder for future
  
  const hasLocal = localStarts > 0;
  const hasForeign = foreignStarts > 0;
  const hasAny = hasLocal || hasForeign;
  
  const hasRawKmTime = !!rawTimeData?.best3Average;
  const samplesSpeed = rawTimeData?.validTimesCount || 0;
  
  // Calculate days since last start if available
  let daysSinceLastStart: number | undefined;
  if (rawTimeData?.newestRecordDate) {
    const lastStart = new Date(rawTimeData.newestRecordDate);
    const now = new Date();
    daysSinceLastStart = Math.floor((now.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  const confidence = computeConfidence({
    localStarts,
    foreignStarts,
    daysSinceLastStart,
    samplesSpeed,
    hasRawKmTime
  });
  
  const historySource: "local" | "abroad" | "none" = 
    hasLocal ? "local" : hasForeign ? "abroad" : "none";
  
  return {
    hasLocalHistory: hasLocal,
    hasAnyHistory: hasAny,
    confidence,
    historySource
  };
}

/**
 * Calculate fallback predicted time when no local history is available
 * Uses class/earnings/driver priors and field median
 */
export interface FallbackPredictionContext {
  abroadAvgKm?: number;
  lifetimeBestKm?: number;
  fieldMedianKm: number;
  recencyDays?: number;
  driverPrior?: number;
  trainerPrior?: number;
  earningsPerStart?: number;
  raceClass?: string;
}

export function calculateFallbackPrediction(ctx: FallbackPredictionContext): number {
  const parts: Array<{v: number, w: number}> = [];
  
  // Abroad average with recency weight
  if (ctx.abroadAvgKm && ctx.abroadAvgKm > 0) {
    const w = ctx.recencyDays && ctx.recencyDays < 30 ? 0.6 : 0.45;
    parts.push({ v: ctx.abroadAvgKm, w });
  }
  
  // Lifetime best (add penalty as it's optimistic)
  if (ctx.lifetimeBestKm && ctx.lifetimeBestKm > 0) {
    parts.push({ v: ctx.lifetimeBestKm + 0.6, w: 0.15 });
  }
  
  // Field median (always available)
  parts.push({ v: ctx.fieldMedianKm, w: 0.25 });
  
  // Calculate weighted average
  const totalWeight = parts.reduce((s, p) => s + p.w, 0);
  const weighted = parts.reduce((s, p) => s + p.v * p.w, 0) / totalWeight;
  
  // Apply driver/trainer priors
  const priorAdj = (ctx.driverPrior ?? 0) + (ctx.trainerPrior ?? 0);
  
  return Math.max(0, weighted + priorAdj);
}

/**
 * External history provider interface (for future expansion)
 */
export interface ExternalHistoryProvider {
  getAbroadHistory(horseId: string, sinceDays?: number): Promise<{
    avgKm?: number;
    bestKm?: number;
    starts?: number;
    lastStartDays?: number;
  } | null>;
}

/**
 * Default no-op provider (placeholder for future implementation)
 */
export const NullExternalHistory: ExternalHistoryProvider = {
  async getAbroadHistory() {
    return null;
  }
};
