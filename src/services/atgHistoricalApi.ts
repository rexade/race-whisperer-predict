
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

export const fetchHorseHistoricalData = async (raceId: string, startNumber: number): Promise<ATGHorseHistoricalData> => {
  console.log(`Fetching historical data for race ${raceId}, start ${startNumber}`);
  
  try {
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/start/${startNumber}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Historical data fetched for horse ${data.horse?.name || 'Unknown'}`);
    
    return data;
    
  } catch (error) {
    console.error(`Error fetching historical data for ${raceId}/start/${startNumber}:`, error);
    throw error;
  }
};

export interface HistoricalProcessingResult {
  records: ATGHistoricalRecord[];
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

export const processHistoricalRecords = (
  records: ATGHistoricalRecord[], 
  debugHorseName?: string
): HistoricalProcessingResult => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
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
    
    const validRecords = records.filter(record => {
      const isStatisticsSource = (record as any).meta?.source === 'statistics';
      
      // IMPORTANT: Check statistics bypass FIRST before any date parsing
      // This prevents statistics records from being incorrectly dropped
      if (isStatisticsSource && !record.date) {
        // Statistics records without dates bypass time window (e.g., 'life' records)
        if (isXanderDebug) {
          console.log(`📊 STATISTICS RECORD - Bypassing time window check`);
        }
        // Skip to next filter - don't check date window for stats
      } else if (!ignoreTimeWindow) {
        // Only check date window for non-statistics records or statistics with dates
        if (!record.date) {
          filteringStats.outsideTimeWindow++;
          return false;
        }
        const raceDate = new Date(record.date);
        const isWithin12Months = raceDate >= twelveMonthsAgo;
        if (!isWithin12Months) {
          filteringStats.outsideTimeWindow++;
          if (isXanderDebug) {
            console.log(`🕵️ FILTERED OUT - Outside 12 months: ${record.date}`);
          }
          return false;
        }
      }
      
      // Check time validity
      const hasValidTime = record.kmTime && 
        typeof record.kmTime === 'object' && 
        'minutes' in record.kmTime && 
        'seconds' in record.kmTime && 
        'tenths' in record.kmTime &&
        typeof record.kmTime.minutes === 'number' &&
        typeof record.kmTime.seconds === 'number' &&
        typeof record.kmTime.tenths === 'number';
      
      if (!hasValidTime) {
        filteringStats.noTime++;
        if (isXanderDebug) {
          console.log(`🕵️ FILTERED OUT - No valid time: ${record.date}`);
        }
        return false;
      }
      
      // Check if disqualified
      if (record.disqualified) {
        filteringStats.disqualified++;
        if (isXanderDebug) {
          console.log(`🕵️ FILTERED OUT - Disqualified: ${record.date}`);
        }
        return false;
      }
      
      // Check if galloped
      if (record.galloped) {
        filteringStats.galloped++;
        if (isXanderDebug) {
          console.log(`🕵️ FILTERED OUT - Galloped: ${record.date}`);
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
          if (isXanderDebug) {
            console.log(`🕵️ FILTERED OUT - Malformed place: ${record.date} (place: ${record.place})`);
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
        if (isXanderDebug) {
          console.log(`🕵️ FILTERED OUT - Missing fields: ${record.date}`);
        }
        return false;
      }
      
      filteringStats.valid++;
      if (isXanderDebug) {
        const timeStr = typeof record.kmTime === 'object' && 'minutes' in record.kmTime 
          ? `${record.kmTime.minutes}:${record.kmTime.seconds}.${record.kmTime.tenths}`
          : 'Unknown time';
        console.log(`✅ KEPT - ${record.date}: ${timeStr} (${record.start.distance}m, place ${record.place})`);
      }
      
      return true;
    });
    
    return { validRecords, filteringStats };
  };
  
  // First pass: Try with 12-month constraint
  console.log(`🔍 [${debugHorseName || 'Horse'}] Starting historical record processing with ${records.length} total records`);
  const { validRecords: recentRecords, filteringStats: recentStats } = filterRecords(records, false);
  
  let finalRecords = recentRecords;
  let usedFallback = false;
  let dataSource: 'recent' | 'fallback' = 'recent';
  let finalStats = recentStats;
  
  // Second pass: If no recent records, use fallback (all-time)
  if (recentRecords.length === 0) {
    console.log(`⚠️ [${debugHorseName || 'Horse'}] No recent records found, attempting fallback to all historical data`);
    const { validRecords: fallbackRecords, filteringStats: fallbackStats } = filterRecords(records, true);
    
    if (fallbackRecords.length > 0) {
      finalRecords = fallbackRecords;
      usedFallback = true;
      dataSource = 'fallback';
      finalStats = fallbackStats;
      console.log(`🚨 [${debugHorseName || 'Horse'}] FALLBACK ACTIVATED: Found ${fallbackRecords.length} valid historical records from all time`);
    } else {
      console.log(`❌ [${debugHorseName || 'Horse'}] No valid records found even with fallback`);
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
    console.log(`🕵️ [${debugHorseName || 'Horse'}] FINAL FILTERING SUMMARY ${usedFallback ? '(FALLBACK MODE)' : '(RECENT MODE)'}:`);
    console.log(`   Total records: ${finalStats.total}`);
    console.log(`   Outside time window: ${finalStats.outsideTimeWindow}`);
    console.log(`   No valid time: ${finalStats.noTime}`);
    console.log(`   Disqualified: ${finalStats.disqualified}`);
    console.log(`   Galloped: ${finalStats.galloped}`);
    console.log(`   Invalid place: ${finalStats.invalidPlace}`);
    console.log(`   Missing fields: ${finalStats.missingFields}`);
    console.log(`   Final valid records: ${finalStats.valid}`);
    console.log(`   Date range: ${oldestRecordDate} to ${newestRecordDate}`);
    console.log(`   Data source: ${dataSource.toUpperCase()}`);
    if (usedFallback) {
      console.log(`   🚨 HORSE MARKED AS NOTIFIEE - USING OLD DATA`);
    }
  }
  
  return {
    records: finalRecords,
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
