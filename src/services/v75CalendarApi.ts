import { GAME_TYPE, IS_DEBUG, GameType } from "@/config/game";
import { log } from "@/lib/logger";
import { fetchRaceById } from "@/services/raceDataCache";
import { makeHorseKey } from "@/services/horseIdentity";

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
    horseKey: string;
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
    birthYear?: number;
    /** Direct age from API (more reliable than birthYear which is often 0). */
    age?: number;
    sex?: string;
    trainer?: {
      firstName: string;
      lastName: string;
      winPercentage: number;
      winPercentage2025: number;
    };
  }>;
}

export interface V75HorseData {
  horseKey: string;
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
    earningsPerStartRank?: number; // Added for ranking
  };
  shoes: {
    front: boolean;
    back: boolean;
  };
  sulky: {
    type: string;
  };
  homeTrack: any; // Keep as any for now due to API inconsistency
  birthYear?: number;
  /** Direct age from API (more reliable than birthYear which is often 0). */
  age?: number;
  sex?: string;
  trainer?: {
    firstName: string;
    lastName: string;
    winPercentage: number;
    winPercentage2025: number;
  };
}

/**
 * Return all game type keys that have at least one game on a given date.
 * e.g. ["V75", "V86", "GS75"] — whatever ATG lists in data.games
 */
