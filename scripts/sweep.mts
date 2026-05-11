// scripts/sweep.mts
// Phase 1 pipeline sweep — 6 cells: (top-N ∈ {1,2,3}) × (byDistance ∈ {off,on}).
//
// Reads the cached calibration dataset JSON, re-aggregates each horse's bestTime
// at the configured top-N, optionally strips byDistance from the curves, and
// runs each race through the production scoring pipeline. Emits a results table.
//
// Run (from project root):
//   npx tsx scripts/sweep.mts [path-to-dataset.json]
// Default dataset path: ./calibration-dataset-6mo.json

// --- Fetch shim ---
// Production code in loadKmTimeRecords() calls fetch('/kmTimeRecords.json').
// In Node, return empty so the rest of the pipeline runs unchanged.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  if (url.endsWith('kmTimeRecords.json') || url.includes('kmTimeRecords')) {
    return new Response(JSON.stringify({ byHorse: {}, dates: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (realFetch) return realFetch(input, init);
  throw new Error(`fetch unavailable for: ${url}`);
}) as typeof fetch;

import { readFileSync } from 'node:fs';
import { RaceResultProcessor } from '../src/components/v75/services/raceResultProcessor';
import { toSeconds, secondsToKmParts } from '../src/services/utils/robustTimeConversion';
import type { HorseRawKmTime, KmTime, ProcessedKmTime } from '../src/services/types/kmTimeTypes';
import type { NormalizationWeights } from '../src/services/modernKm/types';
import type { PostPositionCurves } from '../src/services/modernKm/index';

// ---------------------------------------------------------------------------
// Active config: custom_weights id=65 — V37 weights + byDistance buckets.
// Frozen across all cells so we measure pipeline contribution, not optimizer noise.
// ---------------------------------------------------------------------------

const WEIGHTS = {
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
} as unknown as NormalizationWeights;

const CURVES_WITH_BYDIST: PostPositionCurves = {
  auto:  { 1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.169, 8: 0.272, 9: 0.992, 10: 0.537, 11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047 },
  volte: { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
  byDistance: {
    auto: {
      short:  { 1: -0.114, 2: 0.014, 3: -0.226, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.219, 8: 0.272, 9: 0.992, 10: 0.537, 11: 0.464, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047 },
      medium: { 1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.019, 6: 0.063, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537, 11: 0.464, 12: 0.788, 13: 1.033, 14: 0.551, 15: 1.047 },
      long:   { 1: -0.114, 2: 0.014, 3: -0.176, 4: -0.099, 5: 0.069, 6: 0.013, 7: 0.169, 8: 0.272, 9: 0.967, 10: 0.537, 11: 0.489, 12: 0.838, 13: 1.033, 14: 0.551, 15: 1.047 },
    },
    volte: {
      short:  { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.336, 7: 0.404, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
      medium: { 1: -0.658, 2: 0.054, 3: 0.014, 4: 0.180, 5: 0.171, 6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.632, 12: 1.042, 13: 1.357, 14: 0.994, 15: 0.862 },
      long:   { 1: -0.658, 2: 0.104, 3: 0.014, 4: 0.180, 5: 0.221, 6: 0.336, 7: 0.454, 8: -0.009, 9: 0.722, 10: 0.430, 11: 0.682, 12: 0.992, 13: 1.357, 14: 0.994, 15: 0.862 },
    },
  },
} as any;

const CURVES_FLAT: PostPositionCurves = { auto: CURVES_WITH_BYDIST.auto, volte: CURVES_WITH_BYDIST.volte };

// ---------------------------------------------------------------------------
// Aggregation: re-pick bestTime from each horse's allTimes at given top-N.
// ---------------------------------------------------------------------------

function aggregateBestTime(allTimes: ProcessedKmTime[] | undefined, topN: number): KmTime {
  if (!allTimes || allTimes.length === 0) return { minutes: 0, seconds: 0, tenths: 0 };
  const valid = allTimes
    .filter(t => t.valid !== false && t.normalizedTime && (t.normalizedTime.minutes > 0 || t.normalizedTime.seconds > 0))
    .slice()
    .sort((a, b) => {
      const ta = toSeconds(a.normalizedTime.minutes, a.normalizedTime.seconds, a.normalizedTime.tenths ?? 0);
      const tb = toSeconds(b.normalizedTime.minutes, b.normalizedTime.seconds, b.normalizedTime.tenths ?? 0);
      return ta - tb;
    });
  const n = Math.min(valid.length, topN);
  if (n === 0) return { minutes: 0, seconds: 0, tenths: 0 };
  if (n === 1) return { ...valid[0].normalizedTime };
  const total = valid.slice(0, n).reduce((sum, t) =>
    sum + toSeconds(t.normalizedTime.minutes, t.normalizedTime.seconds, t.normalizedTime.tenths ?? 0), 0);
  return secondsToKmParts(total / n);
}

// ---------------------------------------------------------------------------
// Cell evaluation
// ---------------------------------------------------------------------------

interface CellMetrics {
  cell: string;
  topN: number;
  byDistance: boolean;
  races: number;
  winRate: number;
  wTop3: number;
  wTop5: number;
  mrr: number;
  topPickTop3: number;
}

async function evalCell(dataset: any[], topN: number, useByDistance: boolean): Promise<CellMetrics> {
  const curves = useByDistance ? CURVES_WITH_BYDIST : CURVES_FLAT;

  let winnerRaces = 0;
  let winCount = 0;
  let top3Count = 0;
  let top5Count = 0;
  let mrrSum = 0;
  let topPicksCorrect = 0;
  let topPicksTotal = 0;

  for (const dateData of dataset) {
    for (const race of dateData.races) {
      try {
        const adjustedRawKmTimes = race.rawKmTimes.map((rt: any) => ({
          ...rt,
          bestTime: aggregateBestTime(rt.allTimes, topN),
        })) as HorseRawKmTime[];

        const result: any = await RaceResultProcessor.processRaceResult(
          race.raceData,
          adjustedRawKmTimes,
          WEIGHTS,
          undefined,
          curves,
        );

        if (!result || !result.horses || result.horses.length === 0) continue;
        const horses = result.horses;

        const actualResults: Record<string, { position: number }> = race.actualResults || {};

        // Find actual winner
        let winnerKey: string | null = null;
        for (const [key, v] of Object.entries(actualResults)) {
          if (v.position === 1) { winnerKey = key; break; }
        }

        if (winnerKey) {
          const winnerHorse = horses.find((h: any) => (h.horseKey ?? String(h.horseId)) === winnerKey);
          if (winnerHorse?.rank) {
            winnerRaces++;
            if (winnerHorse.rank === 1) winCount++;
            if (winnerHorse.rank <= 3) top3Count++;
            if (winnerHorse.rank <= 5) top5Count++;
            mrrSum += 1 / winnerHorse.rank;
          }
        }

        // Of our top-3 picks, how many actually placed top-3?
        for (const h of horses) {
          if (h.rank && h.rank <= 3) {
            const key = h.horseKey ?? String(h.horseId);
            const actual = actualResults[key];
            if (actual) {
              topPicksTotal++;
              if (actual.position <= 3) topPicksCorrect++;
            }
          }
        }
      } catch {
        // skip
      }
    }
  }

  return {
    cell: `top${topN}-${useByDistance ? 'byD' : 'flat'}`,
    topN,
    byDistance: useByDistance,
    races: winnerRaces,
    winRate:     winnerRaces > 0 ? winCount   / winnerRaces : 0,
    wTop3:       winnerRaces > 0 ? top3Count  / winnerRaces : 0,
    wTop5:       winnerRaces > 0 ? top5Count  / winnerRaces : 0,
    mrr:         winnerRaces > 0 ? mrrSum     / winnerRaces : 0,
    topPickTop3: topPicksTotal > 0 ? topPicksCorrect / topPicksTotal : 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const datasetPath = process.argv[2] ?? './calibration-dataset-6mo.json';
  console.log(`Loading dataset: ${datasetPath}`);
  const raw = readFileSync(datasetPath, 'utf-8');
  const dataset = JSON.parse(raw);
  const raceCount = dataset.reduce((s: number, d: any) => s + (d.races?.length ?? 0), 0);
  console.log(`Dataset: ${dataset.length} dates, ${raceCount} races\n`);

  const cells: CellMetrics[] = [];
  for (const topN of [1, 2, 3]) {
    for (const useByDistance of [false, true]) {
      const label = `top-${topN} ${useByDistance ? 'byDist' : 'flat  '}`;
      process.stdout.write(`Cell ${label}... `);
      const start = Date.now();
      const metrics = await evalCell(dataset, topN, useByDistance);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[${elapsed}s, ${metrics.races} races scored]`);
      cells.push(metrics);
    }
  }

  // Render table
  const pct = (x: number) => (x * 100).toFixed(1).padStart(5) + '%';
  const pad = (s: string, n: number) => s.padEnd(n);

  console.log('\n=== Pipeline sweep — frozen at custom_weights id=65 (V37 + byDistance) ===\n');
  console.log('| ' + pad('cell', 14) + ' | ' + pad('races', 5) + ' | ' + pad('Win', 7) + ' | ' + pad('WTop3', 7) + ' | ' + pad('WTop5', 7) + ' | ' + pad('MRR', 6) + ' | ' + pad('TopPickT3', 9) + ' |');
  console.log('|' + '-'.repeat(16) + '|' + '-'.repeat(7) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(9) + '|' + '-'.repeat(8) + '|' + '-'.repeat(11) + '|');
  for (const c of cells) {
    console.log('| ' + pad(c.cell, 14) + ' | ' + pad(String(c.races), 5) + ' | ' + pct(c.winRate) + ' | ' + pct(c.wTop3) + ' | ' + pct(c.wTop5) + ' | ' + c.mrr.toFixed(3).padStart(5) + ' | ' + pct(c.topPickTop3) + '   |');
  }

  const bestT3 = cells.reduce((a, b) => b.topPickTop3 > a.topPickTop3 ? b : a);
  const bestMrr = cells.reduce((a, b) => b.mrr > a.mrr ? b : a);
  console.log(`\nBest TopPickTop3: ${bestT3.cell} (${pct(bestT3.topPickTop3).trim()})`);
  console.log(`Best MRR:         ${bestMrr.cell} (${bestMrr.mrr.toFixed(3)})`);

  // Deltas from top-3 byDist (current Pi prod config)
  const current = cells.find(c => c.topN === 3 && c.byDistance);
  if (current) {
    console.log(`\nDeltas vs current Pi (top3-byD):`);
    for (const c of cells) {
      if (c === current) continue;
      const dWin = ((c.winRate - current.winRate) * 100).toFixed(2).padStart(6);
      const dT3  = ((c.wTop3 - current.wTop3) * 100).toFixed(2).padStart(6);
      const dT5  = ((c.wTop5 - current.wTop5) * 100).toFixed(2).padStart(6);
      const dMrr = (c.mrr - current.mrr).toFixed(3).padStart(6);
      const dPT3 = ((c.topPickTop3 - current.topPickTop3) * 100).toFixed(2).padStart(6);
      console.log(`  ${c.cell.padEnd(14)}  ΔWin=${dWin}pp  ΔWT3=${dT3}pp  ΔWT5=${dT5}pp  ΔMRR=${dMrr}  ΔTopPickT3=${dPT3}pp`);
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
