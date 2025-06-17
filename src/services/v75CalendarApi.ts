
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

/**
 * Fetch V75 race data for a specific date
 */
export const fetchV75RaceData = async (date: string): Promise<V75RaceData[]> => {
  try {
    const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/day/${date}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch V75 race data: ${response.statusText}`);
    }
    
    const data = await response.json();
    const v75Races: V75RaceData[] = [];
    
    // Find V75 events for this date
    const v75Events = data.events?.filter((event: any) => 
      event.eventType === 'V75' || event.name?.includes('V75')
    );
    
    if (v75Events && v75Events.length > 0) {
      for (const event of v75Events) {
        if (event.races) {
          for (const race of event.races) {
            // Fetch detailed race data
            const raceResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${race.id}`);
            if (raceResponse.ok) {
              const raceData = await raceResponse.json();
              
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
                  winPercentage2025: start.driver.statistics?.winPercentage2025 || 0,
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
                raceId: race.id,
                raceNumber: race.number,
                distance: race.distance,
                startMethod: race.startMethod,
                track: race.track?.name || 'Unknown',
                name: race.name,
                date: date,
                prize: race.terms?.pools?.find((p: any) => p.betType === 'V75')?.prize || 0,
                horses
              });
            }
          }
        }
      }
    }
    
    return v75Races.sort((a, b) => a.raceNumber - b.raceNumber);
  } catch (error) {
    console.error('Error fetching V75 race data:', error);
    return [];
  }
};
