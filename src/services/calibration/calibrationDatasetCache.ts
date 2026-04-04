/**
 * Calibration Dataset Cache — localStorage persistence.
 *
 * Stores the collected CalibrationDataset so that closing and reopening
 * the tab does not require re-fetching everything from ATG.
 *
 * Maps are serialized as plain arrays of pairs; HorseRawKmTime is stored
 * in minimal form (strip allTimes to keep the blob small, mirrors what
 * V75CacheService.getRawTimes already returns for cached entries).
 */

import { CalibrationDataset, RaceCalibrationData, ActualHorseResult } from './historicalCalibrationService';
import { HorseRawKmTime } from '@/services/types/kmTimeTypes';
import { GAME_TYPE } from '@/config/game';

const CACHE_KEY_PREFIX = 'calibration_dataset_';
const CACHE_TTL_HOURS = 72; // 3 days

interface SerializedHorseRawKmTime {
  horseId: number;
  horseName: string;
  bestTime: any;
  rawBestTime: any;
  validTimesCount: number;
  dataSource: string;
}

interface SerializedRaceCalibrationData {
  raceId: string;
  raceNumber: number;
  raceData: any;
  rawKmTimes: SerializedHorseRawKmTime[];
  // Map serialized as [[horseId, ActualHorseResult], ...]
  actualResultsEntries: [number, ActualHorseResult][];
}

interface SerializedDataset {
  gameType: string;
  monthsBack: number;
  cachedAt: string;
  dates: Array<{
    date: string;
    races: SerializedRaceCalibrationData[];
  }>;
}

function cacheKey(monthsBack: number): string {
  return `${CACHE_KEY_PREFIX}${GAME_TYPE}_${monthsBack}mo`;
}

function serializeRawKmTime(rt: HorseRawKmTime): SerializedHorseRawKmTime {
  return {
    horseId: rt.horseId,
    horseName: rt.horseName,
    bestTime: rt.bestTime,
    rawBestTime: rt.rawBestTime,
    validTimesCount: rt.validTimesCount,
    dataSource: rt.dataSource ?? 'recent',
  };
}

function deserializeRawKmTime(s: SerializedHorseRawKmTime): HorseRawKmTime {
  return {
    horseId: s.horseId,
    horseName: s.horseName,
    bestTime: s.bestTime,
    rawBestTime: s.rawBestTime,
    validTimesCount: s.validTimesCount,
    allTimes: [], // stripped for storage — matches V75CacheService getRawTimes behavior
    dataSource: s.dataSource as 'recent' | 'fallback',
    isNotifiee: false,
  };
}

export function saveCalibrationDataset(monthsBack: number, dataset: CalibrationDataset): void {
  try {
    const serialized: SerializedDataset = {
      gameType: GAME_TYPE,
      monthsBack,
      cachedAt: new Date().toISOString(),
      dates: dataset.map(d => ({
        date: d.date,
        races: d.races.map((r): SerializedRaceCalibrationData => ({
          raceId: r.raceId,
          raceNumber: r.raceNumber,
          raceData: r.raceData,
          rawKmTimes: r.rawKmTimes.map(serializeRawKmTime),
          actualResultsEntries: Array.from(r.actualResults.entries()),
        })),
      })),
    };
    localStorage.setItem(cacheKey(monthsBack), JSON.stringify(serialized));
    console.log(`[CalibrationCache] Saved dataset: ${dataset.length} dates`);
  } catch (e) {
    console.warn('[CalibrationCache] Failed to save dataset (storage full?):', e);
  }
}

export function loadCalibrationDataset(monthsBack: number): CalibrationDataset | null {
  try {
    const raw = localStorage.getItem(cacheKey(monthsBack));
    if (!raw) return null;

    const s: SerializedDataset = JSON.parse(raw);

    // Validate game type match
    if (s.gameType !== GAME_TYPE) return null;

    // Check TTL
    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    if (ageHours > CACHE_TTL_HOURS) {
      localStorage.removeItem(cacheKey(monthsBack));
      return null;
    }

    const dataset: CalibrationDataset = s.dates.map(d => ({
      date: d.date,
      races: d.races.map((r): RaceCalibrationData => ({
        raceId: r.raceId,
        raceNumber: r.raceNumber,
        raceData: r.raceData,
        rawKmTimes: r.rawKmTimes.map(deserializeRawKmTime),
        actualResults: new Map<number, ActualHorseResult>(r.actualResultsEntries),
      })),
    }));

    console.log(`[CalibrationCache] Loaded dataset: ${dataset.length} dates (${ageHours.toFixed(1)}h old)`);
    return dataset;
  } catch (e) {
    console.warn('[CalibrationCache] Failed to load dataset:', e);
    return null;
  }
}

export function clearCalibrationDataset(monthsBack?: number): void {
  if (monthsBack !== undefined) {
    localStorage.removeItem(cacheKey(monthsBack));
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

export function getCalibrationCacheInfo(monthsBack: number): { exists: boolean; ageHours: number | null; dateCount: number } {
  try {
    const raw = localStorage.getItem(cacheKey(monthsBack));
    if (!raw) return { exists: false, ageHours: null, dateCount: 0 };
    const s: SerializedDataset = JSON.parse(raw);
    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    return { exists: true, ageHours, dateCount: s.dates.length };
  } catch {
    return { exists: false, ageHours: null, dateCount: 0 };
  }
}
