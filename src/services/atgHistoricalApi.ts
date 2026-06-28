
import { hasNumericKmTime } from './utils/kmTimeUtils';
import { distanceCategoryToMeters, isAggregateRecordSource } from './utils/recordsFallback';
import { log } from '@/lib/logger';

export interface ATGHistoricalRecord {
  date: string;
  kmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  } | { code: string };
  place?: string;
  race: {
    id: string;
    startMethod: string;
    firstPrize?: number;             // Race class indicator
  };
  odds?: number;                    // Historical odds for this start
  finishOrder?: number;              // Numeric finish position
  track: {
    name: string;
    condition?: string;              // "light" | "dead" | "winter" | "abandoned"
  };
  start: {
    distance: number;
    postPosition: number;
  };
  galloped?: boolean;
  disqualified?: boolean;
}

export interface ATGHorseHistoricalData {
  horse: {
    name: string;
    id: number;
    results?: {
      records: ATGHistoricalRecord[];
    };
  };
  driver: {
    firstName: string;
    lastName: string;
  };
  postPosition: number;
}

const START_CACHE = new Map<string, { data: ATGHorseHistoricalData; fetchedAt: number }>();
const START_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isStartCacheExpired(entry: { fetchedAt: number }): boolean {
  return Date.now() - entry.fetchedAt > START_CACHE_TTL_MS;
}

export const fetchHorseHistoricalData = async (raceId: string, startNumber: number): Promise<ATGHorseHistoricalData> => {
  const cacheKey = `${raceId}:${startNumber}`;
  const cached = START_CACHE.get(cacheKey);
  if (cached && !isStartCacheExpired(cached)) {
    return cached.data;
  }

  log.debug(`Fetching historical data for race ${raceId}, start ${startNumber}`);

  try {
    const response = await fetch(`/api/atg/races/${raceId}/start/${startNumber}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`);
    }

    const data = await response.json();
    START_CACHE.set(cacheKey, { data, fetchedAt: Date.now() });
    log.debug(`Historical data fetched for horse ${data.horse?.name || 'Unknown'}`);

    return data;

  } catch (error) {
    log.warn(`Error fetching historical data for ${raceId}/start/${startNumber}:`, error);
    throw error;
  }
};

export function clearStartCache(): void {
  START_CACHE.clear();
}

export interface InvalidCandidate {
  normalizedTime: { minutes: number; seconds: number; tenths: number };
  dropReason?: string;
  source?: string;
}

export interface HistoricalProcessingResult {
  records: ATGHistoricalRecord[];
  invalidCandidates: InvalidCandidate[];
  metadata: {
    usedFallback: boolean;
    dataSource: 'recent' | 'fallback';
    oldestRecordDate?: string;
    newestRecordDate?: string;
    totalRecordsProcessed: number;
    validRecordsFound: number;
    filteringStats: {
      total: number;
      outsideTimeWindow: number;
      noTime: number;
      disqualified: number;
      galloped: number;
      invalidPlace: number;
      missingFields: number;
      valid: number;
    };
    /** Dates of galloped races in the processing window. */
    gallopDates?: string[];
    /** Mean odds across recent starts (market signal). */
    averageHistoricalOdds?: number;
    /** Most recent race odds. */
    lastOdds?: number;
  };
}

/** Locked raw-time policy from ATG truth simulation: recent 3 average inside 90 days, fallback to all prior. */
const RAW_TIME_RECENT_WINDOW_DAYS = 90;
const RAW_TIME_AVERAGE_N = 3;

