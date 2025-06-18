
import { V75ActualResult } from '../types/postRaceAnalysisTypes';
import { formatKmTime } from '../utils/postRaceUtils';

export class V75ResultsFetcher {
  static async fetchActualResults(date: string): Promise<V75ActualResult[]> {
    console.log(`🏁 Fetching actual V75 results for ${date}`);
    
    try {
      // Step 1: Get V75 games for the date using the correct calendar endpoint
      console.log(`📅 Step 1: Fetching V75 games for date ${date}`);
      const calendarResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/day/${date}`);
      
      if (!calendarResponse.ok) {
        throw new Error(`Failed to fetch calendar: ${calendarResponse.statusText}`);
      }
      
      const calendarData = await calendarResponse.json();
      console.log('📅 Calendar response received:', {
        date: calendarData.date,
        hasGames: !!calendarData.games,
        v75Count: calendarData.games?.V75?.length || 0
      });
      
      // Find V75 games
      const v75Games = calendarData.games?.V75 || [];
      
      if (v75Games.length === 0) {
        throw new Error('No V75 games found for this date');
      }
      
      const v75Game = v75Games[0];
      console.log('🎯 V75 Game found:', {
        gameId: v75Game.id,
        raceCount: v75Game.races?.length || 0,
        raceIds: v75Game.races
      });
      
      if (!v75Game.races || v75Game.races.length === 0) {
        throw new Error('No races found in V75 game');
      }
      
      // Step 2: Fetch results for each race
      const results: V75ActualResult[] = [];
      
      for (let i = 0; i < v75Game.races.length; i++) {
        const raceId = v75Game.races[i];
        console.log(`🏇 Step 2.${i + 1}: Fetching results for race ${raceId}`);
        
        try {
          const raceResult = await this.fetchRaceResult(raceId, i);
          if (raceResult) {
            results.push(raceResult);
          }
        } catch (raceError) {
          console.error(`Error processing race ${raceId}:`, raceError);
          // Continue with other races
        }
      }
      
      console.log(`🏁 Results fetch complete: ${results.length}/${v75Game.races.length} races processed`);
      return results;
      
    } catch (error) {
      console.error('❌ Error fetching actual results:', error);
      throw error;
    }
  }

  private static async fetchRaceResult(raceId: string, raceIndex: number): Promise<V75ActualResult | null> {
    // First get race info to determine if results are available
    const raceInfoResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
    
    if (!raceInfoResponse.ok) {
      console.warn(`Failed to fetch race info for ${raceId}: ${raceInfoResponse.statusText}`);
      return null;
    }
    
    const raceInfo = await raceInfoResponse.json();
    console.log(`📋 Race ${raceId} info:`, {
      status: raceInfo.status,
      number: raceInfo.number,
      distance: raceInfo.distance,
      hasResults: !!raceInfo.results
    });
    
    // Check if race has finished and has results
    if (raceInfo.status !== 'FINISHED' && raceInfo.status !== 'RESULTS') {
      console.warn(`Race ${raceId} not finished yet (status: ${raceInfo.status})`);
      return null;
    }
    
    // Try multiple result endpoints
    let raceResults = null;
    const resultEndpoints = [
      `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/results`,
      `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/result`,
      `https://www.atg.se/services/racinginfo/v1/api/results/${raceId}`
    ];
    
    for (const endpoint of resultEndpoints) {
      try {
        console.log(`🔍 Trying results endpoint: ${endpoint}`);
        const resultResponse = await fetch(endpoint);
        
        if (resultResponse.ok) {
          raceResults = await resultResponse.json();
          console.log(`✅ Results found at ${endpoint}`);
          break;
        } else {
          console.log(`❌ Failed at ${endpoint}: ${resultResponse.statusText}`);
        }
      } catch (endpointError) {
        console.log(`❌ Error at ${endpoint}:`, endpointError);
      }
    }
    
    // If no results from endpoints, try to extract from race info
    if (!raceResults && raceInfo.results) {
      console.log(`📊 Using results from race info`);
      raceResults = { results: raceInfo.results };
    }
    
    if (!raceResults || !raceResults.results) {
      console.warn(`No results available for race ${raceId}`);
      return null;
    }
    
    // Process the results
    const finishOrder = (raceResults.results || [])
      .filter((result: any) => result.finalPosition && result.finalPosition > 0)
      .sort((a: any, b: any) => a.finalPosition - b.finalPosition)
      .map((result: any) => ({
        position: result.finalPosition,
        horseId: result.horse?.id || result.horseId || 0,
        horseName: result.horse?.name || result.horseName || 'Unknown',
        postPosition: result.postPosition || result.number || 0,
        time: result.kmTime ? formatKmTime(result.kmTime) : (result.time || 'N/A'),
        driver: result.driver ? 
          `${result.driver.firstName || ''} ${result.driver.lastName || ''}`.trim() : 
          'Unknown Driver'
      }));
    
    if (finishOrder.length === 0) {
      console.warn(`No valid finish positions found for race ${raceId}`);
      return null;
    }
    
    const actualResult: V75ActualResult = {
      raceId: raceId,
      raceNumber: raceInfo.number || (raceIndex + 1),
      finishOrder,
      raceTime: raceResults.raceTime || raceInfo.startTime || 'N/A',
      weather: raceResults.weather || raceInfo.weather,
      track: raceInfo.track?.name || 'Unknown',
      distance: raceInfo.distance || 0
    };
    
    console.log(`✅ Successfully processed race ${raceId} with ${finishOrder.length} horses`);
    return actualResult;
  }
}
