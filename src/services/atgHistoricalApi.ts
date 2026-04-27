
import { hasNumericKmTime } from './utils/kmTimeUtils';
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
  };
  track: {
    name: string;
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
  source?: 'results' | 'stats' | 'extended' | 'extended-last';
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
  };
}

/** Only allow historical records from the last 5 months (user requirement: 4–5 months). */
const HISTORICAL_RECORD_MAX_MONTHS = 5;

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
  cutoffDate.setMonth(cutoffDate.getMonth() - HISTORICAL_RECORD_MAX_MONTHS);
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
    const rejectRecord = (record: ATGHistoricalRecord, reason: string, source: 'results' | 'stats' | 'extended' | 'extended-last') => {
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
      const source = ((record as any).meta?.source as 'results' | 'stats' | 'extended') || 'results';
      const isStatisticsSource = (record as any).meta?.source === 'statistics';
      
      // IMPORTANT: Check statistics bypass FIRST before any date parsing
      // This prevents statistics records from being incorrectly dropped
      if (isStatisticsSource && !record.date) {
        // Statistics records without dates bypass time window (e.g., 'life' records)
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
        const isWithinWindow = raceDate >= cutoffDate && (!upperDate || raceDate < upperDate);
        if (!isWithinWindow) {
          filteringStats.outsideTimeWindow++;
          rejectRecord(record, `outside-${HISTORICAL_RECORD_MAX_MONTHS}-months`, source);
          if (isXanderDebug) {
            log.debug(`FILTERED OUT - Outside ${HISTORICAL_RECORD_MAX_MONTHS} months: ${record.date}`);
          }
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
      
      // Check place validity - IMPORTANT: Place is NOT required for time evaluation
      // We only filter out if place is present but malformed (for data quality)
      // Records with no place or place="0" are still valid for time calculations
      const placeStr = String(record.place ?? "");
      const hasPlaceData = placeStr && placeStr !== "";
      
      if (hasPlaceData) {
        const placeNum = parseInt(placeStr, 10);
        // Only log if place exists but is truly invalid (not just "0")
        if (isNaN(placeNum) || placeNum < 0) {
          filteringStats.invalidPlace++;
          rejectRecord(record, 'invalid-place', source);
          if (isXanderDebug) {
            log.debug(`FILTERED OUT - Malformed place: ${record.date} (place: ${record.place})`);
          }
          return false;
        }
      }
      // NOTE: We don't filter on place=0 or missing place - time is still valid!
      
      // Check required fields (relax for statistics records)
      const hasStartMethod = record.race?.startMethod || (record as any).meta?.startMethod;
      const hasDistance = record.start?.distance || (record as any).meta?.distance;
      
      const hasRequiredFields = isStatisticsSource
        ? hasStartMethod && hasDistance // Statistics records need less
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
  
  // First pass: Try with 5-month constraint (only allow records from last 4–5 months)
  log.debug(`[${debugHorseName || 'Horse'}] Starting historical record processing with ${records.length} total records`);
  const { validRecords: recentRecords, invalidCandidates: recentInvalid, filteringStats: recentStats } = filterRecords(records, false);
  
  let finalRecords = recentRecords;
  let finalInvalidCandidates = recentInvalid;
  let usedFallback = false;
  let dataSource: 'recent' | 'fallback' = 'recent';
  let finalStats = recentStats;
  
  // Second pass: If no recent records, use fallback (all-time)
  if (recentRecords.length === 0) {
    log.warn(`[${debugHorseName || 'Horse'}] No recent records found, attempting fallback to all historical data`);
    const { validRecords: fallbackRecords, invalidCandidates: fallbackInvalid, filteringStats: fallbackStats } = filterRecords(records, true);
    
    if (fallbackRecords.length > 0) {
      finalRecords = fallbackRecords;
      finalInvalidCandidates = fallbackInvalid;
      usedFallback = true;
      dataSource = 'fallback';
      finalStats = fallbackStats;
      log.warn(`[${debugHorseName || 'Horse'}] FALLBACK ACTIVATED: Found ${fallbackRecords.length} valid historical records from all time`);
    } else {
      log.warn(`[${debugHorseName || 'Horse'}] No valid records found even with fallback`);
    }
  }
  
  // Calculate date range
  let oldestRecordDate: string | undefined;
  let newestRecordDate: string | undefined;
  
  if (finalRecords.length > 0) {
    const dates = finalRecords.map(r => new Date(r.date)).sort((a, b) => a.getTime() - b.getTime());
    oldestRecordDate = dates[0].toISOString().split('T')[0];
    newestRecordDate = dates[dates.length - 1].toISOString().split('T')[0];
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
      filteringStats: finalStats
    }
  };
};