export const processHistoricalRecords = (
  records: ATGHistoricalRecord[],
  debugHorseName?: string,
  /** ISO date string of the race being predicted. When provided, only records strictly
   *  BEFORE this date are used — prevents post-race data from leaking into calibration. */
  raceDateCutoff?: string
): HistoricalProcessingResult => {
  // Use the race date (if given) as reference so the 5-month window is anchored to the
  // race, not to today. This prevents future races from bleeding into form/gallopRate etc.
  const referenceDate = raceDateCutoff ? new Date(raceDateCutoff) : new Date();
  const cutoffDate = new Date(referenceDate);
  cutoffDate.setDate(cutoffDate.getDate() - RAW_TIME_RECENT_WINDOW_DAYS);
  // Strict upper bound: exclude records on-or-after the race date
  const upperDate: Date | undefined = raceDateCutoff ? new Date(raceDateCutoff) : undefined;

  // Helper function to filter records by date and other criteria
  const filterRecords = (records: ATGHistoricalRecord[], ignoreTimeWindow = false) => {
    const filteringStats = {
      total: records.length,
      outsideTimeWindow: 0,
      noTime: 0,
      disqualified: 0,
      galloped: 0,
      invalidPlace: 0,
      missingFields: 0,
      valid: 0
    };
    
    const isXanderDebug = debugHorseName?.toLowerCase().includes('xander');
    const invalidCandidates: InvalidCandidate[] = [];
    
    // Helper to reject a record and capture it if it has a numeric time (excluding 0:00.0)
    const rejectRecord = (record: ATGHistoricalRecord, reason: string, source: string) => {
      if (hasNumericKmTime(record) && 'minutes' in record.kmTime!) {
        invalidCandidates.push({
          normalizedTime: {
            minutes: (record.kmTime as any).minutes,
            seconds: (record.kmTime as any).seconds,
            tenths: (record.kmTime as any).tenths ?? 0,
          },
          dropReason: reason,
          source
        });
      }
    };
    
    const validRecords = records.filter(record => {
      const source = (record as any).meta?.source || 'results';
      const isAggregateSource = isAggregateRecordSource(source);
      
      // IMPORTANT: Check statistics bypass FIRST before any date parsing
      // This prevents statistics records from being incorrectly dropped
      if (isAggregateSource && !record.date) {
        // Aggregate records without dates bypass time window (e.g., life/best records)
        if (isXanderDebug) {
          log.debug(`STATISTICS RECORD - Bypassing time window check`);
        }
        // Skip to next filter - don't check date window for stats
      } else if (!ignoreTimeWindow) {
        // Only check date window for non-statistics records or statistics with dates
        if (!record.date) {
          filteringStats.outsideTimeWindow++;
          rejectRecord(record, 'no-date', source);
          return false;
        }
        const raceDate = new Date(record.date);
        // Aggregate sources carry SYNTHETIC year-end dates (e.g. current-year stats are
        // dated `{year}-12-31`), not real event dates, so the upper/future bound must not
        // apply to them — otherwise current-year statistics are always rejected as "future"
        // and the stats fallback never fires. They still respect the lower (recent) bound.
        const withinLowerBound = raceDate >= cutoffDate;
        const withinUpperBound = isAggregateSource || !upperDate || raceDate < upperDate;
        if (!withinLowerBound || !withinUpperBound) {
          filteringStats.outsideTimeWindow++;
          rejectRecord(record, `outside-${RAW_TIME_RECENT_WINDOW_DAYS}-days`, source);
          if (isXanderDebug) {
            log.debug(`FILTERED OUT - Outside ${RAW_TIME_RECENT_WINDOW_DAYS} days: ${record.date}`);
          }
          return false;
        }
      } else if (upperDate && record.date && !isAggregateSource) {
        const raceDate = new Date(record.date);
        if (raceDate >= upperDate) {
          filteringStats.outsideTimeWindow++;
          rejectRecord(record, 'future-or-same-day', source);
          return false;
        }
      }
      
      // Check time validity
      const hasValidTime = hasNumericKmTime(record);
      
      if (!hasValidTime) {
        filteringStats.noTime++;
        if (isXanderDebug) {
          log.debug(`FILTERED OUT - No valid time: ${record.date}`);
        }
        return false;
      }
      
      // Check if disqualified
      if (record.disqualified) {
        filteringStats.disqualified++;
        rejectRecord(record, 'disqualified', source);
        if (isXanderDebug) {
          log.debug(`FILTERED OUT - Disqualified: ${record.date}`);
        }
        return false;
      }
      
      // Check if galloped
      if (record.galloped) {
        filteringStats.galloped++;
        rejectRecord(record, 'galloped', source);
        if (isXanderDebug) {
          log.debug(`FILTERED OUT - Galloped: ${record.date}`);
        }
        return false;
      }
      
      // Place is NOT required for raw-time evaluation: a timed-but-unplaced start (place
      // absent or "0") is still a valid time signal. Only reject when a place is PRESENT
      // but malformed/negative. (Applies equally to detail and aggregate sources.)
      const placeStr = String(record.place ?? "");
      const hasPlaceData = placeStr !== "";
      const placeNum = hasPlaceData ? parseInt(placeStr, 10) : NaN;
      if (hasPlaceData && (isNaN(placeNum) || placeNum < 0)) {
        filteringStats.invalidPlace++;
        rejectRecord(record, 'invalid-place', source);
        if (isXanderDebug) {
          log.debug(`FILTERED OUT - Invalid finish place: ${record.date} (place: ${record.place})`);
        }
        return false;
      }
      
      // Check required fields (relax for statistics records)
      const hasStartMethod = record.race?.startMethod || (record as any).meta?.startMethod;
      const hasDistance = record.start?.distance || distanceCategoryToMeters((record as any).meta?.distance);
      
      const hasRequiredFields = isAggregateSource
        ? hasStartMethod && hasDistance // Aggregate records need less
        : record.start?.distance && 
          record.race?.startMethod && 
          record.track?.name &&
          record.start?.postPosition;
        
      if (!hasRequiredFields) {
        filteringStats.missingFields++;
        rejectRecord(record, 'missing-fields', source);
        if (isXanderDebug) {
          log.debug(`FILTERED OUT - Missing fields: ${record.date}`);
        }
        return false;
      }
      
      filteringStats.valid++;
      if (isXanderDebug) {
        const timeStr = typeof record.kmTime === 'object' && 'minutes' in record.kmTime 
          ? `${record.kmTime.minutes}:${record.kmTime.seconds}.${record.kmTime.tenths}`
          : 'Unknown time';
        log.debug(`KEPT - ${record.date}: ${timeStr} (${record.start.distance}m, place ${record.place})`);
      }
      
      return true;
    });
    
    return { validRecords, invalidCandidates, filteringStats };
  };
  
  const withRawTimeWindow = (record: ATGHistoricalRecord, rawTimeWindow: 'recent' | 'older-fill'): ATGHistoricalRecord => ({
    ...record,
    meta: {
      ...((record as any).meta ?? {}),
      rawTimeWindow,
    },
  } as ATGHistoricalRecord);

  // First pass: try the locked 90-day recent window.
  log.debug(`[${debugHorseName || 'Horse'}] Starting historical record processing with ${records.length} total records`);
  const { validRecords: recentRecords, invalidCandidates: recentInvalid, filteringStats: recentStats } = filterRecords(records, false);
  
  let finalRecords = recentRecords.map(record => withRawTimeWindow(record, 'recent'));
  let finalInvalidCandidates = recentInvalid;
  let usedFallback = false;
  let dataSource: 'recent' | 'fallback' = 'recent';
  let finalStats = recentStats;
  
  // Second pass: if the 90-day window has no usable records, fall back to all
  // prior detail records. Do not fill partial recent windows with older starts.
  if (recentRecords.length === 0) {
    log.debug(`[${debugHorseName || 'Horse'}] No recent pre-race records found, attempting all-prior fallback`);
    const { validRecords: fallbackRecords, invalidCandidates: fallbackInvalid, filteringStats: fallbackStats } = filterRecords(records, true);
    
    if (fallbackRecords.length > 0) {
      finalRecords = fallbackRecords.map(record => withRawTimeWindow(record, 'older-fill'));
      finalInvalidCandidates = fallbackInvalid;
      usedFallback = true;
      dataSource = 'fallback';
      finalStats = fallbackStats;
      log.debug(`[${debugHorseName || 'Horse'}] ALL-PRIOR FALLBACK ACTIVATED: Found ${fallbackRecords.length} valid historical records`);
    } else {
      log.warn(`[${debugHorseName || 'Horse'}] No valid records found even with fallback`);
    }
  }
  
  // Calculate date range
  let oldestRecordDate: string | undefined;
  let newestRecordDate: string | undefined;
  
  if (finalRecords.length > 0) {
    finalRecords = finalRecords.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    const dates = finalRecords
      .map(r => r.date ? new Date(r.date) : null)
      .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    oldestRecordDate = dates[0]?.toISOString().split('T')[0];
    newestRecordDate = dates[dates.length - 1]?.toISOString().split('T')[0];
  }
  
  // Log final statistics
  const isXanderDebug = debugHorseName?.toLowerCase().includes('xander');
  if (isXanderDebug || usedFallback) {
    log.debug(`[${debugHorseName || 'Horse'}] FINAL FILTERING SUMMARY ${usedFallback ? '(FALLBACK MODE)' : '(RECENT MODE)'}:`);
    log.debug(`   Total records: ${finalStats.total}`);
    log.debug(`   Outside time window: ${finalStats.outsideTimeWindow}`);
    log.debug(`   No valid time: ${finalStats.noTime}`);
    log.debug(`   Disqualified: ${finalStats.disqualified}`);
    log.debug(`   Galloped: ${finalStats.galloped}`);
    log.debug(`   Invalid place: ${finalStats.invalidPlace}`);
    log.debug(`   Missing fields: ${finalStats.missingFields}`);
    log.debug(`   Final valid records: ${finalStats.valid}`);
    log.debug(`   Date range: ${oldestRecordDate} to ${newestRecordDate}`);
    log.debug(`   Data source: ${dataSource.toUpperCase()}`);
    if (usedFallback) {
      log.debug(`   HORSE USING FALLBACK (OLD DATA)`);
    }
  }
  
  // Extract gallop dates and odds metadata from all records (not just valid ones)
  const gallopDates = records
    .filter(r => r.galloped === true && r.date)
    .map(r => r.date)
    .filter(Boolean);

  const oddsValues = records
    .filter(r => r.odds != null && Number.isFinite(r.odds) && r.odds > 0)
    .map(r => r.odds!);

  const averageHistoricalOdds = oddsValues.length > 0
    ? oddsValues.reduce((sum, v) => sum + v, 0) / oddsValues.length
    : undefined;

  // Most recent odds (sorted by date descending)
  const sortedByDate = records
    .filter(r => r.odds != null && Number.isFinite(r.odds) && r.odds > 0 && r.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastOdds = sortedByDate.length > 0 ? sortedByDate[0].odds : undefined;

  return {
    records: finalRecords,
    invalidCandidates: finalInvalidCandidates,
    metadata: {
      usedFallback,
      dataSource,
      oldestRecordDate,
      newestRecordDate,
      totalRecordsProcessed: records.length,
      validRecordsFound: finalRecords.length,
      filteringStats: finalStats,
      gallopDates,
      averageHistoricalOdds,
      lastOdds,
    }
  };
};
