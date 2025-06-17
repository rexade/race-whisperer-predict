
export interface ATGRaceInfo {
  id: string;
  name: string;
  date: string;
  number: number;
  distance: number;
  startMethod: string;
  track: string;
  status: string;
}

export interface ATGStartInfo {
  number: number;
  distance: number;
  postPosition: number;
  horse: {
    name: string;
    id: number;
  };
  driver: {
    firstName: string;
    lastName: string;
    statistics?: {
      winPercentage?: number;
    };
  };
  result?: {
    finishOrder?: number;
    kmTime?: {
      minutes: number;
      seconds: number;
      tenths: number;
    };
    galloped?: boolean;
    disqualified?: boolean;
  };
}

export interface ATGRaceData {
  race: ATGRaceInfo;
  starts: ATGStartInfo[];
}

export interface ATGHistoricalRace {
  raceId: string;
  date: string;
  distance: number;
  startMethod: string;
  track: string;
  kmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  finishOrder?: number;
  postPosition: number;
  galloped?: boolean;
  disqualified?: boolean;
}

export const fetchRaceData = async (raceId: string): Promise<ATGRaceData> => {
  const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch race data: ${response.statusText}`);
  }
  return response.json();
};

export const fetchStartData = async (raceId: string, startNumber: number): Promise<ATGStartInfo> => {
  const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/start/${startNumber}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch start data: ${response.statusText}`);
  }
  return response.json();
};

export const fetchHorseHistory = async (horseId: number): Promise<ATGHistoricalRace[]> => {
  // This would be the actual ATG API endpoint for horse history
  // For now, we'll simulate it since I don't have the exact endpoint
  const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/horses/${horseId}/races`);
  if (!response.ok) {
    // If the endpoint doesn't exist, return empty array for now
    console.warn(`Horse history endpoint not available for horse ${horseId}`);
    return [];
  }
  return response.json();
};

export const searchRacesByDate = async (date: string): Promise<ATGRaceInfo[]> => {
  // This would search for races on a specific date
  const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races?date=${date}`);
  if (!response.ok) {
    throw new Error(`Failed to search races for date ${date}: ${response.statusText}`);
  }
  const data = await response.json();
  return data.races || [];
};
