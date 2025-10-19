// Target game type - change to 'V75', 'V86', 'V65' etc. as needed
const TARGET_GAME = 'V85';

export interface V75CalendarDate {
  date: string; // YYYY-MM-DD format
  eventName: string;
  races: V75RaceInfo[];
}

export interface V75RaceInfo {
  raceId: string;
  raceNumber: number;
  startTime: string;
  distance: number;
  startMethod: string;
  track: string;
  name: string;
  prize: number;
}

export interface V75GameInfo {
  gameId: string;
  raceIds: string[];
  startTime: string;
  jackpotAmount: number;
  track: string;
}

export interface V75RaceData {
  raceId: string;
  raceNumber: number;
  distance: number;
  startMethod: string;
  track: string;
  name: string;
  date: string;
  prize: number;
  horses: Array<{
    horseId: number;
    name: any; // Keep as any for now due to API inconsistency
    postPosition: number;
    distance: number;
    driver: {
      firstName: string;
      lastName: string;
      experience: number;
      winPercentage: number;
      winPercentage2025: number;
    };
    statistics: {
      startPoints: number;
      placePercentage: number;
      winPercentage: number;
      earningsPerStart: number;
    };
    shoes: {
      front: boolean;
      back: boolean;
    };
    sulky: {
      type: string;
    };
    homeTrack: any; // Keep as any for now due to API inconsistency
  }>;
}

export interface V75HorseData {
  horseId: number;
  name: any; // Keep as any for now due to API inconsistency
  postPosition: number;
  distance: number;
  driver: {
    firstName: string;
    lastName: string;
    experience: number;
    winPercentage: number;
    winPercentage2025: number;
  };
  statistics: {
    startPoints: number;
    placePercentage: number;
    winPercentage: number;
    earningsPerStart: number;
  };
  shoes: {
    front: boolean;
    back: boolean;
  };
  sulky: {
    type: string;
  };
  homeTrack: any; // Keep as any for now due to API inconsistency
}

/**
 * Fetch V75 game information for a specific date
 */
export const fetchV75GameInfo = async (date: string): Promise<V75GameInfo | null> => {
  try {
    console.log(`🔍 Fetching V75 game info for ${date}...`);
    
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/day/${date}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar data: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📅 Calendar API response received:', {
      date: data.date,
      targetGames: data.games?.[TARGET_GAME]?.length || 0
    });
    
    // Look for target games in the response
    const v75Games = data.games?.[TARGET_GAME];
    
    if (!v75Games || v75Games.length === 0) {
      console.log(`❌ No ${TARGET_GAME} games found for ${date}`);
      return null;
    }
    
    // Take the first game (there should typically be only one per day)
    const v75Game = v75Games[0];
    
    console.log(`🎯 ${TARGET_GAME} Game found:`, {
      gameId: v75Game.id,
      raceCount: v75Game.races?.length || 0,
      raceIds: v75Game.races,
      startTime: v75Game.startTime,
      jackpot: v75Game.jackpotAmount
    });
    
    // Get track name from the tracks array
    const trackId = v75Game.tracks?.[0];
    const track = data.tracks?.find((t: any) => t.id === trackId);
    const trackName = track?.name || 'Unknown';
    
    return {
      gameId: v75Game.id,
      raceIds: v75Game.races || [],
      startTime: v75Game.startTime,
      jackpotAmount: v75Game.jackpotAmount || 0,
      track: trackName
    };
    
  } catch (error) {
    console.error('❌ Error fetching V75 game info:', error);
    return null;
  }
};

/**
 * Calculate earnings per start from total earnings and number of starts
 * FIXED: Using correct property paths and better error handling
 */
const calculateEarningsPerStart = (totalEarnings: number, totalStarts: number): number => {
  console.log(`💰 calculateEarningsPerStart - Input: totalEarnings=${totalEarnings}, totalStarts=${totalStarts}`);
  
  if (!totalStarts || totalStarts === 0) {
    console.log('⚠️ calculateEarningsPerStart - No starts, returning 0');
    return 0;
  }
  
  if (!totalEarnings || totalEarnings === 0) {
    console.log('⚠️ calculateEarningsPerStart - No earnings, returning 0');
    return 0;
  }
  
  const result = totalEarnings / totalStarts;
  console.log(`✅ calculateEarningsPerStart - Result: ${result}`);
  return result;
};

/**
 * Fetch V75 race data using the game info and individual race endpoints
 * ENHANCED: Added comprehensive sulky debugging and improved data extraction
 */
