
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

export const processHistoricalRecords = (records: ATGHistoricalRecord[]): ATGHistoricalRecord[] => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  
  return records.filter(record => {
    // Check date filter
    const raceDate = new Date(record.date);
    const isWithin12Months = raceDate >= twelveMonthsAgo;
    
    // Check time validity
    const hasValidTime = record.kmTime && 
      typeof record.kmTime === 'object' && 
      'minutes' in record.kmTime && 
      'seconds' in record.kmTime && 
      'tenths' in record.kmTime &&
      typeof record.kmTime.minutes === 'number' &&
      typeof record.kmTime.seconds === 'number' &&
      typeof record.kmTime.tenths === 'number';
    
    // Check if not disqualified/galloped
    const isNotDisqualified = !record.disqualified && !record.galloped;
    
    // Check place validity
    const hasValidPlace = record.place && 
      record.place !== "0" && 
      record.place !== "" && 
      !isNaN(parseInt(record.place));
    
    // Check required fields
    const hasRequiredFields = record.start?.distance && 
      record.race?.startMethod && 
      record.track?.name &&
      record.start?.postPosition;
    
    return isWithin12Months && hasValidTime && isNotDisqualified && hasValidPlace && hasRequiredFields;
  });
};
