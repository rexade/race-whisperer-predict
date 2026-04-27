/**
 * Live Odds Service — fetches and caches win-pool odds from ATG games endpoint.
 *
 * Used in prediction mode (not calibration) to provide a real-time market signal.
 * Odds change frequently, so the cache TTL is short (2 minutes).
 */

import { log } from '@/lib/logger';

interface LiveOddsEntry {
  /** horseId → win-pool odds */
  odds: Map<number, number>;
  fetchedAt: number;
}

const LIVE_ODDS_CACHE = new Map<string, LiveOddsEntry>();
const LIVE_ODDS_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Fetch live win-pool odds for all horses in a game.
 * Returns a Map of horseId → odds number (e.g. 4.5 means 4.5x).
 *
 * @param gameId  The ATG game ID (e.g. "V75_2026-04-26_Solvalla_1")
 * @param gameType  Game type prefix (e.g. "V75", "V85")
 */
export async function fetchLiveOdds(
  gameId: string,
  gameType: string = 'V75'
): Promise<Map<number, number>> {
  const cacheKey = `${gameType}_${gameId}`;

  const cached = LIVE_ODDS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < LIVE_ODDS_TTL_MS) {
    log.debug(`[liveOdds] Cache hit for ${cacheKey}`);
    return cached.odds;
  }

  try {
    const response = await fetch(`/api/atg/games/${gameType}_${gameId}`);
    if (!response.ok) {
      log.warn(`[liveOdds] Failed to fetch: ${response.statusText}`);
      return cached?.odds ?? new Map();
    }

    const data = await response.json();
    const oddsMap = new Map<number, number>();

    // ATG games endpoint structure: races[].starts[].pools.vinnare.odds
    for (const race of data.races ?? []) {
      for (const start of race.starts ?? []) {
        const horseId = start.horse?.id;
        const winOdds = start.pools?.vinnare?.odds;
        if (horseId && winOdds != null && Number.isFinite(winOdds) && winOdds > 0) {
          oddsMap.set(horseId, winOdds);
        }
      }
    }

    log.debug(`[liveOdds] Fetched ${oddsMap.size} odds entries for ${cacheKey}`);
    LIVE_ODDS_CACHE.set(cacheKey, { odds: oddsMap, fetchedAt: Date.now() });
    return oddsMap;
  } catch (error) {
    log.warn('[liveOdds] Fetch error:', error);
    return cached?.odds ?? new Map();
  }
}

/**
 * Get live odds for a specific horse. Returns undefined if not available.
 */
export function getLiveOddsForHorse(
  oddsMap: Map<number, number>,
  horseId: number
): number | undefined {
  return oddsMap.get(horseId);
}

export function clearLiveOddsCache(): void {
  LIVE_ODDS_CACHE.clear();
}
