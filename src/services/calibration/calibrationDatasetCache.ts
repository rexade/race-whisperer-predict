/**
 * Calibration Dataset Cache — persistent IndexedDB storage.
 *
 * Historical race results never change — once a race is run, the finish
 * order is permanent.  This cache has NO TTL: data is kept indefinitely
 * and only overwritten when the user explicitly clicks "Refresh".
 *
 * The cache is keyed by (gameType, monthsBack) so different window sizes
 * each get their own entry.  Expanding from 3 months to 6 months forces a
 * new collection that covers the wider range; the old entry is replaced.
 *
 * Maps are serialized as plain arrays of pairs; HorseRawKmTime is stored
 * in minimal form (strip allTimes to keep the blob small, mirrors what
 * V75CacheService.getRawTimes already returns for cached entries).
 */

import { CalibrationDataset, RaceCalibrationData, ActualHorseResult } from './historicalCalibrationService';
import { HorseRawKmTime } from '@/services/types/kmTimeTypes';
import { GAME_TYPE } from '@/config/game';

const CACHE_KEY_PREFIX = 'calibration_dataset_';
const DB_NAME = 'race_whisperer_calibration';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

interface SerializedHorseRawKmTime {
  horseKey?: string;
  horseId: number;
  horseName: string;
  bestTime: any;
  rawBestTime: any;
  validTimesCount: number;
  dataSource: string;
  gallopRate?: number;
  gallopCount?: number;
  gallopDates?: string[];
  lastRaceDate?: string;
  consistencyScore?: number;
  disqualificationCount?: number;
  confidenceMultiplier?: number;
  usedStatisticsFallback?: boolean;
  usedExtendedFallback?: boolean;
  averageOdds?: number;
  lastOdds?: number;
  horseAge?: number;
  dataSourceChain?: string;
}

interface SerializedRaceCalibrationData {
  raceId: string;
  raceNumber: number;
  raceData: any;
  rawKmTimes: SerializedHorseRawKmTime[];
  // Map serialized as [[horseKey, ActualHorseResult], ...]
  actualResultsEntries: [string, ActualHorseResult][];
}

interface SerializedDataset {
  schemaVersion: number;
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

function metaKey(monthsBack: number): string {
  return `${cacheKey(monthsBack)}_meta`;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open calibration IndexedDB'));
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save calibration dataset'));
  });
  db.close();
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Failed to load calibration dataset'));
  });
  db.close();
  return value;
}

async function idbDelete(key: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete calibration dataset'));
  });
  db.close();
}

async function idbClear(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear calibration datasets'));
  });
  db.close();
}

function serializeRawKmTime(rt: HorseRawKmTime): SerializedHorseRawKmTime {
  return {
    horseKey: rt.horseKey,
    horseId: rt.horseId,
    horseName: rt.horseName,
    bestTime: rt.bestTime,
    rawBestTime: rt.rawBestTime,
    validTimesCount: rt.validTimesCount,
    dataSource: rt.dataSource ?? 'recent',
    gallopRate: rt.gallopRate,
    gallopCount: rt.gallopCount,
    gallopDates: rt.gallopDates,
    lastRaceDate: rt.lastRaceDate,
    consistencyScore: rt.consistencyScore,
    disqualificationCount: rt.disqualificationCount,
    confidenceMultiplier: rt.confidenceMultiplier,
    usedStatisticsFallback: rt.usedStatisticsFallback,
    usedExtendedFallback: rt.usedExtendedFallback,
    averageOdds: rt.averageOdds,
    lastOdds: rt.lastOdds,
    horseAge: rt.horseAge,
    dataSourceChain: rt.dataSourceChain,
  };
}

function deserializeRawKmTime(s: SerializedHorseRawKmTime): HorseRawKmTime {
  return {
    horseKey: s.horseKey,
    horseId: s.horseId,
    horseName: s.horseName,
    bestTime: s.bestTime,
    rawBestTime: s.rawBestTime,
    validTimesCount: s.validTimesCount,
    allTimes: [], // stripped for storage — matches V75CacheService getRawTimes behavior
    dataSource: s.dataSource as 'recent' | 'fallback',
    isNotifiee: false,
    gallopRate: s.gallopRate,
    gallopCount: s.gallopCount,
    gallopDates: s.gallopDates,
    lastRaceDate: s.lastRaceDate,
    consistencyScore: s.consistencyScore,
    disqualificationCount: s.disqualificationCount,
    confidenceMultiplier: s.confidenceMultiplier,
    usedStatisticsFallback: s.usedStatisticsFallback,
    usedExtendedFallback: s.usedExtendedFallback,
    averageOdds: s.averageOdds,
    lastOdds: s.lastOdds,
    horseAge: s.horseAge,
    dataSourceChain: s.dataSourceChain,
  };
}

