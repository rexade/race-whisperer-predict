import fs from 'fs';
import { loadDataset } from './cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { collectHorseRecordCandidates, isAggregateRecordSource } from '../src/services/utils/recordsFallback';
import type { HorseRawKmTime, KmTime, ProcessedKmTime } from '../src/services/types/kmTimeTypes';

const SOURCE_CACHE = 'reports/rawtime-weighted-source-cache.json';
const REFERENCE_DIST = 2140;
const SHORTER_RATE = 3.2;
const LONGER_RATE = 2.0;
const DIST_TOLERANCE = 10;
const VOLTE_ADV_S = 1.0;

type Mode = 'stored' | 'all_before' | 'race5_fallback' | 'race5_fill_topn';
type SourceMode = 'results_only' | 'stats_fallback';
type HistoryMode = 'stored_shape' | 'full_all_times';
type Variant = { mode: Mode; sourceMode: SourceMode; topN: number; historyMode: HistoryMode };

const variants: Variant[] = [
  { mode: 'stored', sourceMode: 'results_only', topN: 3, historyMode: 'stored_shape' },
  ...(['all_before', 'race5_fallback', 'race5_fill_topn'] as Mode[]).flatMap(mode =>
    (['results_only', 'stats_fallback'] as SourceMode[]).flatMap(sourceMode =>
      [1, 2, 3, 4].flatMap(topN =>
        (['stored_shape', 'full_all_times'] as HistoryMode[]).map(historyMode => ({ mode, sourceMode, topN, historyMode }))
      )
    )
  ),
];

const weights = {
  form: 2.810, oddsLive: 0, shoeType: 0, ageFactor: 0, sulkyType: 0,
  driverForm: 1.680, gallopRisk: 0.196, startPoints: 0.267, postPosition: 2.159,
  layoffPenalty: 1.261, oddsHistorical: 2.381, driverEmpirical: 4.255,
  placePercentage: 0.564, earningsPerStart: 1.804, genderAdjustment: 0,
  trackFamiliarity: 0, consistencyFactor: 1.489, driverPerformance: 0.436,
  distanceAdjustment: 1.055, horseWinPercentage: 1.148, trainerPerformance: 0,
  raceDistanceAdjustment: 0.555, volteStartDistancePenalty: 1.459,
};