export const fetchAvailableGameTypes = async (date: string): Promise<string[]> => {
  try {
    const response = await fetch(`/api/atg/calendar/day/${date}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.games || typeof data.games !== 'object') return [];
    return Object.keys(data.games).filter(k => Array.isArray(data.games[k]) && data.games[k].length > 0);
  } catch {
    return [];
  }
};

/**
 * Fetch game information for a specific date and game type
 */
export const fetchV75GameInfo = async (date: string, gameType: GameType = GAME_TYPE): Promise<V75GameInfo | null> => {
  try {
    log.debug(`🔍 Fetching ${gameType} game info for ${date}...`);

    const response = await fetch(`/api/atg/calendar/day/${date}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar data: ${response.statusText}`);
    }

    const data = await response.json();
    log.debug('📅 Calendar API response received:', {
      date: data.date,
      targetGames: data.games?.[gameType]?.length || 0
    });

    // Look for target games in the response
    const v75Games = data.games?.[gameType];

    if (!v75Games || v75Games.length === 0) {
      log.debug(`❌ No ${gameType} games found for ${date}`);
      return null;
    }

    // Take the first game (there should typically be only one per day)
    const v75Game = v75Games[0];

    log.debug(`🎯 ${gameType} Game found:`, {
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
    log.error(`❌ Error fetching ${gameType} game info:`, error);
    return null;
  }
};

/**
 * Calculate earnings per start from total earnings and number of starts
 */
const calculateEarningsPerStart = (totalEarnings: number, totalStarts: number): number => {
  if (!totalStarts || totalStarts === 0) return 0;
  if (!totalEarnings || totalEarnings === 0) return 0;
  return totalEarnings / totalStarts;
};

/**
 * Fetch race data for a specific game info
 * This avoids double-fetching the calendar/game info
 */
export const fetchRaceDataForGame = async (
  date: string,
  gameInfo: V75GameInfo,
  gameType: GameType = GAME_TYPE
): Promise<V75RaceData[]> => {
  log.info(`\n=== 🏇 Starting ${gameType} Race Data Fetch for ${date} ===`);
  log.info(`✅ Using existing game info: ${gameInfo.gameId}`);
  log.debug(`📋 Race IDs to fetch: ${gameInfo.raceIds.join(', ')}`);

  const v75Races: V75RaceData[] = [];

  // Fetch races in parallel (uses centralized race cache)
  const results = await Promise.allSettled(
    gameInfo.raceIds.map(async (raceId, index) => {
      log.debug(`\n--- 🔍 Fetching race ${index + 1}/${gameInfo.raceIds.length}: ${raceId} ---`);
      return fetchRaceById(raceId) as Promise<any>;
    })
  );

  for (const res of results) {
    if (res.status !== "fulfilled") {
      log.warn("Race fetch failed:", res.reason);
      continue;
    }
    const raceData = res.value;

    try {
      log.debug(`✅ Race data received for ${raceData.id}:`, {
        name: raceData.name,
        distance: raceData.distance,
        startMethod: raceData.startMethod,
        track: raceData.track?.name,
        horseCount: raceData.starts?.length || 0
      });

      // Sulky debugging only if debug is enabled
      if (IS_DEBUG && raceData.starts && raceData.starts.length > 0) {
        log.debug(`\n🛷 COMPREHENSIVE SULKY DEBUG for race ${raceData.id}`);
        // ... abbreviated debug logic ...
      }

      const horses = (raceData.starts || []).map((start: any) => extractHorseData(start, raceData.id));

      v75Races.push({
        raceId: raceData.id,
        raceNumber: raceData.number,
        distance: raceData.distance,
        startMethod: raceData.startMethod,
        track: raceData.track?.name || gameInfo.track,
        name: raceData.name,
        date: date,
        prize: raceData.terms?.pools?.find((p: any) => p.betType === gameType)?.prize || 0,
        horses
      });

    } catch (error) {
      log.error(`❌ Error processing race ${raceData.id}:`, error);
    }
  }

  log.info(`\n🏁 ${gameType} Race Data Fetch Complete: ${v75Races.length}/${gameInfo.raceIds.length} races successfully fetched`);

  return v75Races.sort((a, b) => a.raceNumber - b.raceNumber);
};



/**
 * Fetch available V75 dates for a given month
 */
export const fetchV75CalendarDates = async (year: number, month: number, gameType: GameType = GAME_TYPE): Promise<V75CalendarDate[]> => {
  try {
    // Format: YYYY-MM
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const response = await fetch(`/api/atg/calendar/month/${monthStr}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${gameType} calendar: ${response.statusText}`);
    }

    const data = await response.json();

    const v75Dates: V75CalendarDate[] = [];

    if (data.calendarDays) {
      for (const day of data.calendarDays) {
        const v75Events = day.events?.filter((event: any) =>
          event.eventType === gameType || event.name?.includes(gameType)
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
              prize: race.terms?.pools?.find((p: any) => p.betType === gameType)?.prize || 0
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
    log.error(`Error fetching ${gameType} calendar:`, error);
    return [];
  }
};

/**
 * Extract horse data
 */
const extractHorseData = (start: any, raceId: string): V75HorseData => {
  // Only log detailed extraction if debug logic is enabled
  if (IS_DEBUG) {
    // console.log can be used here if we genuinely need tight loop debugging,
    // but ideally we keep it clean.
  }

  const shoesData = start.shoes || start.horse?.shoes || {};

  // Handle multiple possible shoes data formats from ATG API
  let frontShoes = false;
  let backShoes = false;

  // Check various possible property paths for front shoes
  if (shoesData.front !== undefined) frontShoes = Boolean(shoesData.front);
  else if (shoesData.frontShoes !== undefined) frontShoes = Boolean(shoesData.frontShoes);
  else if (shoesData.frontShoe !== undefined) frontShoes = Boolean(shoesData.frontShoe);
  else if (shoesData.f !== undefined) frontShoes = Boolean(shoesData.f);

  // Check various possible property paths for back shoes
  if (shoesData.back !== undefined) backShoes = Boolean(shoesData.back);
  else if (shoesData.backShoes !== undefined) backShoes = Boolean(shoesData.backShoes);
  else if (shoesData.backShoe !== undefined) backShoes = Boolean(shoesData.backShoe);
  else if (shoesData.b !== undefined) backShoes = Boolean(shoesData.b);

  // Sulky extraction
  let sulkyType = 'VA'; // Default to Vanlig (normal)

  const extractSafeString = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.includes('[object Object]')) return value.trim();
    if (typeof value === 'object') {
      if (value.code && typeof value.code === 'string') return value.code;
      if (value.type && typeof value.type === 'string') return value.type;
      if (value.name && typeof value.name === 'string') return value.name;
    }
    return null;
  };

  // Try different paths
  const sulkyPaths = [
    start.sulky?.type,
    start.horse?.sulky?.type,
    start.equipment?.sulky?.type,
    start.sulky?.code,
    start.horse?.sulky?.code,
    start.equipment?.sulky?.code,
    start.sulky?.category,
    start.horse?.sulky?.category,
    start.sulky?.name,
    start.horse?.sulky?.name,
    start.equipment?.sulky?.name
  ];

  for (const val of sulkyPaths) {
    const extracted = extractSafeString(val);
    if (extracted) {
      sulkyType = extracted;
      break;
    }
  }

  // Enhanced driver statistics extraction — year-aware (prefer current year)
  const currentYear = String(new Date().getFullYear());
  const driverStats = start.driver?.statistics || {};
  const driver2025Stats = start.driver?.statistics?.years?.[currentYear]
    || start.driver?.statistics?.years?.['2025'] || {};

  // Trainer statistics extraction (same structure as driver)
  const trainerStats = start.trainer?.statistics || {};
  const trainer2025Stats = start.trainer?.statistics?.years?.[currentYear]
    || start.trainer?.statistics?.years?.['2025'] || {};

  // Enhanced horse statistics extraction
  const horseLifeStats = start.horse?.statistics?.life || {};
  const totalEarnings = horseLifeStats.earnings || horseLifeStats.totalEarnings || 0;
  const totalStarts = horseLifeStats.starts || horseLifeStats.totalStarts || 0;
  const earningsPerStart = calculateEarningsPerStart(totalEarnings, totalStarts);

  const horseId = start.horse?.id ?? start.horse?.horseId ?? 0;
  const postPosition = start.number || start.postPosition || 0;

  return {
    horseKey: makeHorseKey(raceId, horseId, postPosition),
    horseId,
    name: start.horse?.name || 'Unknown Horse',
    postPosition,
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
    homeTrack: start.horse?.homeTrack || start.horse?.track || 'Unknown',
    birthYear: start.horse?.birthYear || start.horse?.birth_year || 0,
    age: start.horse?.age || undefined,
    // ATG sex codes: S=sto (mare), H=hingst (stallion), V=valack (gelding)
    sex: start.horse?.sex || start.horse?.gender || '',
    trainer: start.trainer ? {
      firstName: start.trainer.firstName || '',
      lastName: start.trainer.lastName || '',
      winPercentage: trainerStats.winPercentage || 0,
      winPercentage2025: trainer2025Stats.winPercentage || 0,
    } : undefined,
  };
};
