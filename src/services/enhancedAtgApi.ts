
export interface EnhancedHorseData {
  horseId: number;
  name: string;
  postPosition: number;
  distance: number;
  startMethod: string;
  shoes: {
    front: string;
    back: string;
  };
  sulky: {
    type: string;
  };
  homeTrack: string;
  statistics: {
    startPoints: number;
    earningsPerStart: number;
    placePercentage: number;
    winPercentage: number;
  };
  driver: {
    firstName: string;
    lastName: string;
    winPercentage: number;
    winPercentage2025: number;
    experience: number;
  };
  rawTime?: number;
}

export interface EnhancedRaceData {
  raceId: string;
  raceNumber: number;
  distance: number;
  startMethod: string;
  track: string;
  horses: EnhancedHorseData[];
}

export const fetchEnhancedRaceData = async (raceId: string): Promise<EnhancedRaceData> => {
  console.log(`Fetching enhanced race data for: ${raceId}`);
  
  try {
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch race data: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("ATG Race Data:", data);
    
    // Extract race information - race data is at root level, not nested under data.race
    const raceInfo = {
      raceId: data.id,
      raceNumber: data.number,
      distance: data.distance,
      startMethod: data.startMethod,
      track: data.track.name,
      horses: [] as EnhancedHorseData[]
    };
    
    // Process each horse start
    for (const start of data.starts || []) {
      try {
        const enhancedHorse: EnhancedHorseData = {
          horseId: start.horse.id,
          name: start.horse.name,
          postPosition: start.postPosition,
          distance: start.distance || data.distance,
          startMethod: data.startMethod,
          shoes: {
            front: start.horse.shoes?.front || "1",
            back: start.horse.shoes?.back || "1"
          },
          sulky: {
            type: start.horse.sulky?.type?.code || "VA"
          },
          homeTrack: start.horse.homeTrack?.name || "Unknown",
          statistics: {
            startPoints: start.horse.statistics?.life?.startPoints || 0,
            earningsPerStart: calculateEarningsPerStart(
              start.horse.statistics?.life?.earnings || 0,
              start.horse.statistics?.life?.starts || 1
            ),
            placePercentage: start.horse.statistics?.life?.placePercentage || 0,
            winPercentage: start.horse.statistics?.life?.winPercentage || 0
          },
          driver: {
            firstName: start.driver.firstName,
            lastName: start.driver.lastName,
            winPercentage: start.driver.statistics?.winPercentage || 0,
            winPercentage2025: start.driver.statistics?.year2025?.winPercentage || start.driver.statistics?.thisYear?.winPercentage || 0,
            experience: start.driver.statistics?.starts || 0
          }
        };
        
        raceInfo.horses.push(enhancedHorse);
        console.log(`Processed horse: ${enhancedHorse.name} (${enhancedHorse.horseId})`);
        
      } catch (error) {
        console.error(`Error processing horse ${start.horse.name}:`, error);
      }
    }
    
    console.log(`Enhanced race data processed: ${raceInfo.horses.length} horses`);
    return raceInfo;
    
  } catch (error) {
    console.error("Error fetching enhanced race data:", error);
    throw error;
  }
};

const calculateEarningsPerStart = (totalEarnings: number, totalStarts: number): number => {
  if (totalStarts === 0) return 0;
  return Math.round(totalEarnings / totalStarts);
};

export const fetchEnhancedStartData = async (raceId: string, startNumber: number): Promise<EnhancedHorseData> => {
  console.log(`Fetching enhanced start data for race ${raceId}, start ${startNumber}`);
  
  try {
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/start/${startNumber}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch start data: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("ATG Start Data:", data);
    
    const enhancedHorse: EnhancedHorseData = {
      horseId: data.horse.id,
      name: data.horse.name,
      postPosition: data.postPosition,
      distance: data.start?.distance || 2140,
      startMethod: data.race?.startMethod || "auto",
      shoes: {
        front: data.horse.shoes?.front || "1",
        back: data.horse.shoes?.back || "1"
      },
      sulky: {
        type: data.horse.sulky?.type?.code || "VA"
      },
      homeTrack: data.horse.homeTrack?.name || "Unknown",
      statistics: {
        startPoints: data.horse.statistics?.life?.startPoints || 0,
        earningsPerStart: calculateEarningsPerStart(
          data.horse.statistics?.life?.earnings || 0,
          data.horse.statistics?.life?.starts || 1
        ),
        placePercentage: data.horse.statistics?.life?.placePercentage || 0,
        winPercentage: data.horse.statistics?.life?.winPercentage || 0
      },
      driver: {
        firstName: data.driver.firstName,
        lastName: data.driver.lastName,
        winPercentage: data.driver.statistics?.winPercentage || 0,
        winPercentage2025: data.driver.statistics?.year2025?.winPercentage || data.driver.statistics?.thisYear?.winPercentage || 0,
        experience: data.driver.statistics?.starts || 0
      }
    };
    
    return enhancedHorse;
    
  } catch (error) {
    console.error("Error fetching enhanced start data:", error);
    throw error;
  }
};