const postPositionCurves = {
  auto: { 1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.169, 8: 0.272, 9: 0.992, 10: 0.537, 11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047 },
  volte: { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
  byDistance: {
    auto: {
      short: { 1: 0.036, 2: 0.014, 3: -0.226, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.219, 8: 0.272, 9: 1.042, 10: 0.537, 11: 0.464, 12: 0.738, 13: 1.033, 14: 0.551, 15: 1.047 },
      medium: { 1: -0.064, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.219, 8: 0.247, 9: 0.792, 10: 0.287, 11: 0.414, 12: 0.888, 13: 1.058, 14: 0.501, 15: 1.047 },
      long: { 1: -0.064, 2: 0.064, 3: -0.176, 4: -0.099, 5: 0.169, 6: -0.012, 7: 0.169, 8: 0.322, 9: 0.967, 10: 0.537, 11: 0.489, 12: 0.888, 13: 1.033, 14: 0.501, 15: 1.047 },
    },
    volte: {
      short: { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.386, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
      medium: { 1: -0.558, 2: 0.104, 3: 0.014, 4: 0.330, 5: 0.221, 6: 0.361, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
      long: { 1: -0.658, 2: 0.054, 3: 0.164, 4: 0.230, 5: 0.221, 6: 0.236, 7: 0.454, 8: -0.009, 9: 0.672, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
    },
  },
};

function isNumericKmTime(t: any): t is KmTime {
  return t && typeof t.minutes === 'number' && typeof t.seconds === 'number';
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

function isProcessableRecord(record: any): boolean {
  if (record.galloped || record.disqualified || !isNumericKmTime(record.kmTime)) return false;
  const distance = record.start?.distance ?? 2140;
  const startMethod = record.race?.startMethod ?? record.meta?.startMethod ?? 'auto';
  return normalizeKm(record.kmTime, distance, startMethod) !== null;
}

function sourceRecords(records: any[], raceDate: string, mode: Mode): any[] {
  const undatedAggregate = records.filter(r => !r.date && isAggregateRecordSource(r.meta?.source));
  const sorted = [...records].filter(r => r.date).sort((a, b) => recordDateMs(b) - recordDateMs(a));
  const before = sorted.filter(r => recordDateMs(r) < new Date(raceDate).getTime());
  if (mode === 'all_before') return [...before, ...undatedAggregate];
  const cutoff = new Date(raceDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const recent = before.filter(r => recordDateMs(r) >= cutoff.getTime());
  const recentWithAggregates = [...recent, ...undatedAggregate];
  return (recentWithAggregates.some(isProcessableRecord) ? recentWithAggregates : before);
}

function splitRaceWindowRecords(records: any[], raceDate: string) {
  const upper = new Date(raceDate).getTime();
  const cutoff = new Date(raceDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const cutoffMs = cutoff.getTime();
  const before = [...records]
    .filter(r => r.date && recordDateMs(r) < upper)
    .sort((a, b) => recordDateMs(b) - recordDateMs(a));
  return {
    recent: before.filter(r => recordDateMs(r) >= cutoffMs),
    older: before.filter(r => recordDateMs(r) < cutoffMs),
    undatedAggregate: records.filter(r => !r.date && isAggregateRecordSource(r.meta?.source)),
  };
}

function processRecord(record: any): ProcessedKmTime | null {
  if (record.galloped || record.disqualified || !isNumericKmTime(record.kmTime)) return null;
  const distance = record.start?.distance ?? 2140;
  const startMethod = record.race?.startMethod ?? 'auto';
  const normalized = normalizeKm(record.kmTime, distance, startMethod);
  if (!normalized) return null;
  return {
    originalTime: { minutes: record.kmTime.minutes, seconds: record.kmTime.seconds, tenths: record.kmTime.tenths ?? 0 },
    normalizedTime: normalized,
    raceDate: record.date,
    distance,
    startMethod,
    finishOrder: parseInt(String(record.place ?? '0'), 10) || 0,
    postPosition: record.start?.postPosition,
    valid: true,
    raceId: record.race?.id,
  } as ProcessedKmTime;
}

function candidateRecords(start: any, raceDate: string, variant: Variant): any[] {
  const resultRecords = start?.records ?? [];
  if (variant.sourceMode === 'results_only') return resultRecords;
  const mixed = start?.horse ? collectHorseRecordCandidates(start.horse).records : resultRecords;
  const usableResult = sourceRecords(resultRecords, raceDate, variant.mode).some(record =>
    !record.galloped && !record.disqualified && isNumericKmTime(record.kmTime) &&
    (record.start?.distance || record.meta?.distance) &&
    (record.race?.startMethod || record.meta?.startMethod)
  );
  return usableResult ? resultRecords : mixed;
}

function buildRawTime(race: any, cachedStart: any, horse: any, variant: Variant): HorseRawKmTime {
  const candidates = candidateRecords(cachedStart, race.date, variant);
  const source = sourceRecords(candidates, race.date, variant.mode);
  const processed = source.map(processRecord).filter((item): item is ProcessedKmTime => item !== null)
    .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
  let averagingPool = processed;
  if (variant.mode === 'race5_fill_topn') {
    const buckets = splitRaceWindowRecords(candidates, race.date);
    const recent = [...buckets.recent, ...buckets.undatedAggregate].map(processRecord)
      .filter((item): item is ProcessedKmTime => item !== null)
      .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
    const older = buckets.older.map(processRecord)
      .filter((item): item is ProcessedKmTime => item !== null)
      .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
    averagingPool = recent.length >= variant.topN ? recent : [...recent, ...older.slice(0, variant.topN - recent.length)];
  }

  const n = Math.min(variant.topN, averagingPool.length);
  const bestTime = n > 0
    ? secondsToKmTime(averagingPool.slice(0, n).reduce((sum, t) => sum + kmTimeToSeconds(t.normalizedTime), 0) / n)
    : { minutes: 0, seconds: 0, tenths: 0 };
  const recentStarts = source.filter(r => r.date).slice(0, 10);
  const galloped = recentStarts.filter(r => r.galloped);
  return {
    horseKey: horse.horseKey,
    horseId: horse.horseId,
    horseName: typeof horse.name === 'string' ? horse.name : String(horse.name),
    allTimes: variant.historyMode === 'full_all_times' ? processed : [],
    bestTime,
    rawBestTime: bestTime,
    bestRecordTime: processed[0]?.normalizedTime ?? { minutes: 0, seconds: 0, tenths: 0 },
    validTimesCount: processed.length,
    dataSource: 'recent',
    gallopCount: galloped.length,
    gallopDates: galloped.map(r => r.date).filter(Boolean),
    gallopRate: recentStarts.length ? galloped.length / recentStarts.length : 0,
    lastRaceDate: source[0]?.date,
  };
}

function sourceRaceMap() {
  const cache = JSON.parse(fs.readFileSync(SOURCE_CACHE, 'utf8'));
  const out = new Map<string, any>();
  for (const dateEntry of Object.values<any>(cache.dates ?? {})) {
    for (const race of dateEntry.races ?? []) out.set(race.raceId, race);
  }
  return out;
}

function timeKey(time: KmTime | undefined): string {
  if (!time) return 'missing';
  return `${time.minutes}:${time.seconds}.${time.tenths ?? 0}`;
}

function compareRawTimes(dataset: any[], racesById: Map<string, any>, variant: Variant) {
  let total = 0;
  let exactBest = 0;
  let exactBestAndCount = 0;
  let missingSource = 0;
  let missingStored = 0;
  let absSeconds = 0;
  const examples = [];

  for (const dateEntry of dataset) {
    for (const race of dateEntry.races ?? []) {
      const sourceRace = racesById.get(race.raceId);
      if (!sourceRace) {
        missingSource += race.raceData?.horses?.length ?? 0;
        continue;
      }
      const startsByHorseId = new Map((sourceRace.starts ?? []).map((s: any) => [String(s.horse?.id ?? ''), s]));
      const startsByPost = new Map((sourceRace.starts ?? []).map((s: any) => [String(s.postPosition ?? s.number), s]));
      const storedByHorseId = new Map((race.rawKmTimes ?? []).map((t: any) => [String(t.horseId ?? ''), t]));
      const storedByHorseName = new Map((race.rawKmTimes ?? []).map((t: any) => [String(t.horseName ?? ''), t]));

      for (const horse of race.raceData.horses ?? []) {
        const start = startsByHorseId.get(String(horse.horseId)) ?? startsByPost.get(String(horse.postPosition));
        const rebuilt = buildRawTime({ ...race.raceData, date: dateEntry.date }, start, horse, variant);
        const stored = storedByHorseId.get(String(horse.horseId)) ?? storedByHorseName.get(String(horse.name));
        if (!stored) {
          missingStored++;
          continue;
        }
        total++;
        const storedSeconds = kmTimeToSeconds(stored.bestTime);
        const rebuiltSeconds = kmTimeToSeconds(rebuilt.bestTime);
        const bestMatches = timeKey(stored.bestTime) === timeKey(rebuilt.bestTime);
        if (bestMatches) exactBest++;
        if (bestMatches && (stored.validTimesCount ?? 0) === rebuilt.validTimesCount) exactBestAndCount++;
        absSeconds += Math.abs(storedSeconds - rebuiltSeconds);
        if (!bestMatches && examples.length < 20) {
          examples.push({
            raceId: race.raceId,
            date: dateEntry.date,
            horse: horse.name,
            stored: timeKey(stored.bestTime),
            storedCount: stored.validTimesCount,
            rebuilt: timeKey(rebuilt.bestTime),
            rebuiltCount: rebuilt.validTimesCount,
            lastRaceDate: rebuilt.lastRaceDate,
          });
        }
      }
    }
  }

  return {
    name: `${variant.mode}_${variant.sourceMode}_top${variant.topN}_${variant.historyMode}`,
    total,
    exactBest,
    exactBestAndCount,
    missingSource,
    missingStored,
    meanAbsSeconds: total ? absSeconds / total : 0,
    examples,
  };
}

async function main() {
  const datasetPath = process.argv[2] ?? 'calibration-dataset-6mo5_11.json';
  const dataset = loadDataset(datasetPath);
  const racesById = sourceRaceMap();
  const results = [];

  for (const variant of variants) {
    const variantDataset = variant.mode === 'stored'
      ? dataset
      : dataset.map(dateEntry => ({
        ...dateEntry,
        races: dateEntry.races.map((race: any) => {
          const sourceRace = racesById.get(race.raceId);
          if (!sourceRace) return { ...race, rawKmTimes: [] };
          const startsByHorseId = new Map((sourceRace.starts ?? []).map((s: any) => [String(s.horse?.id ?? ''), s]));
          const startsByPost = new Map((sourceRace.starts ?? []).map((s: any) => [String(s.postPosition ?? s.number), s]));
          return {
            ...race,
            rawKmTimes: race.raceData.horses.map((horse: any) => {
              const start = startsByHorseId.get(String(horse.horseId)) ?? startsByPost.get(String(horse.postPosition));
              return buildRawTime({ ...race.raceData, date: dateEntry.date }, start, horse, variant);
            }),
          };
        }),
      }));

    const evaluation = await evaluateWeights(variantDataset as any, weights as any, postPositionCurves as any);
    results.push({
      name: `${variant.mode}_${variant.sourceMode}_top${variant.topN}_${variant.historyMode}`,
      ...variant,
      ...evaluation,
    });
  }

  results.sort((a, b) => b.winnerMRR - a.winnerMRR);
  for (const r of results) {
    console.log(`${r.name} MRR=${r.winnerMRR.toFixed(4)} Win=${(r.winAccuracy * 100).toFixed(1)}% WTop3=${(r.winnerTop3Accuracy * 100).toFixed(1)}% WTop5=${(r.winnerTop5Accuracy * 100).toFixed(1)}% TopPickTop3=${(r.topPickAccuracy * 100).toFixed(1)}% Races=${r.racesEvaluated}`);
  }

  const comparisons = [
    { mode: 'race5_fallback', sourceMode: 'results_only', topN: 3, historyMode: 'stored_shape' },
    { mode: 'race5_fallback', sourceMode: 'stats_fallback', topN: 3, historyMode: 'stored_shape' },
    { mode: 'race5_fallback', sourceMode: 'results_only', topN: 2, historyMode: 'stored_shape' },
    { mode: 'all_before', sourceMode: 'results_only', topN: 3, historyMode: 'stored_shape' },
  ].map(v => compareRawTimes(dataset, racesById, v as Variant));

  console.log('\nRawTime recreation checks:');
  for (const c of comparisons) {
    console.log(`${c.name}: exactBest=${c.exactBest}/${c.total} exactBestAndCount=${c.exactBestAndCount}/${c.total} meanAbsSeconds=${c.meanAbsSeconds.toFixed(3)} missingSource=${c.missingSource} missingStored=${c.missingStored}`);
    for (const example of c.examples.slice(0, 5)) {
      console.log(`  ${example.raceId} ${example.horse}: stored=${example.stored} (${example.storedCount}) rebuilt=${example.rebuilt} (${example.rebuiltCount}) last=${example.lastRaceDate}`);
    }
  }

  const safeDatasetName = datasetPath.split('/').pop()?.replace(/\.json$/i, '') ?? 'dataset';
  const reportPath = `reports/rawtime-variants-${safeDatasetName}-v45weights.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ datasetPath, results, comparisons }, null, 2));
  console.log(`Saved ${reportPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
