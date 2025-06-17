
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
    name: string;
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
    homeTrack: string;
  }>;
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
 * Fetch V75 race data using the game info and individual race endpoints
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
        
        const horses = raceData.starts?.map((start: any) => ({
          horseId: start.horse.id,
          name: start.horse.name,
          postPosition: start.postPosition,
          distance: start.distance,
          driver: {
            firstName: start.driver.firstName,
            lastName: start.driver.lastName,
            experience: start.driver.statistics?.experience || 0,
            winPercentage: start.driver.statistics?.winPercentage || 0,
            winPercentage2025: start.driver.statistics?.years?.['2025']?.winPercentage || 0,
          },
          statistics: {
            startPoints: start.horse.statistics?.startPoints || 0,
            placePercentage: start.horse.statistics?.placePercentage || 0,
            winPercentage: start.horse.statistics?.winPercentage || 0,
            earningsPerStart: start.horse.statistics?.earningsPerStart || 0,
          },
          shoes: {
            front: start.horse.shoes?.front || false,
            back: start.horse.shoes?.back || false,
          },
          sulky: {
            type: start.sulky?.type || 'VA',
          },
          homeTrack: start.horse.homeTrack || 'Unknown'
        })) || [];
        
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
