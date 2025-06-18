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

/**
 * ENHANCED: Fetch enhanced race data with comprehensive sulky debugging
 */
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
    
    // ENHANCED: Comprehensive sulky analysis for enhanced API
    if (data.starts && data.starts.length > 0) {
      console.log(`\n🛷 ENHANCED API COMPREHENSIVE SULKY DEBUG for race ${raceId}:`);
      
      // Log the entire structure of the first few horses to understand API format
      for (let j = 0; j < Math.min(3, data.starts.length); j++) {
        const start = data.starts[j];
        console.log(`🛷 Enhanced API - Horse ${j + 1} (${start.horse?.name}) COMPLETE STRUCTURE:`, {
          fullStart: JSON.stringify(start, null, 2),
          horse: start.horse,
          horseSulky: start.horse?.sulky,
          startSulky: start.sulky,
          equipment: start.equipment,
          equipmentSulky: start.equipment?.sulky,
          driver: start.driver,
          driverSulky: start.driver?.sulky
        });
      }
      
      // Check for sulky data across all horses
      const sulkyAnalysis = data.starts.map((start: any, index: number) => {
        const possibleSulkyPaths = {
          horseSulky: start.horse?.sulky,
          startSulky: start.sulky,
          equipmentSulky: start.equipment?.sulky,
          driverSulky: start.driver?.sulky,
          horseSulkyType: start.horse?.sulky?.type,
          startSulkyType: start.sulky?.type,
          equipmentSulkyType: start.equipment?.sulky?.type,
          horseSulkyTypeCode: start.horse?.sulky?.type?.code,
          startSulkyTypeCode: start.sulky?.type?.code,
          equipmentSulkyTypeCode: start.equipment?.sulky?.type?.code
        };
        
        return {
          horseIndex: index,
          horseName: start.horse?.name,
          sulkyPaths: possibleSulkyPaths,
          foundSulkyData: Object.values(possibleSulkyPaths).some(val => val !== undefined && val !== null)
        };
      });
      
      console.log(`🛷 Enhanced API SULKY ANALYSIS for race ${raceId}:`, sulkyAnalysis);
      
      // Count horses with sulky data
      const horsesWithSulky = sulkyAnalysis.filter(h => h.foundSulkyData).length;
      console.log(`🛷 Enhanced API SULKY SUMMARY: ${horsesWithSulky}/${data.starts.length} horses have sulky data`);
    }
    
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
        
        // ENHANCED: Debug shoes structure with detailed logging
        console.log(`Shoes data for ${start.horse.name}:`, {
          shoes: start.horse.shoes,
          front: start.horse.shoes?.front,
          back: start.horse.shoes?.back,
          frontHasShoe: start.horse.shoes?.front?.hasShoe,
          backHasShoe: start.horse.shoes?.back?.hasShoe
        });
        
        // ENHANCED: Comprehensive sulky debugging for enhanced API
        console.log(`🛷 Enhanced API - COMPREHENSIVE SULKY DEBUG for horse: ${start.horse.name}`);
        console.log(`🛷 Enhanced API - Full start object keys:`, Object.keys(start || {}));
        console.log(`🛷 Enhanced API - Full horse object:`, start.horse ? Object.keys(start.horse) : 'NO HORSE OBJECT');
        
        // Check ALL possible sulky data locations
        const sulkyDataSources = {
          startSulky: start.sulky,
          horseSulky: start.horse?.sulky,
          equipmentSulky: start.equipment?.sulky,
          driverSulky: start.driver?.sulky,
          startEquipment: start.equipment,
          horseEquipment: start.horse?.equipment,
          horseSulkyTypeCode: start.horse?.sulky?.type?.code,
          startSulkyTypeCode: start.sulky?.type?.code,
          equipmentSulkyTypeCode: start.equipment?.sulky?.type?.code
        };
        
        console.log(`🛷 Enhanced API - ALL POSSIBLE sulky data sources:`, JSON.stringify(sulkyDataSources, null, 2));
        
        let sulkyTypeCode = 'VA'; // Default to Vanlig (normal)
        let sulkySource = 'default';
        
        // Enhanced API often uses .type.code structure - check that first
        if (start.horse?.sulky?.type?.code) {
          sulkyTypeCode = String(start.horse.sulky.type.code);
          sulkySource = 'start.horse.sulky.type.code';
          console.log(`🛷 Enhanced API - Found sulky type in start.horse.sulky.type.code:`, sulkyTypeCode);
        } else if (start.sulky?.type?.code) {
          sulkyTypeCode = String(start.sulky.type.code);
          sulkySource = 'start.sulky.type.code';
          console.log(`🛷 Enhanced API - Found sulky type in start.sulky.type.code:`, sulkyTypeCode);
        } else if (start.equipment?.sulky?.type?.code) {
          sulkyTypeCode = String(start.equipment.sulky.type.code);
          sulkySource = 'start.equipment.sulky.type.code';
          console.log(`🛷 Enhanced API - Found sulky type in start.equipment.sulky.type.code:`, sulkyTypeCode);
        } else if (start.horse?.sulky?.type) {
          sulkyTypeCode = String(start.horse.sulky.type);
          sulkySource = 'start.horse.sulky.type';
          console.log(`🛷 Enhanced API - Found sulky type in start.horse.sulky.type:`, sulkyTypeCode);
        } else if (start.sulky?.type) {
          sulkyTypeCode = String(start.sulky.type);
          sulkySource = 'start.sulky.type';
          console.log(`🛷 Enhanced API - Found sulky type in start.sulky.type:`, sulkyTypeCode);
        } else if (start.equipment?.sulky?.type) {
          sulkyTypeCode = String(start.equipment.sulky.type);
          sulkySource = 'start.equipment.sulky.type';
          console.log(`🛷 Enhanced API - Found sulky type in start.equipment.sulky.type:`, sulkyTypeCode);
        } else {
          console.log(`🛷 Enhanced API - NO SULKY DATA FOUND! Using default VA. Checked paths:`, {
            'start.horse?.sulky?.type?.code': start.horse?.sulky?.type?.code,
            'start.sulky?.type?.code': start.sulky?.type?.code,
            'start.equipment?.sulky?.type?.code': start.equipment?.sulky?.type?.code,
            'start.horse?.sulky?.type': start.horse?.sulky?.type,
            'start.sulky?.type': start.sulky?.type,
            'start.equipment?.sulky?.type': start.equipment?.sulky?.type
          });
        }
        
        console.log(`🛷 Enhanced API - FINAL sulky processing result:`, { 
          sulkyTypeCode, 
          sulkySource,
          originalValue: sulkyDataSources[sulkySource as keyof typeof sulkyDataSources] 
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
            type: sulkyTypeCode
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
        
        console.log(`✅ Enhanced API - Final extracted horse data:`, {
          horseId: enhancedHorse.horseId,
          name: enhancedHorse.name,
          shoesFront: enhancedHorse.shoes.front,
          shoesBack: enhancedHorse.shoes.back,
          sulkyType: enhancedHorse.sulky.type,
          sulkySource: sulkySource,
          earningsPerStart: enhancedHorse.statistics.earningsPerStart
        });
        
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
