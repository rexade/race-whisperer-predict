/**
 * Confidence scoring and fallback prediction utilities
 * for horses with limited or foreign-only history
 */

import type { HorseRawKmTime, KmTime } from '../../../services/types/kmTimeTypes';

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

interface HorseHistoryInput {
  statistics?: {
    life?: { starts?: number };
    starts?: number;
    totalStarts?: number;
    foreignStarts?: number;
    startPoints?: number;
    placePercentage?: number;
    winPercentage?: number;
    earningsPerStart?: number;
  };
}

const validCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const hasUsableTime = (time?: KmTime): boolean => {
  if (!time) return false;
  const seconds = time.minutes * 60 + time.seconds + time.tenths / 10;
  return Number.isFinite(seconds) && seconds > 0;
};

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
  horse: HorseHistoryInput,
  rawTimeData?: HorseRawKmTime
): ConfidenceResult {
  const statistics = horse.statistics;
  const rawSamples = Math.max(
    validCount(rawTimeData?.validTimesCount),
    validCount(rawTimeData?.allTimes?.length)
  );
  const localStarts = Math.max(
    validCount(statistics?.life?.starts),
    validCount(statistics?.starts),
    validCount(statistics?.totalStarts),
    rawSamples
  );
  const foreignStarts = validCount(statistics?.foreignStarts);
  const hasRawKmTime = [
    rawTimeData?.rawBestTime,
    rawTimeData?.bestTime,
    rawTimeData?.bestRecordTime,
  ].some(hasUsableTime);

  const hasForeign = foreignStarts > 0;
  const hasLocal = localStarts > 0 || (hasRawKmTime && !hasForeign);
  const hasAny = hasLocal || hasForeign;
  const samplesSpeed = validCount(rawTimeData?.validTimesCount);
  
  // Calculate days since last start if available
  let daysSinceLastStart: number | undefined;
  if (rawTimeData?.newestRecordDate) {
    const lastStartMs = Date.parse(rawTimeData.newestRecordDate);
    if (Number.isFinite(lastStartMs)) {
      daysSinceLastStart = Math.max(0, Math.floor((Date.now() - lastStartMs) / (1000 * 60 * 60 * 24)));
    }
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
