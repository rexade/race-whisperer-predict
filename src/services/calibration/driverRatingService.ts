/**
 * Driver Rating Service — per-driver empirical win rates from calibration data.
 *
 * Computes how often each driver actually wins V85/V75 races in our own dataset,
 * rather than relying on ATG's career-wide stat (which mixes all race formats).
 *
 * Bayesian smoothing: blends each driver's empirical rate with a 12% prior at
 * strength 10 — so a driver with 3 starts doesn't get 0% or 100%, they get
 * a sensible estimate close to average.
 *
 *   smoothed = (wins + PRIOR_WINS) / (starts + PRIOR_STARTS)
 *
 * The ratings are stored in localStorage so they persist across sessions and
 * are available immediately on the next page load without re-running calibration.
 */

import { CalibrationDataset } from './historicalCalibrationService';
import { GAME_TYPE, type GameType } from '@/config/game';

const LEGACY_STORAGE_KEY = 'driver_empirical_ratings_V85';
const storageKey = (gameType: GameType) => `driver_empirical_ratings_${gameType}`;
const PRIOR_RATE   = 0.12;  // 12% baseline win rate
const PRIOR_STARTS = 10;    // equivalent to 10 "imaginary" prior races

// Module-level cache — loaded once from localStorage, then served synchronously
let _cache: Map<string, number> | null = null;
let _activeGameType: GameType | null = null;

function activateStoredRatings(gameType: GameType): void {
  try {
    const raw = localStorage.getItem(storageKey(gameType))
      ?? (gameType === 'V85' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    _cache = raw
      ? new Map<string, number>(Object.entries(JSON.parse(raw) as Record<string, number>))
      : new Map();
  } catch {
    _cache = new Map();
  }
  _activeGameType = gameType;
}

function normalizeName(firstName: string, lastName: string): string {
  return `${(firstName ?? '').trim()} ${(lastName ?? '').trim()}`.trim().toLowerCase();
}

/**
 * Compute per-driver win rates from a CalibrationDataset.
 * Returns Map<normalizedDriverName, smoothedWinRate (0–1)>.
 */
export function computeDriverRatings(dataset: CalibrationDataset): Map<string, number> {
  const counts = new Map<string, { wins: number; starts: number }>();

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      const horses: any[] = race.raceData?.horses ?? [];
      for (const horse of horses) {
        const fn = horse.driver?.firstName ?? '';
        const ln = horse.driver?.lastName  ?? '';
        const name = normalizeName(fn, ln);
        if (!name) continue;

        const horseKey = horse.horseKey ?? String(horse.horseId ?? horse.id ?? '');
        if (!horseKey) continue;

        const actual = race.actualResults.get(horseKey);
        if (!actual) continue;

        const entry = counts.get(name) ?? { wins: 0, starts: 0 };
        entry.starts++;
        if (actual.position === 1) entry.wins++;
        counts.set(name, entry);
      }
    }
  }

  const ratings = new Map<string, number>();
  const priorWins = PRIOR_RATE * PRIOR_STARTS;
  for (const [name, { wins, starts }] of counts) {
    ratings.set(name, (wins + priorWins) / (starts + PRIOR_STARTS));
  }
  return ratings;
}

/** Persist driver ratings to localStorage and update the in-memory cache. */
export function saveDriverRatings(
  ratings: Map<string, number>,
  gameType: GameType = GAME_TYPE
): void {
  const obj: Record<string, number> = {};
  ratings.forEach((v, k) => { obj[k] = v; });
  _cache = ratings;
  _activeGameType = gameType;
  try {
    localStorage.setItem(storageKey(gameType), JSON.stringify(obj));
  } catch {
    // Ignore unavailable storage/quota errors. The in-memory cache still works
    // for Web Workers and one-shot CLI evaluation runs.
  }
}

/** Look up a driver's empirical win rate. Returns null if not in dataset. */
export function getDriverEmpiricalRate(firstName: string, lastName: string): number | null {
  if (_cache === null) {
    activateStoredRatings(GAME_TYPE);
  }
  const name = normalizeName(firstName, lastName);
  return _cache?.get(name) ?? null;
}

/** How many unique drivers are in the cached ratings. */
export function getDriverRatingCount(gameType: GameType = GAME_TYPE): number {
  if (_cache === null || _activeGameType !== gameType) activateStoredRatings(gameType);
  return _cache?.size ?? 0;
}

/** Return a structured-clone-safe snapshot for the analysis worker. */
export function getDriverRatingsSnapshot(gameType: GameType = GAME_TYPE): Record<string, number> {
  if (_cache === null || _activeGameType !== gameType) activateStoredRatings(gameType);
  return Object.fromEntries(_cache ?? []);
}

/** Prime this JavaScript realm (main thread, worker, or CLI) with a snapshot. */
export function primeDriverRatingCache(
  ratings: Record<string, number>,
  gameType: GameType = GAME_TYPE
): void {
  _cache = new Map(
    Object.entries(ratings).filter(([, rate]) => Number.isFinite(rate) && rate >= 0 && rate <= 1)
  );
  _activeGameType = gameType;
}

/** Invalidate the in-memory cache (e.g. after saving new ratings). */
export function invalidateDriverRatingCache(): void {
  _cache = null;
  _activeGameType = null;
}

/**
 * Ensure driver ratings exist on app startup.
 *
 * Ratings are derived state: without them the driverEmpirical weight (one of
 * the largest factors) is silently inactive, so a saved weight preset alone
 * cannot reproduce a previous session's ranking. If localStorage has no
 * ratings but a calibration dataset is cached in IndexedDB, recompute them
 * from the most recently used window. Returns the number of rated drivers.
 */
export async function primeDriverRatingsIfMissing(gameType: GameType = GAME_TYPE): Promise<number> {
  const existing = getDriverRatingCount(gameType);
  if (existing > 0) return existing;

  const { loadCalibrationDataset, getCalibrationCacheInfo } = await import('./calibrationDatasetCache');
  for (const monthsBack of [6, 3, 2, 12, 1]) {
    try {
      const info = await getCalibrationCacheInfo(monthsBack, gameType);
      if (!info.exists || info.dateCount === 0) continue;
      const dataset = await loadCalibrationDataset(monthsBack, gameType);
      if (!dataset || dataset.length === 0) continue;
      const ratings = computeDriverRatings(dataset);
      saveDriverRatings(ratings, gameType);
      return ratings.size;
    } catch {
      // Cache unavailable (private mode, quota) — predictions fall back
      // to ATG career stats for the driver factor.
    }
  }
  return 0;
}