export const fetchV75RaceData = async (date: string): Promise<V75RaceData[]> => {
  try {
    console.log(`\n=== 🏇 Starting V75 Race Data Fetch for ${date} ===`);
    
    // First, get the V75 game info to identify the race IDs
    const gameInfo = await fetchV75GameInfo(date);
    
    if (!gameInfo) {
      console.log(`❌ No V75 game found for ${date}`);
      return [];
    }
    
    console.log(`✅ Found V75 game: ${gameInfo.gameId}`);
    console.log(`📋 Race IDs to fetch: ${gameInfo.raceIds.join(', ')}`);
    
    const v75Races: V75RaceData[] = [];
    
    // Fetch detailed data for each race in the V75 game
    for (let i = 0; i < gameInfo.raceIds.length; i++) {
      const raceId = gameInfo.raceIds[i];
      console.log(`\n--- 🔍 Fetching race ${i + 1}/7: ${raceId} ---`);
      
      try {
        const raceResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
        
        if (!raceResponse.ok) {
          console.error(`❌ Failed to fetch race ${raceId}: ${raceResponse.statusText}`);
          continue;
        }
        
        const raceData = await raceResponse.json();
        console.log(`✅ Race data received for ${raceId}:`, {
          name: raceData.name,
          distance: raceData.distance,
          startMethod: raceData.startMethod,
          track: raceData.track?.name,
          horseCount: raceData.starts?.length || 0
        });
        
        // ENHANCED DEBUG: Comprehensive sulky structure analysis
        if (raceData.starts && raceData.starts.length > 0) {
          console.log(`\n🛷 COMPREHENSIVE SULKY DEBUG for race ${raceId}:`);
          
          // Log the entire structure of the first few horses to understand API format
          for (let j = 0; j < Math.min(3, raceData.starts.length); j++) {
            const start = raceData.starts[j];
            console.log(`🛷 Horse ${j + 1} (${start.horse?.name}) COMPLETE STRUCTURE:`, {
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
          const sulkyAnalysis = raceData.starts.map((start: any, index: number) => {
            const possibleSulkyPaths = {
              horseSulky: start.horse?.sulky,
              startSulky: start.sulky,
              equipmentSulky: start.equipment?.sulky,
              driverSulky: start.driver?.sulky,
              horseSulkyType: start.horse?.sulky?.type,
              startSulkyType: start.sulky?.type,
              equipmentSulkyType: start.equipment?.sulky?.type
            };
            
            return {
              horseIndex: index,
              horseName: start.horse?.name,
              sulkyPaths: possibleSulkyPaths,
              foundSulkyData: Object.values(possibleSulkyPaths).some(val => val !== undefined && val !== null)
            };
          });
          
          console.log(`🛷 SULKY ANALYSIS for race ${raceId}:`, sulkyAnalysis);
          
          // Count horses with sulky data
          const horsesWithSulky = sulkyAnalysis.filter(h => h.foundSulkyData).length;
          console.log(`🛷 SULKY SUMMARY: ${horsesWithSulky}/${raceData.starts.length} horses have sulky data`);
        }
        
        const horses = raceData.starts?.map((start: any, startIndex: number) => {
          console.log(`🔍 Processing horse ${startIndex + 1}: ${start.horse?.name} (ID: ${start.horse?.id})`);
          
          // Extract horse statistics from the correct path: start.horse.statistics.life.*
          const horseLifeStats = start.horse?.statistics?.life || {};
          const driverStats = start.driver?.statistics || {};
          const driver2025Stats = start.driver?.statistics?.years?.['2025'] || {};
          
          // FIXED: Try both possible property paths for earnings
          const totalEarnings = horseLifeStats.earnings || horseLifeStats.totalEarnings || 0;
          const totalStarts = horseLifeStats.starts || horseLifeStats.totalStarts || 0;
          
          console.log(`📊 Horse ${start.horse?.name} CORRECTED earnings extraction:`, {
            horseLifeStats,
            earnings: horseLifeStats.earnings,
            totalEarnings: horseLifeStats.totalEarnings,
            finalEarnings: totalEarnings,
            starts: horseLifeStats.starts,
            totalStarts: horseLifeStats.totalStarts,
            finalStarts: totalStarts,
            startPoints: horseLifeStats.startPoints,
            placePercentage: horseLifeStats.placePercentage,
            winPercentage: horseLifeStats.winPercentage,
            driverExperience: driverStats.experience,
            driverWinPercentage: driverStats.winPercentage,
            driver2025WinPercentage: driver2025Stats.winPercentage
          });
          
          // Calculate earnings per start with FIXED property paths
          const earningsPerStart = calculateEarningsPerStart(totalEarnings, totalStarts);
          
          console.log(`💰 Horse ${start.horse?.name} CORRECTED earnings calculation:`, {
            totalEarnings,
            totalStarts,
            calculatedEarningsPerStart: earningsPerStart,
            earningsValid: earningsPerStart > 0,
            hasEarningsData: totalEarnings > 0 && totalStarts > 0
          });
          
          // Enhanced data validation and extraction
          const horseData = extractHorseData(start);
          
          console.log(`✅ Final processed horse data for ${start.horse?.name}:`, {
            horseId: horseData.horseId,
            name: horseData.name,
            statistics: horseData.statistics,
            driver: horseData.driver,
            earningsDataValid: horseData.statistics.earningsPerStart > 0,
            startPointsValid: horseData.statistics.startPoints > 0
          });
          
          return horseData;
        }) || [];
        
        console.log(`📈 Successfully processed ${horses.length} horses for race ${raceId}`);
        console.log(`💰 CORRECTED earnings validation: ${horses.filter(h => h.statistics.earningsPerStart > 0).length}/${horses.length} horses have valid earnings`);
        console.log(`🎯 Start points validation: ${horses.filter(h => h.statistics.startPoints > 0).length}/${horses.length} horses have valid start points`);
        
        v75Races.push({
          raceId: raceData.id,
          raceNumber: raceData.number,
          distance: raceData.distance,
          startMethod: raceData.startMethod,
          track: raceData.track?.name || gameInfo.track,
          name: raceData.name,
          date: date,
          prize: raceData.terms?.pools?.find((p: any) => p.betType === 'V75')?.prize || 0,
          horses
        });
        
      } catch (error) {
        console.error(`❌ Error fetching individual race ${raceId}:`, error);
        // Continue with other races even if one fails
      }
    }
    
    console.log(`\n🏁 V75 Race Data Fetch Complete: ${v75Races.length}/7 races successfully fetched`);
    console.log(`💰 FINAL earnings validation: ${v75Races.flatMap(r => r.horses).filter(h => h.statistics.earningsPerStart > 0).length} horses with valid earnings`);
    console.log(`🎯 FINAL start points validation: ${v75Races.flatMap(r => r.horses).filter(h => h.statistics.startPoints > 0).length} horses with valid start points`);
    
    return v75Races.sort((a, b) => a.raceNumber - b.raceNumber);
    
  } catch (error) {
    console.error('❌ Error in fetchV75RaceData:', error);
    return [];
  }
};

/**
 * Fetch available V75 dates for a given month
 */
export const fetchV75CalendarDates = async (year: number, month: number): Promise<V75CalendarDate[]> => {
  try {
    // Format: YYYY-MM
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/month/${monthStr}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch V75 calendar: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for V75 events and transform to our format
    const v75Dates: V75CalendarDate[] = [];
    
    if (data.calendarDays) {
      for (const day of data.calendarDays) {
        const v75Events = day.events?.filter((event: any) => 
          event.eventType === TARGET_GAME || event.name?.includes(TARGET_GAME)
        );
        
        if (v75Events && v75Events.length > 0) {
          for (const event of v75Events) {
            const races: V75RaceInfo[] = event.races?.map((race: any) => ({
              raceId: race.id,
              raceNumber: race.number,
              startTime: race.startTime,
              distance: race.distance,
              startMethod: race.startMethod,
              track: race.track?.name || 'Unknown',
              name: race.name,
              prize: race.terms?.pools?.find((p: any) => p.betType === TARGET_GAME)?.prize || 0
            })) || [];
            
            v75Dates.push({
              date: day.date,
              eventName: event.name,
              races
            });
          }
        }
      }
    }
    
    return v75Dates;
  } catch (error) {
    console.error('Error fetching V75 calendar:', error);
    return [];
  }
};

/**
 * ENHANCED: Extract horse data with comprehensive sulky debugging and improved property path checking
 */
const extractHorseData = (start: any): V75HorseData => {
  console.log('🐎 V75CalendarApi - Extracting horse data for horse:', start.horse?.name, 'ID:', start.horse?.id);
  
  // ENHANCED: Comprehensive shoes extraction with detailed logging
  const shoesData = start.shoes || start.horse?.shoes || {};
  console.log('👟 V75CalendarApi - Raw shoes data structure:', JSON.stringify(shoesData, null, 2));
  
  // Handle multiple possible shoes data formats from ATG API
  let frontShoes = false;
  let backShoes = false;
  
  // Check various possible property paths for front shoes
  if (shoesData.front !== undefined) {
    frontShoes = Boolean(shoesData.front);
    console.log('👟 Found front shoes in shoesData.front:', frontShoes);
  } else if (shoesData.frontShoes !== undefined) {
    frontShoes = Boolean(shoesData.frontShoes);
    console.log('👟 Found front shoes in shoesData.frontShoes:', frontShoes);
  } else if (shoesData.frontShoe !== undefined) {
    frontShoes = Boolean(shoesData.frontShoe);
    console.log('👟 Found front shoes in shoesData.frontShoe:', frontShoes);
  } else if (shoesData.f !== undefined) {
    frontShoes = Boolean(shoesData.f);
    console.log('👟 Found front shoes in shoesData.f:', frontShoes);
  } else {
    console.log('👟 No front shoes data found, defaulting to false');
  }
  
  // Check various possible property paths for back shoes
  if (shoesData.back !== undefined) {
    backShoes = Boolean(shoesData.back);
    console.log('👟 Found back shoes in shoesData.back:', backShoes);
  } else if (shoesData.backShoes !== undefined) {
    backShoes = Boolean(shoesData.backShoes);
    console.log('👟 Found back shoes in shoesData.backShoes:', backShoes);
  } else if (shoesData.backShoe !== undefined) {
    backShoes = Boolean(shoesData.backShoe);
    console.log('👟 Found back shoes in shoesData.backShoe:', backShoes);
  } else if (shoesData.b !== undefined) {
    backShoes = Boolean(shoesData.b);
    console.log('👟 Found back shoes in shoesData.b:', backShoes);
  } else {
    console.log('👟 No back shoes data found, defaulting to false');
  }
  
  console.log('👟 V75CalendarApi - FINAL shoes processing result:', { frontShoes, backShoes });
  
  // ENHANCED: Comprehensive sulky extraction with extensive property path checking and detailed logging
  console.log('🛷 V75CalendarApi - COMPREHENSIVE SULKY DEBUG for horse:', start.horse?.name);
  console.log('🛷 Full start object keys:', Object.keys(start || {}));
  console.log('🛷 Full horse object:', start.horse ? Object.keys(start.horse) : 'NO HORSE OBJECT');
  
  // Check ALL possible sulky data locations
  const sulkyDataSources = {
    startSulky: start.sulky,
    horseSulky: start.horse?.sulky,
    equipmentSulky: start.equipment?.sulky,
    driverSulky: start.driver?.sulky,
    startEquipment: start.equipment,
    horseEquipment: start.horse?.equipment
  };
  
  console.log('🛷 V75CalendarApi - ALL POSSIBLE sulky data sources:', JSON.stringify(sulkyDataSources, null, 2));
  
  let sulkyType = 'VA'; // Default to Vanlig (normal)
  let sulkySource = 'default';
  
  // ENHANCED: Safe sulky extraction with corruption detection
  const extractSafeString = (value: any, path: string): { value: string; isValid: boolean } => {
    if (value === null || value === undefined) {
      return { value: '', isValid: false };
    }
    
    if (typeof value === 'string') {
      // Check for corruption patterns
      if (value.includes('[object Object]') || value === '[object Object]') {
        console.error(`🚨 SULKY CORRUPTION detected at ${path}:`, value);
        return { value: '', isValid: false };
      }
      return { value: value.trim(), isValid: true };
    }
    
    if (typeof value === 'object') {
      // Try to extract string from object safely
      if (value.code && typeof value.code === 'string') {
        return extractSafeString(value.code, `${path}.code`);
      }
      if (value.type && typeof value.type === 'string') {
        return extractSafeString(value.type, `${path}.type`);
      }
      if (value.name && typeof value.name === 'string') {
        return extractSafeString(value.name, `${path}.name`);
      }
      
      console.warn(`🛷 Object found at ${path} but no extractable string:`, value);
      return { value: '', isValid: false };
    }
    
    // Convert other types to string with validation
    const stringValue = String(value);
    if (stringValue.includes('[object Object]')) {
      console.error(`🚨 CONVERSION CORRUPTION at ${path}:`, value, '→', stringValue);
      return { value: '', isValid: false };
    }
    
    return { value: stringValue, isValid: true };
  };
  
  // Try different paths with enhanced safety
  const sulkyPaths = [
    { path: 'start.sulky.type', value: start.sulky?.type },
    { path: 'start.horse.sulky.type', value: start.horse?.sulky?.type },
    { path: 'start.equipment.sulky.type', value: start.equipment?.sulky?.type },
    { path: 'start.sulky.code', value: start.sulky?.code },
    { path: 'start.horse.sulky.code', value: start.horse?.sulky?.code },
    { path: 'start.equipment.sulky.code', value: start.equipment?.sulky?.code },
    { path: 'start.sulky.category', value: start.sulky?.category },
    { path: 'start.horse.sulky.category', value: start.horse?.sulky?.category },
    { path: 'start.sulky.name', value: start.sulky?.name },
    { path: 'start.horse.sulky.name', value: start.horse?.sulky?.name },
    { path: 'start.equipment.sulky.name', value: start.equipment?.sulky?.name },
    { path: 'start.sulky', value: start.sulky },
    { path: 'start.horse.sulky', value: start.horse?.sulky }
  ];
  
  for (const { path, value } of sulkyPaths) {
    const extracted = extractSafeString(value, path);
    if (extracted.isValid && extracted.value) {
      sulkyType = extracted.value;
      sulkySource = path;
      console.log(`🛷 ✅ Found valid sulky type in ${path}:`, sulkyType);
      break;
    }
  }
  
  // If no valid sulky type found, log the failure
  if (sulkyType === 'VA' && sulkySource === 'default') {
    console.log('🛷 NO SULKY DATA FOUND! Using default VA. Checked paths:');
    console.log('  - start.sulky?.type:', start.sulky?.type);
    console.log('  - start.horse?.sulky?.type:', start.horse?.sulky?.type);
    console.log('  - start.equipment?.sulky?.type:', start.equipment?.sulky?.type);
    console.log('  - start.sulky?.category:', start.sulky?.category);
    console.log('  - start.horse?.sulky?.category:', start.horse?.sulky?.category);
    console.log('  - start.sulky?.name:', start.sulky?.name);
    console.log('  - start.horse?.sulky?.name:', start.horse?.sulky?.name);
    console.log('  - start.equipment?.sulky?.name:', start.equipment?.sulky?.name);
  }
  
  console.log('🛷 V75CalendarApi - FINAL sulky processing result:', { 
    sulkyType, 
    sulkySource,
    originalValue: sulkyDataSources[sulkySource as keyof typeof sulkyDataSources] 
  });
  
  // Enhanced driver statistics extraction
  const driverStats = start.driver?.statistics || {};
  const driver2025Stats = start.driver?.statistics?.years?.['2025'] || {};
  
  console.log('👨‍💼 Driver stats extraction:', {
    driverStats,
    driver2025Stats,
    winPercentage: driverStats.winPercentage,
    winPercentage2025: driver2025Stats.winPercentage
  });
  
  // Enhanced horse statistics extraction
  const horseLifeStats = start.horse?.statistics?.life || {};
  const totalEarnings = horseLifeStats.earnings || horseLifeStats.totalEarnings || 0;
  const totalStarts = horseLifeStats.starts || horseLifeStats.totalStarts || 0;
  const earningsPerStart = calculateEarningsPerStart(totalEarnings, totalStarts);
  
  console.log('🐎 Horse stats extraction:', {
    horseLifeStats,
    totalEarnings,
    totalStarts,
    earningsPerStart,
    startPoints: horseLifeStats.startPoints,
    placePercentage: horseLifeStats.placePercentage,
    winPercentage: horseLifeStats.winPercentage
  });
  
  const extractedData: V75HorseData = {
    horseId: start.horse?.id || start.horse?.horseId || 0,
    name: start.horse?.name || 'Unknown Horse',
    postPosition: start.number || start.postPosition || 0,
    distance: start.distance || 0,
    driver: {
      firstName: start.driver?.firstName || '',
      lastName: start.driver?.lastName || '',
      experience: driverStats.experience || 0,
      winPercentage: driverStats.winPercentage || 0,
      winPercentage2025: driver2025Stats.winPercentage || 0,
    },
    statistics: {
      startPoints: horseLifeStats.startPoints || 500,
      placePercentage: horseLifeStats.placePercentage || 5000,
      winPercentage: horseLifeStats.winPercentage || 1500,
      earningsPerStart: earningsPerStart || 300000,
    },
    shoes: {
      front: frontShoes,
      back: backShoes,
    },
    sulky: {
      type: sulkyType,
    },
    homeTrack: start.horse?.homeTrack || start.horse?.track || 'Unknown'
  };
  
  console.log('✅ V75CalendarApi - Final extracted horse data:', {
    horseId: extractedData.horseId,
    name: extractedData.name,
    shoesFront: extractedData.shoes.front,
    shoesBack: extractedData.shoes.back,
    sulkyType: extractedData.sulky.type,
    sulkySource: sulkySource,
    earningsPerStart: extractedData.statistics.earningsPerStart
  });
  
  return extractedData;
};
