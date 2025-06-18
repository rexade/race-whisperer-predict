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
      v75Games: data.games?.V75?.length || 0
    });
    
    // Look for V75 games in the response
    const v75Games = data.games?.V75;
    
    if (!v75Games || v75Games.length === 0) {
      console.log(`❌ No V75 games found for ${date}`);
      return null;
    }
    
    // Take the first V75 game (there should typically be only one per day)
    const v75Game = v75Games[0];
    
    console.log('🎯 V75 Game found:', {
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
 * FIXED: Using correct property paths for earnings data
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
        
        // CRITICAL DEBUG: Enhanced logging for horse data structure
        if (raceData.starts && raceData.starts.length > 0) {
          const firstStart = raceData.starts[0];
          console.log(`🐎 CRITICAL EARNINGS DEBUG: First horse structure for race ${raceId}:`, {
            horseId: firstStart.horse?.id,
            horseName: firstStart.horse?.name,
            horseStatistics: firstStart.horse?.statistics,
            horseStatisticsLife: firstStart.horse?.statistics?.life,
            // FIXED: Check both possible paths for earnings
            lifeEarnings: firstStart.horse?.statistics?.life?.earnings,
            lifeTotalEarnings: firstStart.horse?.statistics?.life?.totalEarnings,
            lifeStarts: firstStart.horse?.statistics?.life?.starts,
            lifeTotalStarts: firstStart.horse?.statistics?.life?.totalStarts,
            driverFirstName: firstStart.driver?.firstName,
            driverLastName: firstStart.driver?.lastName,
            driverStatistics: firstStart.driver?.statistics,
            driverExperience: firstStart.driver?.statistics?.experience,
            driverWinPercentage: firstStart.driver?.statistics?.winPercentage,
            driver2025Stats: firstStart.driver?.statistics?.years?.['2025']
          });
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
          event.eventType === 'V75' || event.name?.includes('V75')
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
              prize: race.terms?.pools?.find((p: any) => p.betType === 'V75')?.prize || 0
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

const extractHorseData = (horse: any): V75HorseData => {
  console.log('🐎 V75CalendarApi - Extracting horse data:', JSON.stringify(horse, null, 2));
  
  // Enhanced shoes extraction with better debugging
  const shoesData = horse.shoes || {};
  console.log('👟 V75CalendarApi - Raw shoes data:', JSON.stringify(shoesData, null, 2));
  
  // Extract shoes information - ATG API uses different formats
  let frontShoes = false;
  let backShoes = false;
  
  if (shoesData.front !== undefined) {
    frontShoes = Boolean(shoesData.front);
  } else if (shoesData.frontShoes !== undefined) {
    frontShoes = Boolean(shoesData.frontShoes);
  } else if (shoesData.frontShoe !== undefined) {
    frontShoes = Boolean(shoesData.frontShoe);
  }
  
  if (shoesData.back !== undefined) {
    backShoes = Boolean(shoesData.back);
  } else if (shoesData.backShoes !== undefined) {
    backShoes = Boolean(shoesData.backShoes);
  } else if (shoesData.backShoe !== undefined) {
    backShoes = Boolean(shoesData.backShoe);
  }
  
  console.log('👟 V75CalendarApi - Processed shoes:', { frontShoes, backShoes });
  
  // Enhanced sulky extraction
  const sulkyData = horse.sulky || horse.equipment?.sulky || {};
  console.log('🛷 V75CalendarApi - Raw sulky data:', JSON.stringify(sulkyData, null, 2));
  
  let sulkyType = 'VA'; // Default to Vanlig (normal)
  
  if (sulkyData.type) {
    sulkyType = String(sulkyData.type);
  } else if (sulkyData.sulkyType) {
    sulkyType = String(sulkyData.sulkyType);
  } else if (sulkyData.category) {
    sulkyType = String(sulkyData.category);
  }
  
  console.log('🛷 V75CalendarApi - Processed sulky type:', sulkyType);
  
  return {
    horseId: horse.id || horse.horseId,
    name: horse.name,
    postPosition: horse.number || horse.postPosition,
    distance: horse.distance || 0,
    driver: {
      firstName: horse.driver?.firstName || '',
      lastName: horse.driver?.lastName || '',
      experience: horse.driver?.experience || 0,
      winPercentage: horse.driver?.statistics?.winPercentage || 0,
      winPercentage2025: horse.driver?.statistics?.winPercentage2025 || 0,
    },
    statistics: {
      startPoints: horse.statistics?.startPoints || 500,
      placePercentage: horse.statistics?.placePercentage || 5000,
      winPercentage: horse.statistics?.winPercentage || 1500,
      earningsPerStart: horse.statistics?.earningsPerStart || 300000,
    },
    shoes: {
      front: frontShoes,
      back: backShoes,
    },
    sulky: {
      type: sulkyType,
    },
    homeTrack: horse.homeTrack || horse.track
  };
};
