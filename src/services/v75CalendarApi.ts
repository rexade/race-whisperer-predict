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
    startNumber: number;
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
      /** True when the front shoe state differs from the horse's previous start (ATG native flag). */
      frontChanged?: boolean;
      backChanged?: boolean;
      /** False when the stable has not reported shoes for this start. */
      reported?: boolean;
    };
    sulky: {
      type: string;
    };
    /** Win (vinnare) odds at fetch time — live pre-race, final for completed games. */
    liveOdds?: number;
    /** Game-type bet distribution (spelprocent, e.g. 24.32 = 24.32% of bets). */
    betDistribution?: number;
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
  startNumber: number;
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
    /** True when the front shoe state differs from the horse's previous start (ATG native flag). */
    frontChanged?: boolean;
    backChanged?: boolean;
    /** False when the stable has not reported shoes for this start. */
    reported?: boolean;
  };
  sulky: {
    type: string;
  };
  /** Win (vinnare) odds at fetch time — live pre-race, final for completed games. */
  liveOdds?: number;
  /** Game-type bet distribution (spelprocent, e.g. 24.32 = 24.32% of bets). */
  betDistribution?: number;
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

const SUPPORTED_GAME_TYPES: readonly GameType[] = ['V75', 'V85', 'V86', 'V65'];

const isSupportedGameType = (value: string): value is GameType =>
  SUPPORTED_GAME_TYPES.includes(value as GameType);

/**
 * Return analyzer-supported game types that have at least one game on a given date.
 */
