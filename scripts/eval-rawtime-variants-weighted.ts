/**
 * Weighted raw-time variant evaluator.
 *
 * Fetches ATG race/start histories, rebuilds HorseRawKmTime for several
 * filtering/top-N choices, then runs the normal RaceResultProcessor with the
 * current DEFAULT_WEIGHTS and default post-position curves.
 *
 * Usage:
 *   npx tsx scripts/eval-rawtime-variants-weighted.ts 2026-05-09 2026-05-02
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { makeHorseKey } from '../src/services/horseIdentity';
import { collectHorseRecordCandidates, isAggregateRecordSource } from '../src/services/utils/recordsFallback';
import type { V75HorseData, V75RaceData } from '../src/services/v75CalendarApi';
import type { HorseRawKmTime, KmTime, ProcessedKmTime } from '../src/services/types/kmTimeTypes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const CACHE_FILE = path.join(REPORTS, 'rawtime-weighted-source-cache.json');
const ATG_BASE = 'https://www.atg.se/services/racinginfo/v1/api';

const REFERENCE_DIST = 2140;
const SHORTER_RATE = 3.2;
const LONGER_RATE = 2.0;
const DIST_TOLERANCE = 10;
const VOLTE_ADV_S = 1.0;

type VariantMode = 'prod_today5_fallback' | 'race5_fallback' | 'race5_fill_topn' | 'race5_only' | 'all_before';
type SourceMode = 'results_only' | 'mixed_stats' | 'stats_fallback';
interface Variant { mode: VariantMode; sourceMode: SourceMode; topN: number }

const VARIANTS: Variant[] = [
  ...(['results_only', 'mixed_stats', 'stats_fallback'] as SourceMode[]).flatMap(sourceMode =>
    [1, 2, 3].map(topN => ({ mode: 'all_before' as const, sourceMode, topN }))
  ),
  ...(['results_only', 'mixed_stats', 'stats_fallback'] as SourceMode[]).flatMap(sourceMode =>
    [1, 2, 3].map(topN => ({ mode: 'race5_fallback' as const, sourceMode, topN }))
  ),
  ...(['results_only', 'mixed_stats', 'stats_fallback'] as SourceMode[]).flatMap(sourceMode =>
    [1, 2, 3].map(topN => ({ mode: 'race5_fill_topn' as const, sourceMode, topN }))
  ),
];

const BROWSER_OPTIMIZED_2026_05_11 = {
  name: 'Browser optimized 2026-05-11',
  weights: {
    form: 0.222,
    oddsLive: 0.000,
    shoeType: 0.000,
    ageFactor: 0.000,
    sulkyType: 0.537,
    driverForm: 0.025,
    gallopRisk: 0.052,
    startPoints: 2.521,
    postPosition: 2.439,
    layoffPenalty: 2.944,
    oddsHistorical: 0.000,
    driverEmpirical: 4.810,
    placePercentage: 0.000,
    earningsPerStart: 0.872,
    genderAdjustment: 0.550,
    trackFamiliarity: 0.000,
    consistencyFactor: 0.740,
    driverPerformance: 3.764,
    distanceAdjustment: 0.000,
    horseWinPercentage: 1.051,
    trainerPerformance: 0.200,
    raceDistanceAdjustment: 0.785,
    volteStartDistancePenalty: 1.126,
  },
  postPositionCurves: {
    auto: {
      1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019,
      6: 0.063, 7: 0.169, 8: 0.272, 9: 0.992, 10: 0.537,
      11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
    },
    volte: {
      1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221,
      6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
      11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
    },
    byDistance: {
      auto: {
        short: {
          1: -0.114, 2: 0.014, 3: -0.226, 4: -0.099, 5: 0.019,
          6: 0.063, 7: 0.219, 8: 0.272, 9: 0.992, 10: 0.537,
          11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
        },
        medium: {
          1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019,
          6: 0.063, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537,
          11: 0.464, 12: 0.788, 13: 1.033, 14: 0.551, 15: 1.047,
        },
        long: {
          1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.069,
          6: 0.013, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537,
          11: 0.489, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047,
        },
      },
      volte: {
        short: {
          1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221,
          6: 0.336, 7: 0.404, 8: -0.009, 9: 0.722, 10: 0.430,
          11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
        },
        medium: {
          1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.171,
          6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
          11: 0.632, 12: 1.042, 13: 1.357, 14: 0.994, 15: 0.862,
        },
        long: {
          1: -0.658, 2: 0.104, 3: 0.014, 4: 0.180, 5: 0.221,
          6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430,
          11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862,
        },
      },
    },
  },
} as const;

interface CachedStart {
  number: number;
  postPosition: number;
  records: any[];
  horse?: any;
}

interface CachedRace {
  raceId: string;
  raceNumber: number;
  date: string;
  rawRace: any;
  starts: CachedStart[];
}

interface CachedDate {
  date: string;
  gameId: string | null;
  races: CachedRace[];
}

interface Cache {
  fetchedAt?: string;
  dates: Record<string, CachedDate>;
}

function loadCache(): Cache {
  if (!fs.existsSync(CACHE_FILE)) return { dates: {} };
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
}

function saveCache(cache: Cache): void {
  fs.mkdirSync(REPORTS, { recursive: true });
  cache.fetchedAt = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      last = error;
      await sleep(400 * (i + 1));
    }
  }
  throw last;
}

function calculateEarningsPerStart(totalEarnings: number, totalStarts: number): number {
  if (!totalStarts || !totalEarnings) return 0;
  return totalEarnings / totalStarts;
}

function extractSafeString(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.includes('[object Object]')) return value.trim();
  if (typeof value === 'object') {
    if (value.code && typeof value.code === 'string') return value.code;
    if (value.type && typeof value.type === 'string') return value.type;
    if (value.name && typeof value.name === 'string') return value.name;
  }
  return null;
}

function extractHorseData(start: any, raceId: string): V75HorseData {
  const shoesData = start.shoes || start.horse?.shoes || {};
  const frontShoes = Boolean(shoesData.front ?? shoesData.frontShoes ?? shoesData.frontShoe ?? shoesData.f ?? false);
  const backShoes = Boolean(shoesData.back ?? shoesData.backShoes ?? shoesData.backShoe ?? shoesData.b ?? false);

  let sulkyType = 'VA';
  for (const val of [
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
    start.equipment?.sulky?.name,
  ]) {
    const extracted = extractSafeString(val);
    if (extracted) {
      sulkyType = extracted;
      break;
    }
  }

  const currentYear = String(new Date().getFullYear());
  const driverStats = start.driver?.statistics || {};
  const driverYearStats = start.driver?.statistics?.years?.[currentYear]
    || start.driver?.statistics?.years?.['2025'] || {};
  const trainerStats = start.trainer?.statistics || {};
  const trainerYearStats = start.trainer?.statistics?.years?.[currentYear]
    || start.trainer?.statistics?.years?.['2025'] || {};
  const horseLifeStats = start.horse?.statistics?.life || {};
  const totalEarnings = horseLifeStats.earnings || horseLifeStats.totalEarnings || 0;
  const totalStarts = horseLifeStats.starts || horseLifeStats.totalStarts || 0;
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
      winPercentage2025: driverYearStats.winPercentage || 0,
    },
    statistics: {
      startPoints: horseLifeStats.startPoints || 500,
      placePercentage: horseLifeStats.placePercentage || 5000,
      winPercentage: horseLifeStats.winPercentage || 1500,
      earningsPerStart: calculateEarningsPerStart(totalEarnings, totalStarts) || 300000,
    },
    shoes: { front: frontShoes, back: backShoes },
    sulky: { type: sulkyType },
    homeTrack: start.horse?.homeTrack || start.horse?.track || 'Unknown',
    birthYear: start.horse?.birthYear || start.horse?.birth_year || 0,
    age: start.horse?.age || undefined,
    sex: start.horse?.sex || start.horse?.gender || '',
    trainer: start.trainer ? {
      firstName: start.trainer.firstName || '',
      lastName: start.trainer.lastName || '',
      winPercentage: trainerStats.winPercentage || 0,
      winPercentage2025: trainerYearStats.winPercentage || 0,
    } : undefined,
  };
}

function toRaceData(cachedRace: CachedRace): V75RaceData {
  const race = cachedRace.rawRace;
  return {
    raceId: race.id,
    raceNumber: race.number,
    distance: race.distance,
    startMethod: race.startMethod,
    track: race.track?.name || 'Unknown',
    name: race.name,
    date: cachedRace.date,
    prize: 0,
    horses: (race.starts || []).map((start: any) => extractHorseData(start, race.id)),
  };
}

async function fetchDate(date: string, cache: Cache): Promise<CachedDate> {
  if (cache.dates[date]) return cache.dates[date];

  console.log(`[${date}] fetching V85`);
  const calendar = await fetchJson(`${ATG_BASE}/calendar/day/${date}`);
  const game = calendar.games?.V85?.[0];
  if (!game) {
    cache.dates[date] = { date, gameId: null, races: [] };
    saveCache(cache);
    return cache.dates[date];
  }

  const dateEntry: CachedDate = { date, gameId: game.id, races: [] };
  for (const raceId of game.races ?? []) {
    console.log(`  race ${raceId}`);
    const rawRace = await fetchJson(`${ATG_BASE}/races/${raceId}`);
    if (!(rawRace.starts ?? []).some((s: any) => (s.result?.finishOrder ?? 0) > 0)) continue;

    const starts: CachedStart[] = [];
    for (const start of rawRace.starts ?? []) {
      const number = start.number ?? start.postPosition;
      let records: any[] = [];
      let horse: any | undefined;
      try {
        const detail = await fetchJson(`${ATG_BASE}/races/${raceId}/start/${number}`);
        horse = detail?.horse;
        records = horse?.results?.records ?? [];
      } catch {
        records = [];
      }
      starts.push({ number, postPosition: start.postPosition, records, horse });
      await sleep(120);
    }

    dateEntry.races.push({
      raceId,
      raceNumber: rawRace.number,
      date,
      rawRace,
      starts,
    });
    cache.dates[date] = dateEntry;
    saveCache(cache);
  }

  return dateEntry;
}

function isNumericKmTime(kmTime: any): kmTime is KmTime {
  return kmTime
    && typeof kmTime === 'object'
    && Number.isFinite(kmTime.minutes)
    && Number.isFinite(kmTime.seconds);
}

function kmTimeToSeconds(t: KmTime): number {
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

function secondsToKmTime(seconds: number): KmTime {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds - minutes * 60);
  const tenths = Math.round((seconds - minutes * 60 - wholeSeconds) * 10);
  if (tenths === 10) return { minutes, seconds: wholeSeconds + 1, tenths: 0 };
  return { minutes, seconds: wholeSeconds, tenths };
}

function normalizeKm(kmTime: KmTime, distance: number, startMethod: string): KmTime | null {
  let seconds = kmTimeToSeconds(kmTime);
  const diff = distance - REFERENCE_DIST;
  if (diff < -DIST_TOLERANCE) seconds += SHORTER_RATE * (-diff) / 1000;
  else if (diff > DIST_TOLERANCE) seconds -= LONGER_RATE * diff / 1000;
  if (String(startMethod ?? '').toLowerCase().includes('volt')) seconds -= VOLTE_ADV_S;
  if (!Number.isFinite(seconds) || seconds <= 60 || seconds >= 130) return null;
  return secondsToKmTime(seconds);
}

function recordDateMs(record: any): number {
  return record.date ? new Date(record.date).getTime() : Number.NaN;
}

function sourceRecords(records: any[], raceDate: string, mode: VariantMode): any[] {
  const undatedAggregate = records.filter(r => !r.date && isAggregateRecordSource(r.meta?.source));
  const sorted = [...records]
    .filter(r => r.date)
    .sort((a, b) => recordDateMs(b) - recordDateMs(a));

  if (mode === 'prod_today5_fallback') {
    const reference = new Date();
    const cutoff = new Date(reference);
    cutoff.setMonth(cutoff.getMonth() - 5);
    const recent = sorted.filter(r => recordDateMs(r) >= cutoff.getTime());
    return [...(recent.length ? recent : sorted), ...undatedAggregate];
  }

  const upper = new Date(raceDate).getTime();
  const before = sorted.filter(r => recordDateMs(r) < upper);
  if (mode === 'all_before') return [...before, ...undatedAggregate];
  if (mode === 'race5_fill_topn') return [...before, ...undatedAggregate];

  const cutoff = new Date(raceDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const recent = before.filter(r => recordDateMs(r) >= cutoff.getTime());
  if (mode === 'race5_only') return [...recent, ...undatedAggregate];
  return [...(recent.length ? recent : before), ...undatedAggregate];
}

function splitRaceWindowRecords(records: any[], raceDate: string): { recent: any[]; older: any[]; undatedAggregate: any[] } {
  const upper = new Date(raceDate).getTime();
  const cutoff = new Date(raceDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const cutoffMs = cutoff.getTime();

  const undatedAggregate = records.filter(r => !r.date && isAggregateRecordSource(r.meta?.source));
  const before = [...records]
    .filter(r => r.date && recordDateMs(r) < upper)
    .sort((a, b) => recordDateMs(b) - recordDateMs(a));

  return {
    recent: before.filter(r => recordDateMs(r) >= cutoffMs),
    older: before.filter(r => recordDateMs(r) < cutoffMs),
    undatedAggregate,
  };
}

function candidateRecords(cachedStart: CachedStart, raceDate: string, variant: Variant): any[] {
  const resultRecords = cachedStart.records ?? [];
  if (variant.sourceMode === 'results_only') return resultRecords;

  const mixedRecords = cachedStart.horse
    ? collectHorseRecordCandidates(cachedStart.horse).records
    : resultRecords;

  if (variant.sourceMode === 'mixed_stats') return mixedRecords;

  const resultSource = sourceRecords(resultRecords, raceDate, variant.mode);
  const hasUsableResult = resultSource.some(record =>
    !record.galloped &&
    !record.disqualified &&
    isNumericKmTime(record.kmTime) &&
    (record.start?.distance || record.meta?.distance) &&
    (record.race?.startMethod || record.meta?.startMethod)
  );
  return hasUsableResult ? resultRecords : mixedRecords;
}

function buildRawTime(race: V75RaceData, cachedStart: CachedStart, horse: V75HorseData, variant: Variant): HorseRawKmTime {
  const candidates = candidateRecords(cachedStart, race.date, variant);
  const source = sourceRecords(candidates, race.date, variant.mode);

  const processRecord = (record: any): ProcessedKmTime | null => {
    if (record.galloped || record.disqualified || !isNumericKmTime(record.kmTime)) return null;
    const distance = record.start?.distance ?? 2140;
    const startMethod = record.race?.startMethod ?? 'auto';
    const normalized = normalizeKm(record.kmTime, distance, startMethod);
    if (!normalized) return null;
    return {
      originalTime: {
        minutes: record.kmTime.minutes,
        seconds: record.kmTime.seconds,
        tenths: record.kmTime.tenths ?? 0,
      },
      normalizedTime: normalized,
      raceDate: record.date,
      distance,
      startMethod,
      finishOrder: parseInt(String(record.place ?? '0'), 10) || 0,
      postPosition: record.start?.postPosition,
      valid: true,
      raceId: record.race?.id,
    } as ProcessedKmTime;
  };

  const processed: ProcessedKmTime[] = [];

  for (const record of source) {
    const item = processRecord(record);
    if (item) processed.push(item);
  }

  processed.sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
  let averagingPool = processed;
  if (variant.mode === 'race5_fill_topn') {
    const buckets = splitRaceWindowRecords(candidates, race.date);
    const recent = [...buckets.recent, ...buckets.undatedAggregate]
      .map(processRecord)
      .filter((item): item is ProcessedKmTime => item !== null)
      .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
    const older = buckets.older
      .map(processRecord)
      .filter((item): item is ProcessedKmTime => item !== null)
      .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
    averagingPool = recent.length >= variant.topN
      ? recent
      : [...recent, ...older.slice(0, variant.topN - recent.length)];
  }

  const n = Math.min(variant.topN, averagingPool.length);
  const bestTime = n > 0
    ? secondsToKmTime(averagingPool.slice(0, n).reduce((sum, t) => sum + kmTimeToSeconds(t.normalizedTime), 0) / n)
    : { minutes: 0, seconds: 0, tenths: 0 };
  const bestRecordTime = processed[0]?.normalizedTime ?? { minutes: 0, seconds: 0, tenths: 0 };

  const recentStarts = source.filter(r => r.date).slice(0, 10);
  const galloped = recentStarts.filter(r => r.galloped);
  const cleanPositions = processed
    .filter(t => t.finishOrder !== undefined && t.finishOrder > 0)
    .sort((a, b) => new Date(b.raceDate).getTime() - new Date(a.raceDate).getTime())
    .slice(0, 8)
    .map(t => t.finishOrder!);
  const mean = cleanPositions.length ? cleanPositions.reduce((s, v) => s + v, 0) / cleanPositions.length : 0;
  const consistencyScore = cleanPositions.length >= 3
    ? Math.sqrt(cleanPositions.reduce((s, v) => s + (v - mean) ** 2, 0) / cleanPositions.length)
    : undefined;
  const oddsValues = source.filter(r => Number.isFinite(r.odds) && r.odds > 0).map(r => r.odds);

  return {
    horseKey: horse.horseKey,
    horseId: horse.horseId,
    horseName: typeof horse.name === 'string' ? horse.name : String(horse.name),
    allTimes: processed,
    bestTime,
    rawBestTime: bestTime,
    bestRecordTime,
    validTimesCount: processed.length,
    dataSource: variant.mode.includes('fallback') && processed.length === 0 ? 'fallback' : 'recent',
    oldestRecordDate: source.at(-1)?.date,
    newestRecordDate: source[0]?.date,
    gallopCount: galloped.length,
    gallopDates: galloped.map(r => r.date).filter(Boolean),
    gallopRate: recentStarts.length ? galloped.length / recentStarts.length : 0,
    disqualificationCount: recentStarts.filter(r => r.disqualified).length,
    lastRaceDate: source[0]?.date,
    averageOdds: oddsValues.length ? oddsValues.reduce((s, v) => s + v, 0) / oddsValues.length : undefined,
    consistencyScore,
  };
}

function actualResultsMap(cachedRace: CachedRace): Map<string, { position: number; kmTime?: KmTime; finalOdds?: number }> {
  const map = new Map<string, { position: number; kmTime?: KmTime; finalOdds?: number }>();
  for (const start of cachedRace.rawRace.starts ?? []) {
    const position = start.result?.finishOrder ?? 0;
    if (position <= 0) continue;
    const horseId = start.horse?.id ?? 0;
    const postPosition = start.number ?? start.postPosition;
    map.set(makeHorseKey(cachedRace.raceId, horseId, postPosition), {
      position,
      kmTime: isNumericKmTime(start.result?.kmTime) ? start.result.kmTime : undefined,
      finalOdds: Number.isFinite(start.odds) ? start.odds : undefined,
    });
  }
  return map;
}

function buildDataset(dateEntries: CachedDate[], variant: Variant) {
  return dateEntries.map(dateEntry => ({
    date: dateEntry.date,
    races: dateEntry.races.map(cachedRace => {
      const raceData = toRaceData(cachedRace);
      const rawKmTimes = raceData.horses.map((horse, index) =>
        buildRawTime(raceData, cachedRace.starts[index], horse, variant)
      );
      return {
        raceId: cachedRace.raceId,
        raceNumber: cachedRace.raceNumber,
        raceData,
        rawKmTimes,
        actualResults: actualResultsMap(cachedRace),
      };
    }),
  }));
}

async function main(): Promise<void> {
  const dates = process.argv.slice(2);
  if (!dates.length) {
    console.error('Usage: npx tsx scripts/eval-rawtime-variants-weighted.ts YYYY-MM-DD [YYYY-MM-DD ...]');
    process.exit(1);
  }

  fs.mkdirSync(REPORTS, { recursive: true });
  const cache = loadCache();
  const dateEntries: CachedDate[] = [];
  for (const date of dates) dateEntries.push(await fetchDate(date, cache));

  const model = BROWSER_OPTIMIZED_2026_05_11;

  const results = [];
  for (const variant of VARIANTS) {
    const dataset = buildDataset(dateEntries, variant);
    const evaluation = await evaluateWeights(dataset as any, model.weights, model.postPositionCurves);
    results.push({
      name: `${variant.mode}_${variant.sourceMode}_top${variant.topN}`,
      mode: variant.mode,
      sourceMode: variant.sourceMode,
      topN: variant.topN,
      ...evaluation,
    });
  }

  results.sort((a, b) => b.winnerMRR - a.winnerMRR || b.winAccuracy - a.winAccuracy);
  const output = {
    evaluatedAt: new Date().toISOString(),
    dates,
    model: model.name,
    cacheFile: CACHE_FILE,
    results,
  };
  const outFile = path.join(REPORTS, `rawtime-variant-weighted-${dates[0]}.json`);
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  console.log('\nWeighted variant ranking:');
  for (const r of results) {
    console.log(
      `${r.name.padEnd(26)} MRR=${r.winnerMRR.toFixed(4)} Win=${(r.winAccuracy * 100).toFixed(1)}% ` +
      `WTop3=${(r.winnerTop3Accuracy * 100).toFixed(1)}% Races=${r.racesEvaluated}`
    );
  }
  console.log(`\nSaved ${outFile}`);
  console.log(`Cache ${CACHE_FILE}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
