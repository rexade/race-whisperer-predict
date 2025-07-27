
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

export const processHistoricalRecords = (
  records: ATGHistoricalRecord[], 
  debugHorseName?: string
): ATGHistoricalRecord[] => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  // 🔍 INVESTIGATION: Track filtering reasons for debugging
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
    // Check date filter
    const raceDate = new Date(record.date);
    const isWithin12Months = raceDate >= twelveMonthsAgo;
    if (!isWithin12Months) {
      filteringStats.outsideTimeWindow++;
      if (isXanderDebug) {
        console.log(`🕵️ FILTERED OUT - Outside 12 months: ${record.date}`);
      }
      return false;
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
    
    // Check place validity
    const hasValidPlace = record.place && 
      record.place !== "0" && 
      record.place !== "" && 
      !isNaN(parseInt(record.place));
      
    if (!hasValidPlace) {
      filteringStats.invalidPlace++;
      if (isXanderDebug) {
        console.log(`🕵️ FILTERED OUT - Invalid place: ${record.date} (place: ${record.place})`);
      }
      return false;
    }
    
    // Check required fields
    const hasRequiredFields = record.start?.distance && 
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
  
  // 🔍 INVESTIGATION: Log filtering statistics
  if (isXanderDebug) {
    console.log(`🕵️ XANDER FILTERING SUMMARY:`);
    console.log(`   Total records: ${filteringStats.total}`);
    console.log(`   Outside time window: ${filteringStats.outsideTimeWindow}`);
    console.log(`   No valid time: ${filteringStats.noTime}`);
    console.log(`   Disqualified: ${filteringStats.disqualified}`);
    console.log(`   Galloped: ${filteringStats.galloped}`);
    console.log(`   Invalid place: ${filteringStats.invalidPlace}`);
    console.log(`   Missing fields: ${filteringStats.missingFields}`);
    console.log(`   Final valid records: ${filteringStats.valid}`);
    console.log(`   Filtering rate: ${((filteringStats.total - filteringStats.valid) / filteringStats.total * 100).toFixed(1)}%`);
  }
  
  return validRecords;
};