function serializeDataset(monthsBack: number, dataset: CalibrationDataset): SerializedDataset {
  return {
    schemaVersion: 2,
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
}

function deserializeDataset(s: SerializedDataset): CalibrationDataset | null {
  if (s.gameType !== GAME_TYPE) return null;
  if ((s.schemaVersion ?? 1) < 2) return null;

  return s.dates.map(d => ({
    date: d.date,
    races: d.races.map((r): RaceCalibrationData => ({
      raceId: r.raceId,
      raceNumber: r.raceNumber,
      raceData: r.raceData,
      rawKmTimes: r.rawKmTimes.map(deserializeRawKmTime),
      actualResults: new Map<string, ActualHorseResult>(r.actualResultsEntries.map(([key, value]) => [String(key), value])),
    })),
  }));
}

export async function saveCalibrationDataset(monthsBack: number, dataset: CalibrationDataset): Promise<void> {
  const key = cacheKey(monthsBack);
  const serialized = serializeDataset(monthsBack, dataset);
  const blob = JSON.stringify(serialized);

  if (hasIndexedDb()) {
    await idbSet(key, blob);
    localStorage.setItem(metaKey(monthsBack), JSON.stringify({
      schemaVersion: serialized.schemaVersion,
      gameType: serialized.gameType,
      cachedAt: serialized.cachedAt,
      dateCount: serialized.dates.length,
      storage: 'indexeddb',
    }));
    localStorage.removeItem(key);
    console.log(`[CalibrationCache] Saved dataset to IndexedDB: ${dataset.length} dates`);
    return;
  }

  try {
    localStorage.setItem(key, blob);
    console.log(`[CalibrationCache] Saved dataset: ${dataset.length} dates`);
  } catch (e) {
    // Quota exceeded — evict other calibration caches (older month windows) and retry
    console.warn('[CalibrationCache] Storage full, evicting other calibration caches…');
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX) && k !== key)
      .forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(key, blob);
      console.log(`[CalibrationCache] Saved dataset after eviction: ${dataset.length} dates`);
    } catch (e2) {
      console.warn('[CalibrationCache] Failed to save dataset even after eviction (dataset too large for localStorage):', e2);
    }
  }
}

export async function loadCalibrationDataset(monthsBack: number): Promise<CalibrationDataset | null> {
  try {
    const key = cacheKey(monthsBack);
    const raw = hasIndexedDb()
      ? (await idbGet(key)) ?? localStorage.getItem(key)
      : localStorage.getItem(key);
    if (!raw) return null;

    const s: SerializedDataset = JSON.parse(raw);
    const dataset = deserializeDataset(s);
    if (!dataset) return null;

    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    console.log(`[CalibrationCache] Loaded dataset: ${dataset.length} dates (${ageHours.toFixed(1)}h old)`);
    return dataset;
  } catch (e) {
    console.warn('[CalibrationCache] Failed to load dataset:', e);
    return null;
  }
}

export async function clearCalibrationDataset(monthsBack?: number): Promise<void> {
  if (monthsBack !== undefined) {
    const key = cacheKey(monthsBack);
    localStorage.removeItem(key);
    localStorage.removeItem(metaKey(monthsBack));
    await idbDelete(key);
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
    await idbClear();
  }
}

export async function getCalibrationCacheInfo(monthsBack: number): Promise<{ exists: boolean; ageHours: number | null; dateCount: number; cachedAt: string | null }> {
  try {
    const metaRaw = localStorage.getItem(metaKey(monthsBack));
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (meta.gameType !== GAME_TYPE) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
      if ((meta.schemaVersion ?? 1) < 2) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
      const ageHours = (Date.now() - new Date(meta.cachedAt).getTime()) / 3_600_000;
      return { exists: true, ageHours, dateCount: meta.dateCount ?? 0, cachedAt: meta.cachedAt };
    }

    const raw = localStorage.getItem(cacheKey(monthsBack));
    if (!raw) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    const s: SerializedDataset = JSON.parse(raw);
    if (s.gameType !== GAME_TYPE) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    if ((s.schemaVersion ?? 1) < 2) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    return { exists: true, ageHours, dateCount: s.dates.length, cachedAt: s.cachedAt };
  } catch {
    return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
  }
}
