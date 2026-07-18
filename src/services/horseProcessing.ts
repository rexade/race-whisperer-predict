import { ProcessedKmTime, HorseRawKmTime } from './types/kmTimeTypes';
import { KmTime } from './utils/kmTimeUtils';
import { convertToKmTime } from './utils/timeConversion';
import { normalizeKmTimeSimplified } from './utils/kmTimeNormalization';
import { DataValidator } from './debugging/dataValidator';
import { getSourceConfidenceMultiplier, getStatisticsBreakdown, isAggregateRecordSource } from './utils/recordsFallback';
import { toSeconds, secondsToKmParts, isOutlierTime, createRecordKey } from './utils/robustTimeConversion';
import { log } from '@/lib/logger';

// Updated interface to match ATG API structure
export interface ATGHistoricalRace {
  raceId: string;
  date: string;
  distance: number;
  startMethod: string;
  track: string;
  kmTime: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  finishOrder: number;
  postPosition: number;
  galloped: boolean;
  disqualified: boolean;
}

export const processHorseKmTimes = async (
  horseId: number,
  horseName: string,
  historicalRaces: ATGHistoricalRace[],
  metadata?: {
    usedFallback: boolean;
    dataSource: 'recent' | 'fallback';
    oldestRecordDate?: string;
    newestRecordDate?: string;
    averageHistoricalOdds?: number;
    lastOdds?: number;
  }
): Promise<HorseRawKmTime> => {
  let processedTimes: ProcessedKmTime[] = [];
  let totalRecords = historicalRaces.length;
  let validRecords = 0;
  let disqualified = 0;
  let galloped = 0;

  // Most recent race date from ALL starts (including galloped/DQ) for layoff calculation
  const lastRaceDate = historicalRaces.length > 0
    ? historicalRaces
        .map(r => r.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
    : null;

  log.debug(`[horseProcessing] ${horseName} (${horseId}) — ${historicalRaces.length} records`);

  // CRITICAL: Check if we have historical records before processing
  if (!historicalRaces || historicalRaces.length === 0) {
    log.warn(`[horseProcessing] ${horseName}: no historical records`);

    return {
      horseId,
      horseName,
      allTimes: [],
      bestTime: { minutes: 0, seconds: 0, tenths: 0 },
      bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
      validTimesCount: 0
    };
  }

  log.debug(`[horseProcessing] ${horseName} — ${historicalRaces.length} records validated`);

  // Track why records are dropped - for debugging
  const dropReasons = {
    noKmTime: 0,
    badCode: 0,
    dqOrGallop: 0,
    invalidShape: 0,
    validProcessed: 0
  };

  for (const race of historicalRaces) {
    const isStatsSource = isAggregateRecordSource((race as any).meta?.source);

    // Check for valid kmTime structure
    if (!race.kmTime || typeof race.kmTime.minutes !== 'number' || typeof race.kmTime.seconds !== 'number') {
      dropReasons.noKmTime++;
      log.debug(`[horseProcessing] skip ${race.date} — no km time`);
      continue;
    }

    // Check for bad codes in kmTime
    const code = String((race.kmTime as any).code ?? (race as any).meta?.code ?? '').toLowerCase();
    const badCodes = ['0', 'it', 'dist', 'u', 'gdk', 'br', 'p', 'dq'];
    if (badCodes.includes(code)) {
      dropReasons.badCode++;
      log.debug(`[horseProcessing] skip ${race.date} — bad code: ${code}`);
      continue;
    }

    // Skip disqualified or galloped races
    if (race.disqualified) {
      disqualified++;
      dropReasons.dqOrGallop++;
      log.debug(`[horseProcessing] skip ${race.date} — disqualified`);
      continue;
    }

    if (race.galloped) {
      galloped++;
      dropReasons.dqOrGallop++;
      log.debug(`[horseProcessing] skip ${race.date} — galloped`);
      continue;
    }

    // Validate KM time (but be lenient for stats-sourced records)
    const raceValidation = DataValidator.validateKmTime(race.kmTime, `${horseName} race ${race.date}`);
    if (!raceValidation.isValid && !isStatsSource) {
      dropReasons.invalidShape++;
      log.error(`[horseProcessing] invalid km time for ${horseName} race ${race.date}:`, raceValidation.errors);
      continue;
    }

    try {
      const originalKmTime = convertToKmTime(race.kmTime);

      // Apply simplified normalization keeping KM time format
      const normalizedKmTime = normalizeKmTimeSimplified(
        originalKmTime,
        race.distance,
        race.startMethod
      );

      log.debug(`[horseProcessing] ${race.date}: ${originalKmTime.minutes}:${originalKmTime.seconds.toString().padStart(2, '0')}.${originalKmTime.tenths} → ${normalizedKmTime.minutes}:${normalizedKmTime.seconds.toString().padStart(2, '0')}.${normalizedKmTime.tenths} (${race.distance}m ${race.startMethod}, place ${race.finishOrder})`);

      // Check for outliers (warn but don't drop)
      const outlierCheck = isOutlierTime(normalizedKmTime);
      if (outlierCheck.isOutlier) {
        log.warn(`[horseProcessing] outlier time for ${horseName} on ${race.date}: ${normalizedKmTime.minutes}:${normalizedKmTime.seconds}.${normalizedKmTime.tenths} (${outlierCheck.reason})`);
      }

      processedTimes.push({
        originalTime: originalKmTime,
        normalizedTime: normalizedKmTime,
        raceDate: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        finishOrder: race.finishOrder,
        postPosition: race.postPosition,
        valid: true,
        outlier: outlierCheck.isOutlier ? outlierCheck.reason : undefined,
        raceId: race.raceId,
        rawTimeWindow: (race as any).meta?.rawTimeWindow,
      } as any);

      dropReasons.validProcessed++;
      validRecords++;
    } catch (error) {
      log.error(`[horseProcessing] error processing race ${race.date} for ${horseName}:`, error);
      continue;
    }
  }

  log.debug(`[horseProcessing] ${horseName} drop reasons:`, dropReasons);

  // Deduplicate records (same race + similar time = duplicate)
  const seen = new Set<string>();
  processedTimes = processedTimes.filter(r => {
    const key = createRecordKey(r as any);
    if (seen.has(key)) {
      log.debug(`[horseProcessing] duplicate removed: ${r.raceDate} ${r.normalizedTime.minutes}:${r.normalizedTime.seconds}.${r.normalizedTime.tenths}`);
      return false;
    }
    seen.add(key);
    return true;
  });

  // Keep processed starts in recency order. The raw-time baseline uses recent
  // form, not the fastest historical outlier.
  // Coerce missing OR unparseable dates to 0 so they sort last deterministically.
  // A raw `new Date(badStr).getTime()` is NaN, which makes the comparator return NaN
  // and leaves ordering of the recent-3 (and thus bestTime) nondeterministic.
  const toEpoch = (raceDate?: string): number => {
    const t = raceDate ? new Date(raceDate).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };
  processedTimes = processedTimes
    .map((r, i) => ({ ...r, _sortIndex: i }))
    .sort((a, b) => {
      const da = toEpoch(a.raceDate);
      const db = toEpoch(b.raceDate);
      if (da !== db) return db - da;
      return (a as any)._sortIndex - (b as any)._sortIndex; // Stable fallback
    });

  // Locked raw-time policy: average the most recent 3 valid detail records in
  // the 90-day window. If the window is empty, fall back to the most recent 3
  // all-prior records. Never use fastest/best as the main signal.
  let bestTime: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  let bestRecordTime: KmTime = { minutes: 0, seconds: 0, tenths: 0 };
  const hasBestTime = processedTimes.length > 0;

  if (hasBestTime) {
    const rawTimeWindowAware = processedTimes.some(t => (t as any).rawTimeWindow);
    let averagingTimes = processedTimes;

    if (rawTimeWindowAware) {
      const recentTimes = processedTimes.filter(t => (t as any).rawTimeWindow === 'recent');
      averagingTimes = recentTimes.length > 0
        ? recentTimes
        : processedTimes;
    }

    const n = Math.min(averagingTimes.length, 3);
    if (n >= 2) {
      const total = averagingTimes.slice(0, n).reduce((sum, t) =>
        sum + toSeconds(t.normalizedTime.minutes, t.normalizedTime.seconds, t.normalizedTime.tenths ?? 0), 0);
      bestTime = secondsToKmParts(total / n);
    } else {
      bestTime = { ...averagingTimes[0].normalizedTime };
    }
    const fastestRecord = processedTimes.reduce((best, current) => {
      const bestSec = toSeconds(best.normalizedTime.minutes, best.normalizedTime.seconds, best.normalizedTime.tenths ?? 0);
      const currentSec = toSeconds(current.normalizedTime.minutes, current.normalizedTime.seconds, current.normalizedTime.tenths ?? 0);
      return currentSec < bestSec ? current : best;
    }, processedTimes[0]);
    bestRecordTime = { ...fastestRecord.normalizedTime }; // Actual fastest record for display/reference only
    log.debug(`[horseProcessing] ${horseName} raw time (${n >= 2 ? `avg recent-${n}` : 'single'}): ${bestTime.minutes}:${bestTime.seconds.toString().padStart(2, '0')}.${bestTime.tenths}`);
  } else {
    log.warn(`[horseProcessing] ${horseName}: no valid times`);
  }

  log.debug(`[horseProcessing] ${horseName}: ${processedTimes.length} valid times`);
  if (!hasBestTime) {
    log.warn(`[horseProcessing] ${horseName}: no valid times — ${historicalRaces.length} records, drops:`, dropReasons);
  }

  // Compute gallop/DQ counts for last 10 starts (all races, including galloped/DQ ones)
  const recentTen = [...historicalRaces]
    .filter(r => r.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  const gallopCount = recentTen.filter(r => r.galloped === true).length;
  const gallopDates = recentTen.filter(r => r.galloped === true).map(r => r.date).filter(Boolean) as string[];
  const disqualificationCount = recentTen.filter(r => r.disqualified === true).length;

  // Get telemetry breakdown for statistics fallback
  const statsBreakdown = getStatisticsBreakdown(
    historicalRaces.map(r => ({ meta: { source: (r as any).meta?.source || 'results', distance: (r as any).meta?.distance } } as any))
  );

  const usedStatisticsFallback = statsBreakdown.statisticsRecords > 0;

  // Log telemetry for monitoring fallback usage
  if (usedStatisticsFallback) {
    log.debug(`[horseProcessing] ${horseName} stats fallback: ${statsBreakdown.statisticsRecords}/${statsBreakdown.totalRecords} records`);

  }

  // Apply confidence weighting for statistics-sourced records
  const confidenceMultiplier = getSourceConfidenceMultiplier(
    historicalRaces.map(r => ({ meta: { source: (r as any).meta?.source || 'results' } } as any))
  );

  // Store raw average before penalty for transparency
  const rawBestTime = { ...bestTime };

  if (confidenceMultiplier < 1.0) {
    const rawSec = toSeconds(bestTime.minutes, bestTime.seconds, bestTime.tenths ?? 0);
    const penalizedSec = rawSec / confidenceMultiplier; // Slower time = less confident
    bestTime = secondsToKmParts(penalizedSec);
    log.debug(`[horseProcessing] ${horseName} confidence ${confidenceMultiplier}x: ${rawBestTime.minutes}:${rawBestTime.seconds.toString().padStart(2, '0')}.${rawBestTime.tenths} → ${bestTime.minutes}:${bestTime.seconds.toString().padStart(2, '0')}.${bestTime.tenths}`);
  }

  log.debug(`[horseProcessing] ${horseName}: ${processedTimes.length} valid / ${historicalRaces.length} total, confidence ${confidenceMultiplier}x, final ${bestTime.minutes}:${bestTime.seconds.toString().padStart(2, '0')}.${bestTime.tenths}`);

  return {
    horseId,
    horseName,
    allTimes: processedTimes,
    bestTime, // Penalized time (used for ranking/display)
    rawBestTime, // ALWAYS return un-penalized time for normalization
    bestRecordTime,
    validTimesCount: processedTimes.length,
    isNotifiee: metadata?.usedFallback || false,
    dataSource: metadata?.dataSource || 'recent',
    oldestRecordDate: metadata?.oldestRecordDate,
    newestRecordDate: metadata?.newestRecordDate,
    confidenceMultiplier, // Include confidence in result
    usedStatisticsFallback,
    gallopRate: totalRecords > 0 ? galloped / totalRecords : 0,
    gallopCount,
    gallopDates,
    disqualificationCount,
    lastRaceDate: lastRaceDate ?? undefined,
    averageOdds: metadata?.averageHistoricalOdds,
    lastOdds: metadata?.lastOdds,
    consistencyScore: (() => {
      const finishes = processedTimes
        .filter(t => t.finishOrder !== undefined && t.finishOrder > 0)
        .sort((a, b) => new Date(b.raceDate).getTime() - new Date(a.raceDate).getTime())
        .slice(0, 8)
        .map(t => t.finishOrder!);
      if (finishes.length < 3) return undefined;
      const mean = finishes.reduce((s, v) => s + v, 0) / finishes.length;
      const variance = finishes.reduce((s, v) => s + (v - mean) ** 2, 0) / finishes.length;
      return Math.sqrt(variance);
    })(),
  };
};

// Keep the old function for backward compatibility
export const processHorseTimes = processHorseKmTimes;
