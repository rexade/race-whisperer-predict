import fs from 'fs';
import { loadDataset } from '../cli-common';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import type { HorseRawKmTime, KmTime, ProcessedKmTime } from '../src/services/types/kmTimeTypes';

type CutoffMode = 'off' | 'recent5_fallback_all' | 'recent5_fill_topn';
type SourceMode = 'results_only' | 'stats_fallback' | 'all_sources';
type HistoryMode = 'stored_shape' | 'full_all_times';
type Variant = {
  cutoff: CutoffMode;
  sourceMode: SourceMode;
  topN: number;
  historyMode: HistoryMode;
};

const REFERENCE_DIST = 2140;
const SHORTER_RATE = 3.2;
const LONGER_RATE = 2.0;
const DIST_TOLERANCE = 10;
const VOLTE_ADV_S = 1.0;

// Browser 45.4% block pasted by the user. Replace with a 6-decimal copied block
// when available; this 3-decimal copy is enough to compare extraction variants.
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

const variants: Variant[] = (['results_only', 'stats_fallback', 'all_sources'] as SourceMode[])
  .flatMap(sourceMode => (['off', 'recent5_fallback_all', 'recent5_fill_topn'] as CutoffMode[])
    .flatMap(cutoff => [1, 2, 3, 4, 5]
      .flatMap(topN => (['stored_shape', 'full_all_times'] as HistoryMode[])
        .map(historyMode => ({ sourceMode, cutoff, topN, historyMode })))));

function isNumericKmTime(t: any): t is KmTime {
  return t && typeof t.minutes === 'number' && typeof t.seconds === 'number';
}

function kmTimeToSeconds(t: KmTime): number {
  return t.minutes * 60 + t.seconds + (t.tenths ?? 0) / 10;
}

function secondsToKmTime(totalSeconds: number): KmTime {
  const minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds - minutes * 60);
  let tenths = Math.round((totalSeconds - minutes * 60 - seconds) * 10);
  if (tenths === 10) {
    seconds += 1;
    tenths = 0;
  }
  return { minutes, seconds, tenths };
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

function sourceOf(record: any): string {
  return String(record.meta?.source ?? 'results');
}

function isAggregate(record: any): boolean {
  return ['statistics', 'record-best'].includes(sourceOf(record));
}

function recordStartMethod(record: any): string {
  return record.startMethod ?? record.meta?.startMethod ?? 'auto';
}

function recordDistance(record: any): number {
  return record.distance ?? (
    record.meta?.distance === 'short' ? 1640 :
    record.meta?.distance === 'long' ? 2640 :
    2140
  );
}

function isProcessable(record: any): boolean {
  if (record.galloped || record.disqualified || !isNumericKmTime(record.kmTime)) return false;
  return normalizeKm(record.kmTime, recordDistance(record), recordStartMethod(record)) !== null;
}

function filterBySource(records: any[], mode: SourceMode, raceDate: string): any[] {
  const resultRecords = records.filter(r => sourceOf(r) === 'results');
  if (mode === 'results_only') return resultRecords;
  if (mode === 'all_sources') return records;

  const resultBefore = resultRecords.filter(r => r.date && recordDateMs(r) < new Date(raceDate).getTime());
  return resultBefore.some(isProcessable) ? resultRecords : records;
}

function splitWindows(records: any[], raceDate: string) {
  const upper = new Date(raceDate).getTime();
  const cutoff = new Date(raceDate);
  cutoff.setMonth(cutoff.getMonth() - 5);
  const cutoffMs = cutoff.getTime();
  const dated = records
    .filter(r => r.date && recordDateMs(r) < upper)
    .sort((a, b) => recordDateMs(b) - recordDateMs(a));
  const aggregate = records.filter(r => !r.date && isAggregate(r));
  return {
    allBefore: [...dated, ...aggregate],
    recent: [...dated.filter(r => recordDateMs(r) >= cutoffMs), ...aggregate],
    older: dated.filter(r => recordDateMs(r) < cutoffMs),
    recentRaw: dated.filter(r => recordDateMs(r) >= cutoffMs),
  };
}

function processRecord(record: any): ProcessedKmTime | null {
  if (record.galloped || record.disqualified || !isNumericKmTime(record.kmTime)) return null;
  const normalized = normalizeKm(record.kmTime, recordDistance(record), recordStartMethod(record));
  if (!normalized) return null;
  return {
    originalTime: {
      minutes: record.kmTime.minutes,
      seconds: record.kmTime.seconds,
      tenths: record.kmTime.tenths ?? 0,
    },
    normalizedTime: normalized,
    raceDate: record.date,
    distance: recordDistance(record),
    startMethod: recordStartMethod(record),
    finishOrder: parseInt(String(record.place ?? record.finishOrder ?? '0'), 10) || 0,
    postPosition: record.postPosition,
    valid: true,
    raceId: record.raceId,
  } as ProcessedKmTime;
}

function sortedProcessed(records: any[]): ProcessedKmTime[] {
  return records
    .map(processRecord)
    .filter((item): item is ProcessedKmTime => item !== null)
    .sort((a, b) => kmTimeToSeconds(a.normalizedTime) - kmTimeToSeconds(b.normalizedTime));
}

function candidatePool(records: any[], raceDate: string, variant: Variant): { source: any[]; averagingPool: ProcessedKmTime[] } {
  const windows = splitWindows(records, raceDate);
  if (variant.cutoff === 'off') {
    const source = windows.allBefore;
    return { source, averagingPool: sortedProcessed(source) };
  }

  if (variant.cutoff === 'recent5_fill_topn') {
    const recent = sortedProcessed(windows.recent);
    const older = sortedProcessed(windows.older);
    const averagingPool = recent.length >= variant.topN
      ? recent
      : [...recent, ...older.slice(0, variant.topN - recent.length)];
    return { source: windows.recent.length ? windows.recent : windows.allBefore, averagingPool };
  }

  const recent = sortedProcessed(windows.recent);
  const source = recent.length ? windows.recent : windows.allBefore;
  return { source, averagingPool: sortedProcessed(source) };
}

