// Target game type - change to 'V75', 'V86', 'V65' etc. as needed
const TARGET_GAME = 'V85';

import { V75ActualResult } from '../types/postRaceAnalysisTypes';
import { formatKmTime } from '../utils/postRaceUtils';
import { parseActualTime, findBestTime } from '../utils/timeAnalysisUtils';
import { log } from '@/lib/logger';
import { IS_DEBUG } from '@/config/game';

export class V75ResultsFetcher {
  static async fetchActualResults(date: string): Promise<V75ActualResult[]> {
    log.debug(`🏁 Fetching actual ${TARGET_GAME} results for ${date}`);

    try {
      // Step 1: Get games for the date using the correct calendar endpoint
      log.debug(`📅 Step 1: Fetching ${TARGET_GAME} games for date ${date}`);
      const calendarResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/day/${date}`);

      if (!calendarResponse.ok) {
        throw new Error(`Failed to fetch calendar: ${calendarResponse.statusText}`);
      }

      const calendarData = await calendarResponse.json();
      log.debug('📅 Calendar response received:', {
        date: calendarData.date,
        hasGames: !!calendarData.games,
        targetCount: calendarData.games?.[TARGET_GAME]?.length || 0
      });

      // Find target games
      const v75Games = calendarData.games?.[TARGET_GAME] || [];

      if (v75Games.length === 0) {
        throw new Error(`No ${TARGET_GAME} games found for this date`);
      }

      const v75Game = v75Games[0];
      log.debug(`🎯 ${TARGET_GAME} Game found:`, {
        gameId: v75Game.id,
        raceCount: v75Game.races?.length || 0,
        raceIds: v75Game.races
      });

      if (!v75Game.races || v75Game.races.length === 0) {
        throw new Error(`No races found in ${TARGET_GAME} game`);
      }

      // Step 2: Fetch results for each race
      const results: V75ActualResult[] = [];

      for (let i = 0; i < v75Game.races.length; i++) {
        const raceId = v75Game.races[i];
        log.debug(`🏇 Step 2.${i + 1}: Fetching results for race ${raceId}`);

        try {
          const raceResult = await this.fetchRaceResult(raceId, i);
          if (raceResult) {
            results.push(raceResult);
          }
        } catch (raceError) {
          log.error(`Error processing race ${raceId}:`, raceError);
          // Continue with other races
        }
      }

      log.debug(`🏁 Results fetch complete: ${results.length}/${v75Game.races.length} races processed`);
      return results;

    } catch (error) {
      log.error('❌ Error fetching actual results:', error);
      throw error;
    }
  }

  private static async fetchRaceResult(raceId: string, raceIndex: number): Promise<V75ActualResult | null> {
    // First get race info to determine if results are available
    const raceInfoResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);

    if (!raceInfoResponse.ok) {
      log.warn(`Failed to fetch race info for ${raceId}: ${raceInfoResponse.statusText}`);
      return null;
    }

    const raceInfo = await raceInfoResponse.json();
    log.debug(`📋 Race ${raceId} info:`, {
      status: raceInfo.status,
      number: raceInfo.number,
      distance: raceInfo.distance,
      hasResults: !!raceInfo.results,
      hasStarts: !!raceInfo.starts
    });

    // FIXED: Case-insensitive status check and broader acceptance criteria
    const raceStatus = (raceInfo.status || '').toLowerCase();
    const isRaceFinished = raceStatus === 'finished' ||
      raceStatus === 'results' ||
      raceStatus === 'result' ||
      raceStatus === 'completed';

    log.debug(`🔍 Race ${raceId} status check:`, {
      originalStatus: raceInfo.status,
      normalizedStatus: raceStatus,
      isFinished: isRaceFinished
    });

    // Check if race has finished and has results
    if (!isRaceFinished) {
      log.warn(`Race ${raceId} not finished yet (status: ${raceInfo.status})`);
      return null;
    }

    // ENHANCED: Multiple strategies for finding results data
    let raceResults = null;
    let resultsSource = '';

    // Strategy 1: Try dedicated results endpoints
    const resultEndpoints = [
      `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/results`,
      `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/result`,
      `https://www.atg.se/services/racinginfo/v1/api/results/${raceId}`
    ];

    for (const endpoint of resultEndpoints) {
      try {
        log.debug(`🔍 Trying results endpoint: ${endpoint}`);
        const resultResponse = await fetch(endpoint);

        if (resultResponse.ok) {
          const endpointData = await resultResponse.json();
          if (endpointData && (endpointData.results || endpointData.starts)) {
            raceResults = endpointData;
            resultsSource = endpoint;
            log.debug(`✅ Results found at ${endpoint}`);
            break;
          }
        } else {
          log.debug(`❌ Failed at ${endpoint}: ${resultResponse.statusText}`);
        }
      } catch (endpointError) {
        log.debug(`❌ Error at ${endpoint}:`, endpointError);
      }
    }

    // Strategy 2: Extract from race info if available
    if (!raceResults && raceInfo.results && Array.isArray(raceInfo.results) && raceInfo.results.length > 0) {
      log.debug(`📊 Using results from race info (${raceInfo.results.length} horses)`);
      raceResults = { results: raceInfo.results };
      resultsSource = 'race info results';
    }

    // Strategy 3: Extract from starts in race info (for live results)
    if (!raceResults && raceInfo.starts && Array.isArray(raceInfo.starts) && raceInfo.starts.length > 0) {
      // Check if starts have result data (finish positions)
      const startsWithResults = raceInfo.starts.filter((start: any) =>
        start.result && (start.result.finalPosition || start.result.finishOrder)
      );

      if (startsWithResults.length > 0) {
        log.debug(`📊 Using results from race starts (${startsWithResults.length} horses with results)`);
        raceResults = { results: raceInfo.starts };
        resultsSource = 'race info starts';
      }
    }

    if (!raceResults || (!raceResults.results && !raceResults.starts)) {
      log.warn(`❌ No results data found for race ${raceId}`);
      log.debug(`🔍 Available data in race info:`, {
        hasResults: !!raceInfo.results,
        resultsType: typeof raceInfo.results,
        resultsLength: Array.isArray(raceInfo.results) ? raceInfo.results.length : 'not array',
        hasStarts: !!raceInfo.starts,
        startsLength: Array.isArray(raceInfo.starts) ? raceInfo.starts.length : 'not array'
      });
      return null;
    }

    log.debug(`✅ Results data source: ${resultsSource}`);

    // Process the results - handle both results and starts arrays
    const resultsArray = raceResults.results || raceResults.starts || [];

    const finishOrder = resultsArray
      .map((item: any) => {
        // Handle different result formats
        let position, horseId, horseName, postPosition, time, kmTime, driver;

        if (item.result) {
          // Format: starts with embedded result
          position = item.result.finalPosition || item.result.finishOrder;
          horseId = item.horse?.id || 0;
          horseName = item.horse?.name || 'Unknown';
          postPosition = item.number || item.postPosition || 0;
          time = item.result.kmTime ? formatKmTime(item.result.kmTime) : 'N/A';
          kmTime = item.result.kmTime || null;
          driver = item.driver ?
            `${item.driver.firstName || ''} ${item.driver.lastName || ''}`.trim() :
            'Unknown Driver';
        } else {
          // Format: direct results
          position = item.finalPosition || item.finishOrder || item.position;
          horseId = item.horse?.id || item.horseId || 0;
          horseName = item.horse?.name || item.horseName || 'Unknown';
          postPosition = item.postPosition || item.number || 0;
          time = item.kmTime ? formatKmTime(item.kmTime) : (item.time || 'N/A');
          kmTime = item.kmTime || parseActualTime(item.time || '');
          driver = item.driver ?
            `${item.driver.firstName || ''} ${item.driver.lastName || ''}`.trim() :
            'Unknown Driver';
        }

        return { position, horseId, horseName, postPosition, time, kmTime, driver };
      })
      .filter((result: any) => result.position && result.position > 0)
      .sort((a: any, b: any) => a.position - b.position);

    if (finishOrder.length === 0) {
      log.warn(`❌ No valid finish positions found for race ${raceId} from ${resultsSource}`);
      return null;
    }

    // Find the best time in the race
    const timesWithKmTime = finishOrder
      .filter((result: any) => result.kmTime)
      .map((result: any) => ({ horseId: result.horseId, time: result.kmTime }));

    const bestTimeResult = findBestTime(timesWithKmTime);

    const actualResult: V75ActualResult = {
      raceId: raceId,
      raceNumber: raceInfo.number || (raceIndex + 1),
      finishOrder,
      raceTime: raceResults.raceTime || raceInfo.startTime || 'N/A',
      weather: raceResults.weather || raceInfo.weather,
      track: raceInfo.track?.name || 'Unknown',
      distance: raceInfo.distance || 0,
      bestTime: bestTimeResult?.time
    };

    log.debug(`✅ Successfully processed race ${raceId} with ${finishOrder.length} horses and best time analysis (source: ${resultsSource})`);
    return actualResult;
  }
}
