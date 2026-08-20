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
 * Maps are serialized as plain arrays of pairs. HorseRawKmTime is preserved
 * with allTimes so calibration runs can be replayed exactly.
 */

import { CalibrationDataset, RaceCalibrationData, ActualHorseResult } from './historicalCalibrationService';
import { HorseRawKmTime } from '@/services/types/kmTimeTypes';
import { GAME_TYPE, GameType } from '@/config/game';

const CACHE_KEY_PREFIX = 'calibration_dataset_';
const DB_NAME = 'race_whisperer_calibration';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';
const CURRENT_SCHEMA_VERSION = 4;

// HorseRawKmTime contains only JSON-safe values. Keeping the serialized shape
// identical prevents new provenance fields from being lost when this type grows.
type SerializedHorseRawKmTime = HorseRawKmTime;

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

function cacheKey(monthsBack: number, gameType: GameType = GAME_TYPE): string {
  return `${CACHE_KEY_PREFIX}${gameType}_${monthsBack}mo`;
}

function metaKey(monthsBack: number, gameType: GameType = GAME_TYPE): string {
  return `${cacheKey(monthsBack, gameType)}_meta`;
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
  return { ...rt };
}

function deserializeRawKmTime(s: SerializedHorseRawKmTime): HorseRawKmTime {
  return { ...s };
}

function serializeDataset(
  monthsBack: number,
  dataset: CalibrationDataset,
  gameType: GameType = GAME_TYPE
): SerializedDataset {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    gameType,
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

function deserializeDataset(s: SerializedDataset, gameType: GameType = GAME_TYPE): CalibrationDataset | null {
  if (s.gameType !== gameType) return null;
  if ((s.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION) return null;

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

export async function saveCalibrationDataset(
  monthsBack: number,
  dataset: CalibrationDataset,
  gameType: GameType = GAME_TYPE
): Promise<void> {
  const key = cacheKey(monthsBack, gameType);
  const serialized = serializeDataset(monthsBack, dataset, gameType);
  const blob = JSON.stringify(serialized);

  if (hasIndexedDb()) {
    await idbSet(key, blob);
    localStorage.setItem(metaKey(monthsBack, gameType), JSON.stringify({
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

export async function loadCalibrationDataset(
  monthsBack: number,
  gameType: GameType = GAME_TYPE
): Promise<CalibrationDataset | null> {
  try {
    const key = cacheKey(monthsBack, gameType);
    const raw = hasIndexedDb()
      ? (await idbGet(key)) ?? localStorage.getItem(key)
      : localStorage.getItem(key);
    if (!raw) return null;

    const s: SerializedDataset = JSON.parse(raw);
    const dataset = deserializeDataset(s, gameType);
    if (!dataset) return null;

    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    console.log(`[CalibrationCache] Loaded dataset: ${dataset.length} dates (${ageHours.toFixed(1)}h old)`);
    return dataset;
  } catch (e) {
    console.warn('[CalibrationCache] Failed to load dataset:', e);
    return null;
  }
}

export async function clearCalibrationDataset(
  monthsBack?: number,
  gameType: GameType = GAME_TYPE
): Promise<void> {
  if (monthsBack !== undefined) {
    const key = cacheKey(monthsBack, gameType);
    localStorage.removeItem(key);
    localStorage.removeItem(metaKey(monthsBack, gameType));
    await idbDelete(key);
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_KEY_PREFIX))
      .forEach(k => localStorage.removeItem(k));
    await idbClear();
  }
}

export async function getCalibrationCacheInfo(
  monthsBack: number,
  gameType: GameType = GAME_TYPE
): Promise<{ exists: boolean; ageHours: number | null; dateCount: number; cachedAt: string | null }> {
  try {
    const metaRaw = localStorage.getItem(metaKey(monthsBack, gameType));
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      if (meta.gameType !== gameType) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
      if ((meta.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
      const ageHours = (Date.now() - new Date(meta.cachedAt).getTime()) / 3_600_000;
      return { exists: true, ageHours, dateCount: meta.dateCount ?? 0, cachedAt: meta.cachedAt };
    }

    const raw = localStorage.getItem(cacheKey(monthsBack, gameType));
    if (!raw) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    const s: SerializedDataset = JSON.parse(raw);
    if (s.gameType !== gameType) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    if ((s.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION) return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
    const ageHours = (Date.now() - new Date(s.cachedAt).getTime()) / 3_600_000;
    return { exists: true, ageHours, dateCount: s.dates.length, cachedAt: s.cachedAt };
  } catch {
    return { exists: false, ageHours: null, dateCount: 0, cachedAt: null };
  }
}