function buildRawTime(race: any, candidateHorse: any, horse: any, variant: Variant): HorseRawKmTime {
  const raceDate = race.date;
  const sourceRecords = filterBySource(candidateHorse?.records ?? [], variant.sourceMode, raceDate);
  const { source, averagingPool } = candidatePool(sourceRecords, raceDate, variant);
  const n = Math.min(variant.topN, averagingPool.length);
  const bestTime = n > 0
    ? secondsToKmTime(averagingPool.slice(0, n).reduce((sum, t) => sum + kmTimeToSeconds(t.normalizedTime), 0) / n)
    : { minutes: 0, seconds: 0, tenths: 0 };
  const allProcessed = sortedProcessed(source);
  const recentStarts = source.filter(r => r.date).sort((a, b) => recordDateMs(b) - recordDateMs(a)).slice(0, 10);
  const galloped = recentStarts.filter(r => r.galloped);

  return {
    horseKey: horse.horseKey,
    horseId: horse.horseId,
    horseName: typeof horse.name === 'string' ? horse.name : String(horse.name),
    allTimes: variant.historyMode === 'full_all_times' ? allProcessed : [],
    bestTime,
    rawBestTime: bestTime,
    bestRecordTime: allProcessed[0]?.normalizedTime ?? { minutes: 0, seconds: 0, tenths: 0 },
    validTimesCount: allProcessed.length,
    dataSource: sourceRecords.some(r => sourceOf(r) !== 'results') ? 'fallback' : 'recent',
    gallopCount: galloped.length,
    gallopDates: galloped.map(r => r.date).filter(Boolean),
    gallopRate: recentStarts.length ? galloped.length / recentStarts.length : 0,
    lastRaceDate: recentStarts[0]?.date,
  };
}

function loadCandidateArchive(path: string): Map<string, any> {
  const archive = JSON.parse(fs.readFileSync(path, 'utf8'));
  const out = new Map<string, any>();
  for (const dateEntry of Object.values<any>(archive.dates ?? {})) {
    for (const race of dateEntry.races ?? []) {
      out.set(race.raceId, race.candidateData);
    }
  }
  return out;
}

function horseCandidateMap(candidateRace: any): { byId: Map<string, any>; byPost: Map<string, any>; byName: Map<string, any> } {
  return {
    byId: new Map((candidateRace?.horses ?? []).map((h: any) => [String(h.horseId ?? ''), h])),
    byPost: new Map((candidateRace?.horses ?? []).map((h: any) => [String(h.postPosition ?? h.startNumber ?? ''), h])),
    byName: new Map((candidateRace?.horses ?? []).map((h: any) => [String(h.horseName ?? ''), h])),
  };
}

async function main() {
  const datasetPath = process.argv[2] ?? 'calibration-dataset-6mo_lat_5_11_3.json';
  const candidatePath = process.argv[3] ?? 'reports/rawtime-candidates-6mo5_11.json';
  const dataset = loadDataset(datasetPath);
  const candidateByRace = loadCandidateArchive(candidatePath);
  const results = [];

  for (const variant of variants) {
    const variantDataset = dataset.map((dateEntry: any) => ({
      ...dateEntry,
      races: (dateEntry.races ?? []).map((race: any) => {
        const candidateRace = candidateByRace.get(race.raceId);
        const maps = horseCandidateMap(candidateRace);
        return {
          ...race,
          rawKmTimes: (race.raceData.horses ?? []).map((horse: any) => {
            const candidateHorse =
              maps.byId.get(String(horse.horseId ?? '')) ??
              maps.byPost.get(String(horse.postPosition ?? '')) ??
              maps.byName.get(String(horse.name ?? ''));
            return buildRawTime({ ...race.raceData, date: dateEntry.date }, candidateHorse, horse, variant);
          }),
        };
      }),
    }));

    const evaluation = await evaluateWeights(variantDataset as any, weights as any, postPositionCurves as any);
    results.push({
      name: `${variant.sourceMode}_${variant.cutoff}_top${variant.topN}_${variant.historyMode}`,
      ...variant,
      ...evaluation,
    });
  }

  results.sort((a, b) =>
    b.winnerMRR - a.winnerMRR ||
    b.winAccuracy - a.winAccuracy ||
    b.winnerTop3Accuracy - a.winnerTop3Accuracy
  );

  console.log(`Dataset: ${datasetPath}`);
  console.log(`Candidates: ${candidatePath}`);
  for (const r of results.slice(0, 30)) {
    console.log(`${r.name} MRR=${r.winnerMRR.toFixed(4)} Win=${(r.winAccuracy * 100).toFixed(1)}% WTop3=${(r.winnerTop3Accuracy * 100).toFixed(1)}% WTop5=${(r.winnerTop5Accuracy * 100).toFixed(1)}% TopPickTop3=${(r.topPickAccuracy * 100).toFixed(1)}% Races=${r.racesEvaluated}`);
  }

  const safeDataset = datasetPath.split('/').pop()?.replace(/\.json$/i, '') ?? 'dataset';
  const reportPath = `reports/rawtime-candidate-variants-${safeDataset}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ datasetPath, candidatePath, weights, postPositionCurves, results }, null, 2));
  console.log(`Saved ${reportPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
