/**
 * K-fold CV optimizer — post driverEmpirical bugfix.
 * Bootstraps driver ratings before evaluation so driverEmpirical signal flows.
 *
 * Usage:
 *   npx tsx scripts/kfold-v24.ts [dataset.json]
 */

import './node-polyfills';
import * as fs from 'fs';
import { NormalizationWeights } from '../src/services/modernKm/types';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { computeDriverRatings, saveDriverRatings, invalidateDriverRatingCache } from '../src/services/calibration/driverRatingService';

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

function createFolds(dataset: CalibrationDataset, k: number, seed = 42): FoldSplit[] {
  const indices = dataset.map((_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
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

/** Bootstrap driver ratings from a dataset subset (for honest k-fold evaluation) */
function bootstrapDriverRatings(trainDataset: CalibrationDataset): void {
  const ratings = computeDriverRatings(trainDataset);
  saveDriverRatings(ratings);
  invalidateDriverRatingCache();
}

/** K-fold score — recomputes driver ratings per fold to prevent data leakage */
async function kfoldScore(folds: FoldSplit[], weights: NormalizationWeights): Promise<{ mrr: number; win: number }> {
  let mrrSum = 0, winSum = 0;
  for (const fold of folds) {
    // Recompute driver ratings from TRAIN data only — no test data leakage
    bootstrapDriverRatings(fold.train);
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

function clamp(v: number): number { return Math.max(0, Math.min(5.0, v)); }

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function randomize(base: NormalizationWeights, amount: number, rng: () => number): NormalizationWeights {
  const w = { ...base };
  for (const key of WEIGHT_KEYS) w[key] = clamp(w[key] + (rng() * 2 - 1) * amount);
  return w;
}

async function optimize(
  folds: FoldSplit[],
  start: NormalizationWeights,
): Promise<{ weights: NormalizationWeights; mrr: number; win: number }> {
  let best = { ...start };
  let bestScore = await kfoldScore(folds, best);
  console.log(`    Start: CV-MRR=${bestScore.mrr.toFixed(4)} CV-Win=${(bestScore.win * 100).toFixed(1)}%`);

  // SA phase
  const rng = makeRng(Date.now());
  let current = { ...best }, currentScore = bestScore;
  for (let i = 0; i < 60; i++) {
    const temp = 1.0 - i / 60;
    const candidate = randomize(current, 0.3 + temp * 0.7, rng);
    const score = await kfoldScore(folds, candidate);
    const delta = score.mrr - currentScore.mrr;
    if (delta > 0 || rng() < Math.exp(delta / (temp * 0.01 + 0.001))) {
      current = candidate; currentScore = score;
      if (score.mrr > bestScore.mrr) { best = candidate; bestScore = score; }
    }
  }
  console.log(`    SA: CV-MRR=${bestScore.mrr.toFixed(4)} CV-Win=${(bestScore.win * 100).toFixed(1)}%`);

  // CD phase
  const stepSizes = [0.5, 0.3, 0.2, 0.1, 0.05];
  for (let pass = 0; pass < 10; pass++) {
    const step = stepSizes[Math.min(pass, stepSizes.length - 1)];
    let improved = false;
    for (const key of WEIGHT_KEYS) {
      const up = { ...best, [key]: clamp(best[key] + step) };
      const down = { ...best, [key]: clamp(best[key] - step) };
      const upScore = await kfoldScore(folds, up);
      const downScore = await kfoldScore(folds, down);
      if (upScore.mrr > bestScore.mrr && upScore.mrr >= downScore.mrr) {
        best = up; bestScore = upScore; improved = true;
      } else if (downScore.mrr > bestScore.mrr) {
        best = down; bestScore = downScore; improved = true;
      }
    }
    console.log(`    CD ${pass + 1} (step=${step}): CV-MRR=${bestScore.mrr.toFixed(4)} CV-Win=${(bestScore.win * 100).toFixed(1)}%${improved ? '' : ' (converged)'}`);
    if (!improved && step <= stepSizes[stepSizes.length - 1]) break;
  }
  return { weights: best, ...bestScore };
}

// ── Starting configs ────────────────────────────────────────────────

const V23: NormalizationWeights = {
  postPosition: 1.500, shoeType: 0.000, sulkyType: 0.500,
  driverPerformance: 2.200, driverForm: 0.000, driverEmpirical: 0.000,
  trackFamiliarity: 0.000, form: 5.000, distanceAdjustment: 1.000,
  raceDistanceAdjustment: 1.500, volteStartDistancePenalty: 2.200,
  startPoints: 2.500, placePercentage: 0.400, horseWinPercentage: 1.000,
  earningsPerStart: 1.300, gallopRisk: 0.000, layoffPenalty: 1.900,
  ageFactor: 0.000, genderAdjustment: 0.900, consistencyFactor: 2.000,
  trainerPerformance: 1.500,
};

const STARTS: Record<string, NormalizationWeights> = {
  // V23 + empirical at sweet spot
  'V23+Emp2': { ...V23, driverEmpirical: 2.0 },
  // V23 + empirical high
  'V23+Emp3': { ...V23, driverEmpirical: 3.0 },
  // V23 + empirical, reduced driverPerf (avoid double-counting driver signal)
  'V23+Emp-LowDP': { ...V23, driverEmpirical: 2.5, driverPerformance: 1.0 },
  // V23 + empirical + driverForm (test both driver signals)
  'V23+AllDriver': { ...V23, driverEmpirical: 2.0, driverForm: 0.5, driverPerformance: 2.5 },
  // Fresh start with empirical prominent
  'EmpHeavy': {
    postPosition: 1.5, shoeType: 0, sulkyType: 0.5,
    driverPerformance: 1.0, driverForm: 0, driverEmpirical: 3.0,
    trackFamiliarity: 0, form: 4.0, distanceAdjustment: 1.0,
    raceDistanceAdjustment: 1.5, volteStartDistancePenalty: 2.0,
    startPoints: 2.5, placePercentage: 0.5, horseWinPercentage: 1.0,
    earningsPerStart: 1.5, gallopRisk: 0, layoffPenalty: 2.0,
    ageFactor: 0, genderAdjustment: 1.0, consistencyFactor: 2.0,
    trainerPerformance: 2.0,
  },
};

async function main() {
  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  console.log(`Loading ${datasetPath}…`);
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const dataset = hydrateDataset(raw);
  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
  console.log(`Dataset: ${dataset.length} dates, ${totalRaces} races\n`);

  const folds = createFolds(dataset, 5);

  const results: { name: string; weights: NormalizationWeights; mrr: number; win: number }[] = [];

  for (const [name, startW] of Object.entries(STARTS)) {
    console.log(`\n── ${name} ──`);
    const r = await optimize(folds, startW);
    // Full eval with ratings from ALL data
    bootstrapDriverRatings(dataset);
    const full = await evaluateWeights(dataset, r.weights);
    console.log(`  ✓ CV-MRR=${r.mrr.toFixed(4)} CV-Win=${(r.win*100).toFixed(1)}%  Full=${(full.winAccuracy*100).toFixed(1)}% Top3=${(full.topPickAccuracy*100).toFixed(1)}%`);
    results.push({ name, ...r });
  }

  results.sort((a, b) => b.mrr - a.mrr);

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('RANKINGS:');
  bootstrapDriverRatings(dataset);
  for (const r of results) {
    const full = await evaluateWeights(dataset, r.weights);
    console.log(`  ${r.name.padEnd(22)} CV-Win=${(r.win*100).toFixed(1)}%  CV-MRR=${r.mrr.toFixed(4)}  Full=${(full.winAccuracy*100).toFixed(1)}%  Top3=${(full.topPickAccuracy*100).toFixed(1)}%`);
  }

  const best = results[0];
  const cleanW: Record<string, number> = {};
  for (const key of WEIGHT_KEYS) cleanW[key] = Math.round(best.weights[key] * 1000) / 1000;
  console.log(`\nBEST: ${best.name}`);
  console.log(JSON.stringify(cleanW, null, 2));
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => { console.error(err); process.exit(1); });
