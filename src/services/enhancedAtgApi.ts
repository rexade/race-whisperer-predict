export interface EnhancedHorseData {
  horseId: number;
  name: string;
  postPosition: number;
  distance: number;
  startMethod: string;
  shoes: {
    front: boolean;
    back: boolean;
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
  // Enhanced race-level data fields
  name: string;
  date: string;
  prize: number;
  raceType?: string; // New field for race type/classification
  startTime?: string; // New field for race start time
  horses: EnhancedHorseData[];
  dataQuality: {
    hasValidPostPositions: boolean;
    duplicatePositions: number[];
    missingData: string[];
  };
}

export const fetchEnhancedRaceData = async (raceId: string): Promise<EnhancedRaceData> => {
  console.log(`\n=== Fetching enhanced race data for: ${raceId} ===`);
  
  try {
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch race data: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("ATG Race Data received:", {
      raceId: data.id,
      startsCount: data.starts?.length || 0,
      distance: data.distance,
      startMethod: data.startMethod,
      name: data.name,
      date: data.date,
      prize: data.prize,
      raceType: data.raceType,
      startTime: data.startTime
    });
    
    // Extract race information including enhanced fields
    const raceInfo = {
      raceId: data.id,
      raceNumber: data.number,
      distance: data.distance,
      startMethod: data.startMethod,
      track: data.track.name,
      // Extract enhanced race data
      name: data.name || "Unknown Race",
      date: data.date || "Unknown Date", 
      prize: data.prize || 0,
      raceType: data.raceType || data.sport || "", // Try race type or sport classification
      startTime: data.startTime || data.scheduledStartTime || "", // Try multiple time fields
      horses: [] as EnhancedHorseData[],
      dataQuality: {
        hasValidPostPositions: true,
        duplicatePositions: [] as number[],
        missingData: [] as string[]
      }
    };
    
    // Track post positions to detect duplicates
    const postPositionMap = new Map<number, number>(); // position -> count
    const postPositions: number[] = [];
    
    console.log("\n=== Processing horse starts with enhanced data extraction ===");
    console.log(`Race type identified as: ${raceInfo.raceType}`);
    console.log(`Start time identified as: ${raceInfo.startTime}`);
    
    // Process each horse start - get ALL data from main race endpoint
    for (let index = 0; index < (data.starts || []).length; index++) {
      const start = data.starts[index];
      
      try {
        const postPos = start.postPosition;
        postPositions.push(postPos);
        postPositionMap.set(postPos, (postPositionMap.get(postPos) || 0) + 1);
        
        console.log(`Processing horse "${start.horse.name}" (ID: ${start.horse.id}) - Post Position: ${postPos}`);
        console.log(`  Horse distance: ${start.distance || data.distance}m vs Race distance: ${data.distance}m`);
        
        // Debug driver statistics structure
        console.log(`Driver statistics for ${start.driver.firstName} ${start.driver.lastName}:`, {
          statistics: start.driver.statistics,
          years: start.driver.statistics?.years,
          year2025: start.driver.statistics?.years?.['2025'],
          winPercentage2025: start.driver.statistics?.years?.['2025']?.winPercentage
        });
        
        // Get driver 2025 win percentage from correct path
        const winPercentage2025 = start.driver.statistics?.years?.['2025']?.winPercentage || 0;
        
        console.log(`Driver 2025 win percentage resolved to: ${winPercentage2025}% from path: statistics.years.2025.winPercentage`);
        
        // Debug shoes structure
        console.log(`Shoes data for ${start.horse.name}:`, {
          shoes: start.horse.shoes,
          front: start.horse.shoes?.front,
          back: start.horse.shoes?.back,
          frontHasShoe: start.horse.shoes?.front?.hasShoe,
          backHasShoe: start.horse.shoes?.back?.hasShoe
        });
        
        const enhancedHorse: EnhancedHorseData = {
          horseId: start.horse.id,
          name: start.horse.name,
          postPosition: postPos,
          distance: start.distance || data.distance, // Individual horse distance (important for volte starts)
          startMethod: data.startMethod,
          shoes: {
            front: start.horse.shoes?.front?.hasShoe || false,
            back: start.horse.shoes?.back?.hasShoe || false
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
            winPercentage2025: winPercentage2025,
            experience: start.driver.statistics?.starts || 0
          }
        };
        
        raceInfo.horses.push(enhancedHorse);
        
      } catch (error) {
        console.error(`Error processing horse ${start.horse?.name || 'Unknown'} at index ${index}:`, error);
        raceInfo.dataQuality.missingData.push(`Horse at position ${start.postPosition}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Validate post positions and detect duplicates
    console.log("\n=== Post Position Analysis ===");
    console.log("Post positions found:", postPositions);
    
    const duplicatePositions: number[] = [];
    postPositionMap.forEach((count, position) => {
      if (count > 1) {
        duplicatePositions.push(position);
        console.warn(`⚠️  DUPLICATE POST POSITION DETECTED: Position ${position} appears ${count} times`);
      }
    });
    
    raceInfo.dataQuality.duplicatePositions = duplicatePositions;
    raceInfo.dataQuality.hasValidPostPositions = duplicatePositions.length === 0;
    
    if (duplicatePositions.length > 0) {
      console.error(`❌ Race data quality issue: Found ${duplicatePositions.length} duplicate post positions`);
      raceInfo.dataQuality.hasValidPostPositions = false;
    } else {
      console.log("✅ All post positions are unique");
    }
    
    // Validate expected vs actual horse count
    const expectedHorses = Math.max(...postPositions);
    const actualHorses = raceInfo.horses.length;
    
    console.log(`Expected horses (max post position): ${expectedHorses}`);
    console.log(`Actual horses processed: ${actualHorses}`);
    
    if (expectedHorses !== actualHorses) {
      console.warn(`⚠️  Horse count mismatch: Expected ${expectedHorses}, got ${actualHorses}`);
    }
    
    console.log(`\n✅ Enhanced race data processed: ${raceInfo.horses.length} horses with enhanced factors`);
    console.log(`   Race Type: ${raceInfo.raceType || 'Not specified'}`);
    console.log(`   Start Time: ${raceInfo.startTime || 'Not specified'}`);
    console.log(`   Data Quality: ${raceInfo.dataQuality.hasValidPostPositions ? 'GOOD' : 'ISSUES'}`);
    
    return raceInfo;
    
  } catch (error) {
    console.error("❌ Error fetching enhanced race data:", error);
    throw error;
  }
};

const calculateEarningsPerStart = (totalEarnings: number, totalStarts: number): number => {
  if (totalStarts === 0) return 0;
  return Math.round(totalEarnings / totalStarts);
};

// Remove fetchEnhancedStartData function - we only use main race endpoint for horse data
