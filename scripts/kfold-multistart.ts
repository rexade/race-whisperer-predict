/**
 * Multi-start K-fold CV optimizer.
 * Runs coordinate descent from multiple starting points to escape local optima.
 *
 * Usage:
 *   npx tsx scripts/kfold-multistart.ts [dataset.json]
 */

import { DEFAULT_WEIGHTS, NormalizationWeights } from '../src/services/modernKm/types';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { CalibrationDataset, evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { loadDataset } from './cli-common';

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
    w[key] = clamp((w[key] ?? 0) + (rng() * 2 - 1) * amount);
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

// Start from the actual quick presets plus DEFAULT. This keeps multistart aligned
// with the UI and allows V32 Experimental to compete without making it default.
function buildStarts(): Record<string, NormalizationWeights> {
  const starts: Record<string, NormalizationWeights> = {
    DEFAULT: DEFAULT_WEIGHTS,
  };

  for (const preset of WEIGHT_PRESETS) {
    starts[preset.name] = preset.weights;
  }

  const v32 = WEIGHT_PRESETS.find(p => p.name.toLowerCase().includes('v32'))?.weights;
  if (v32) {
    starts['V32 jitter 0.5 seed 111'] = jitter(v32, 0.5, makeRng(111));
    starts['V32 jitter 0.5 seed 222'] = jitter(v32, 0.5, makeRng(222));
    starts['V32 jitter 1.0 seed 333'] = jitter(v32, 1.0, makeRng(333));
  }

  return starts;
}

function makeRng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npx tsx scripts/kfold-multistart.ts [dataset.json]');
    console.log('       npx tsx scripts/kfold-multistart.ts --list-starts');
    console.log('');
    console.log('Runs K-fold coordinate descent from DEFAULT, every quick preset, and V32 jitter starts.');
    return;
  }

  if (process.argv.includes('--list-starts')) {
    const starts = buildStarts();
    console.log(Object.keys(starts).join('\n'));
    return;
  }

  const datasetPath = process.argv[2] || 'calibration-dataset-6mo.json';
  const dataset = loadDataset(datasetPath);
  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);

  const K = 5;
  const PASSES = 8;
  const folds = createFolds(dataset, K);
  const starts = buildStarts();

  const results: { name: string; weights: NormalizationWeights; mrr: number; win: number }[] = [];

  for (const [name, startW] of Object.entries(starts)) {
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
