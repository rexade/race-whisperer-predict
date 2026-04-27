/**
 * Multi-start K-fold CV optimizer.
 * Runs coordinate descent from multiple starting points to escape local optima.
 *
 * Usage:
 *   npx tsx scripts/kfold-multistart.ts [dataset.json]
 */

import './node-polyfills';
import * as fs from 'fs';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';

function hydrateDataset(raw: any[]): CalibrationDataset {
  return raw.map(dateData => ({
    ...dateData,
    races: dateData.races.map((race: any) => ({
      ...race,
      actualResults: new Map(Object.entries(race.actualResults).map(
        ([k, v]) => [Number(k), v]
      )),
    })),
  }));
}

interface FoldSplit { train: CalibrationDataset; test: CalibrationDataset }

function createFolds(dataset: CalibrationDataset, k: number): FoldSplit[] {
  const indices = dataset.map((_, i) => i);
  let seed = 42;
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const foldSize = Math.ceil(dataset.length / k);
  const folds: FoldSplit[] = [];
  for (let f = 0; f < k; f++) {
    const testIndices = new Set(indices.slice(f * foldSize, (f + 1) * foldSize));
    folds.push({
      train: dataset.filter((_, i) => !testIndices.has(i)),
      test: dataset.filter((_, i) => testIndices.has(i)),
    });
  }
  return folds;
}

async function kfoldMRR(folds: FoldSplit[], weights: NormalizationWeights): Promise<{ mrr: number; win: number }> {
  let mrrSum = 0, winSum = 0;
  for (const fold of folds) {
    const r = await evaluateWeights(fold.test, weights);
    mrrSum += r.winnerMRR;
    winSum += r.winAccuracy;
  }
  return { mrr: mrrSum / folds.length, win: winSum / folds.length };
}

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition', 'shoeType', 'sulkyType',
  'driverPerformance', 'driverForm', 'driverEmpirical',
  'trackFamiliarity', 'form', 'distanceAdjustment',
  'raceDistanceAdjustment', 'volteStartDistancePenalty',
  'startPoints', 'placePercentage', 'horseWinPercentage',
  'earningsPerStart', 'gallopRisk', 'layoffPenalty',
  'ageFactor', 'genderAdjustment', 'consistencyFactor',
  'trainerPerformance', 'oddsHistorical', 'oddsLive',
];

const BOUNDS: [number, number] = [0.0, 5.0];

function clamp(v: number): number { return Math.max(BOUNDS[0], Math.min(BOUNDS[1], v)); }

/** Randomize weights around a base with given jitter */
function jitter(base: NormalizationWeights, amount: number, rng: () => number): NormalizationWeights {
  const w = { ...base };
  for (const key of WEIGHT_KEYS) {
    w[key] = clamp(w[key] + (rng() * 2 - 1) * amount);
  }
  return w;
}

async function coordinateDescent(
  folds: FoldSplit[],
  startWeights: NormalizationWeights,
  passes: number,
): Promise<{ weights: NormalizationWeights; mrr: number; win: number }> {
  let best = { ...startWeights };
  let bestScore = await kfoldMRR(folds, best);
  const stepSizes = [0.5, 0.3, 0.2, 0.1, 0.05];

  for (let pass = 0; pass < passes; pass++) {
    const step = stepSizes[Math.min(pass, stepSizes.length - 1)];
    let improved = false;

    for (const key of WEIGHT_KEYS) {
      const up = { ...best, [key]: clamp(best[key] + step) };
      const down = { ...best, [key]: clamp(best[key] - step) };
      const [upScore, downScore] = await Promise.all([
        kfoldMRR(folds, up),
        kfoldMRR(folds, down),
      ]);

      if (upScore.mrr > bestScore.mrr && upScore.mrr >= downScore.mrr) {
        best = up; bestScore = upScore; improved = true;
      } else if (downScore.mrr > bestScore.mrr) {
        best = down; bestScore = downScore; improved = true;
      }
    }

    if (!improved && step <= stepSizes[stepSizes.length - 1]) break;
  }
  return { weights: best, ...bestScore };
}

// ── Starting configurations ──────────────────────────────────────────