export const fetchAvailableGameTypes = async (date: string): Promise<GameType[]> => {
  try {
    const response = await fetch(`/api/atg/calendar/day/${date}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.games || typeof data.games !== 'object') return [];
    return Object.keys(data.games).filter(
      (key): key is GameType => isSupportedGameType(key)
        && Array.isArray(data.games[key])
        && data.games[key].length > 0
    );
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
    throw error;
  }
};

/**
 * Calculate earnings per start from total earnings and number of starts
 */
const calculateEarningsPerStart = (totalEarnings: number, totalStarts: number): number => {
  if (!totalStarts || totalStarts === 0) return 0;
  if (!totalEarnings || totalEarnings === 0) return 0;
  return Math.round((totalEarnings / totalStarts) * 100);
};

const finiteNumberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

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
      if (
        !raceData
        || typeof raceData.id !== 'string'
        || !gameInfo.raceIds.includes(raceData.id)
        || !Array.isArray(raceData.starts)
        || raceData.starts.length === 0
      ) {
        log.warn('Ignoring malformed or empty race payload:', raceData?.id ?? 'unknown race');
        continue;
      }

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

      const horses = raceData.starts.map((start: any) => extractHorseData(start, raceData.id, date));

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

  const missingRaceIds = gameInfo.raceIds.filter(
    raceId => !v75Races.some(race => race.raceId === raceId)
  );
  if (v75Races.length !== gameInfo.raceIds.length || missingRaceIds.length > 0) {
    throw new Error(
      `Incomplete ${gameType} race card for ${date}: fetched ${v75Races.length}/${gameInfo.raceIds.length} races`
      + (missingRaceIds.length > 0 ? `; missing ${missingRaceIds.join(', ')}` : '')
    );
  }

  log.info(`\n🏁 ${gameType} Race Data Fetch Complete: ${v75Races.length}/${gameInfo.raceIds.length} races successfully fetched`);

  // Market signals (vinnare odds, betDistribution) only exist in the game
  // payload — the per-race endpoint has no pools. One extra fetch per game
  // enriches every horse; failure is non-fatal (races stay usable without it).
  try {
    const gameResp = await fetch(`/api/atg/games/${gameInfo.gameId}`);
    if (gameResp.ok) {
      const game = await gameResp.json();
      for (const gr of game.races ?? []) {
        const race = v75Races.find(r => r.raceId === gr.id);
        if (!race) continue;
        for (const st of gr.starts ?? []) {
          const marketStartNumber = st.number ?? st.postPosition;
          const horse = race.horses.find(h => h.startNumber === marketStartNumber);
          if (!horse) continue;
          const rawOdds = st.pools?.vinnare?.odds;
          if (typeof rawOdds === 'number' && rawOdds > 0) horse.liveOdds = rawOdds / 100;
          const marking = Object.values(st.pools ?? {}).find((p: any) => p && typeof p.betDistribution === 'number') as any;
          if (marking) horse.betDistribution = marking.betDistribution / 100;
        }
      }
    }
  } catch {
    log.warn('Game pools fetch failed — liveOdds/betDistribution unavailable for this game');
  }

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
const extractHorseData = (start: any, raceId: string, raceDate: string): V75HorseData => {
  // Only log detailed extraction if debug logic is enabled
  if (IS_DEBUG) {
    // console.log can be used here if we genuinely need tight loop debugging,
    // but ideally we keep it clean.
  }

  const shoesData = start.shoes || start.horse?.shoes || {};

  // Handle multiple possible shoes data formats from ATG API.
  // Current format nests objects: { reported, front: {hasShoe, changed}, back: {…} }.
  // Boolean(object) is always true, so the object form MUST be unwrapped via
  // .hasShoe — the old Boolean() coercion silently marked every horse as shod.
  const shoeValue = (v: any): boolean | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'object') return v.hasShoe !== undefined ? Boolean(v.hasShoe) : undefined;
    return Boolean(v);
  };
  const frontShoes = shoeValue(shoesData.front) ?? shoeValue(shoesData.frontShoes)
    ?? shoeValue(shoesData.frontShoe) ?? shoeValue(shoesData.f) ?? false;
  const backShoes = shoeValue(shoesData.back) ?? shoeValue(shoesData.backShoes)
    ?? shoeValue(shoesData.backShoe) ?? shoeValue(shoesData.b) ?? false;

  // Native ATG change flags — true when shoe state differs from previous start
  const frontChanged = typeof shoesData.front === 'object' ? Boolean(shoesData.front?.changed) : undefined;
  const backChanged = typeof shoesData.back === 'object' ? Boolean(shoesData.back?.changed) : undefined;
  const shoesReported = shoesData.reported !== undefined ? Boolean(shoesData.reported) : undefined;

  // Market signals from start-level pools (present live and on completed games).
  // vinnare odds arrive ×100 (866 = 8.66); betDistribution ×100 (2432 = 24.32%).
  const rawVinnareOdds = start.pools?.vinnare?.odds;
  const liveOdds = typeof rawVinnareOdds === 'number' && rawVinnareOdds > 0
    ? rawVinnareOdds / 100 : undefined;
  const poolKeys = start.pools ? Object.keys(start.pools) : [];
  const markingPool = poolKeys.map(k => start.pools[k]).find((p: any) => p && typeof p.betDistribution === 'number');
  const betDistribution = markingPool ? markingPool.betDistribution / 100 : undefined;

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

  // Enhanced driver statistics extraction — year-aware (prefer the race year,
  // fall back to previous year early in the season when current-year sample is empty)
  const parsedRaceYear = Number.parseInt(raceDate.slice(0, 4), 10);
  const raceYear = Number.isFinite(parsedRaceYear) ? parsedRaceYear : new Date().getFullYear();
  const currentYear = String(raceYear);
  const previousYear = String(raceYear - 1);
  const driverStats = start.driver?.statistics || {};
  const driverYearStats = start.driver?.statistics?.years?.[currentYear]
    || start.driver?.statistics?.years?.[previousYear] || {};

  // Trainer statistics extraction (same structure as driver).
  // ATG nests the trainer under the HORSE, not the start — a trainer belongs to
  // a horse, while a driver is booked per start. Reading start.trainer silently
  // yielded undefined on every race, so trainerPerformance (one of the largest
  // weights) contributed exactly zero. The start-level path is kept as a
  // fallback in case another endpoint shape supplies it there.
  const trainer = start.horse?.trainer || start.trainer;
  const trainerStats = trainer?.statistics || {};
  const trainerYearStats = trainer?.statistics?.years?.[currentYear]
    || trainer?.statistics?.years?.[previousYear] || {};

  // Enhanced horse statistics extraction
  const horseLifeStats = start.horse?.statistics?.life || {};
  const rawTotalEarnings = horseLifeStats.earnings ?? horseLifeStats.totalEarnings;
  const rawTotalStarts = horseLifeStats.starts ?? horseLifeStats.totalStarts;
  const hasEarningsData = Number.isFinite(rawTotalEarnings) && Number.isFinite(rawTotalStarts);
  const earningsPerStart = hasEarningsData
    ? calculateEarningsPerStart(rawTotalEarnings, rawTotalStarts)
    : 300000;

  const horseId = start.horse?.id ?? start.horse?.horseId ?? 0;
  const startNumber = start.number ?? start.postPosition ?? 0;
  const postPosition = start.postPosition ?? startNumber;

  return {
    horseKey: makeHorseKey(raceId, horseId, startNumber),
    horseId,
    name: start.horse?.name || 'Unknown Horse',
    startNumber,
    postPosition,
    distance: start.distance || 0,
    driver: {
      firstName: start.driver?.firstName || '',
      lastName: start.driver?.lastName || '',
      experience: driverStats.experience || 0,
      winPercentage: driverStats.winPercentage || 0,
      winPercentage2025: driverYearStats.winPercentage || 0,
    },
    statistics: {
      startPoints: finiteNumberOr(horseLifeStats.startPoints, 500),
      placePercentage: finiteNumberOr(horseLifeStats.placePercentage, 5000),
      winPercentage: finiteNumberOr(horseLifeStats.winPercentage, 1500),
      earningsPerStart,
    },
    shoes: {
      front: frontShoes,
      back: backShoes,
      frontChanged,
      backChanged,
      reported: shoesReported,
    },
    sulky: {
      type: sulkyType,
    },
    liveOdds,
    betDistribution,
    homeTrack: start.horse?.homeTrack || start.horse?.track || 'Unknown',
    birthYear: start.horse?.birthYear || start.horse?.birth_year || 0,
    age: start.horse?.age || undefined,
    // ATG sex codes: S=sto (mare), H=hingst (stallion), V=valack (gelding)
    sex: start.horse?.sex || start.horse?.gender || '',
    trainer: trainer ? {
      firstName: trainer.firstName || '',
      lastName: trainer.lastName || '',
      winPercentage: trainerStats.winPercentage || 0,
      winPercentage2025: trainerYearStats.winPercentage || 0,
    } : undefined,
  };
};