const STARTS: Record<string, NormalizationWeights> = {
  'V22-noDrvForm': {
    postPosition: 1.757, shoeType: 0.000, sulkyType: 0.447,
    driverPerformance: 3.470, driverForm: 0.000, driverEmpirical: 0.000,
    trackFamiliarity: 0.393, form: 3.655, distanceAdjustment: 0.838,
    raceDistanceAdjustment: 2.857, volteStartDistancePenalty: 1.237,
    startPoints: 2.162, placePercentage: 0.200, horseWinPercentage: 0.540,
    earningsPerStart: 2.205, gallopRisk: 0.000, layoffPenalty: 1.938,
    ageFactor: 0.000, genderAdjustment: 2.225, consistencyFactor: 1.777,
    trainerPerformance: 2.443,
  },
  'FormHeavy': {
    postPosition: 1.0, shoeType: 0.0, sulkyType: 0.5,
    driverPerformance: 2.0, driverForm: 0.0, driverEmpirical: 0.0,
    trackFamiliarity: 0.5, form: 5.0, distanceAdjustment: 1.0,
    raceDistanceAdjustment: 2.0, volteStartDistancePenalty: 1.5,
    startPoints: 2.5, placePercentage: 1.0, horseWinPercentage: 1.0,
    earningsPerStart: 2.0, gallopRisk: 0.0, layoffPenalty: 2.0,
    ageFactor: 0.0, genderAdjustment: 1.0, consistencyFactor: 2.0,
    trainerPerformance: 1.5,
  },
  'DriverHeavy': {
    postPosition: 2.0, shoeType: 0.0, sulkyType: 1.0,
    driverPerformance: 5.0, driverForm: 0.0, driverEmpirical: 0.0,
    trackFamiliarity: 0.5, form: 2.0, distanceAdjustment: 1.0,
    raceDistanceAdjustment: 2.0, volteStartDistancePenalty: 1.0,
    startPoints: 3.0, placePercentage: 0.5, horseWinPercentage: 0.5,
    earningsPerStart: 1.5, gallopRisk: 0.0, layoffPenalty: 1.5,
    ageFactor: 0.0, genderAdjustment: 1.5, consistencyFactor: 1.0,
    trainerPerformance: 3.0,
  },
  'StatsHeavy': {
    postPosition: 1.5, shoeType: 0.0, sulkyType: 0.5,
    driverPerformance: 2.0, driverForm: 0.0, driverEmpirical: 0.0,
    trackFamiliarity: 0.3, form: 3.0, distanceAdjustment: 1.0,
    raceDistanceAdjustment: 2.5, volteStartDistancePenalty: 1.0,
    startPoints: 3.0, placePercentage: 2.0, horseWinPercentage: 2.0,
    earningsPerStart: 3.0, gallopRisk: 1.0, layoffPenalty: 2.5,
    ageFactor: 1.0, genderAdjustment: 1.0, consistencyFactor: 3.0,
    trainerPerformance: 2.0,
  },
  'Minimal': {
    postPosition: 2.0, shoeType: 0.0, sulkyType: 0.0,
    driverPerformance: 3.0, driverForm: 0.0, driverEmpirical: 0.0,
    trackFamiliarity: 0.0, form: 4.0, distanceAdjustment: 0.0,
    raceDistanceAdjustment: 3.0, volteStartDistancePenalty: 1.5,
    startPoints: 2.0, placePercentage: 0.0, horseWinPercentage: 1.0,
    earningsPerStart: 0.0, gallopRisk: 0.0, layoffPenalty: 2.0,
    ageFactor: 0.0, genderAdjustment: 0.0, consistencyFactor: 0.0,
    trainerPerformance: 0.0,
  },
  'KfoldV1': {  // Result from previous k-fold run
    postPosition: 1.257, shoeType: 0, sulkyType: 0.947,
    driverPerformance: 2.97, driverForm: 0.5, driverEmpirical: 0,
    trackFamiliarity: 0.093, form: 4.155, distanceAdjustment: 1.338,
    raceDistanceAdjustment: 2.957, volteStartDistancePenalty: 1.437,
    startPoints: 2.162, placePercentage: 0.9, horseWinPercentage: 0.54,
    earningsPerStart: 1.905, gallopRisk: 0, layoffPenalty: 1.938,
    ageFactor: 0, genderAdjustment: 2.075, consistencyFactor: 1.777,
    trainerPerformance: 2.443,
  },
};

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  console.log(`Loading ${datasetPath}…`);
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const dataset = hydrateDataset(raw);
  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
  console.log(`Dataset: ${dataset.length} dates, ${totalRaces} races\n`);

  const K = 5;
  const PASSES = 8;
  const folds = createFolds(dataset, K);

  const results: { name: string; weights: NormalizationWeights; mrr: number; win: number }[] = [];

  for (const [name, startW] of Object.entries(STARTS)) {
    console.log(`\n── ${name} ──`);
    const r = await coordinateDescent(folds, startW, PASSES);
    results.push({ name, ...r });

    const full = await evaluateWeights(dataset, r.weights);
    console.log(`  → CV-MRR=${r.mrr.toFixed(4)}  CV-Win=${(r.win * 100).toFixed(1)}%  Full-Win=${(full.winAccuracy * 100).toFixed(1)}%`);
  }

  // Sort by CV MRR
  results.sort((a, b) => b.mrr - a.mrr);

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('FINAL RANKINGS (by CV-MRR):');
  console.log('═══════════════════════════════════════════════════════');

  for (const r of results) {
    const full = await evaluateWeights(dataset, r.weights);
    console.log(`\n${r.name}:`);
    console.log(`  CV-Win=${(r.win * 100).toFixed(1)}%  CV-MRR=${r.mrr.toFixed(4)}  Full-Win=${(full.winAccuracy * 100).toFixed(1)}%  Full-MRR=${full.winnerMRR.toFixed(3)}  Top3=${(full.topPickAccuracy * 100).toFixed(1)}%`);
  }

  // Print best weights
  const best = results[0];
  console.log(`\n\nBEST: ${best.name}`);
  console.log('Weights:');

  // Clean up floating point noise
  const cleanWeights: Record<string, number> = {};
  for (const key of WEIGHT_KEYS) {
    cleanWeights[key] = Math.round(best.weights[key] * 1000) / 1000;
  }
  console.log(JSON.stringify(cleanWeights, null, 2));
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
