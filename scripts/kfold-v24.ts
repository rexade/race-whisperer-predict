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
import { hydrateDataset } from './cli-common';

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
  for (const key of WEIGHT_KEYS) w[key] = clamp((w[key] ?? 0) + (rng() * 2 - 1) * amount);
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

// V24 — baseline (Run 73, 2026-04-28)
const V24: NormalizationWeights = {
  postPosition: 1.500, shoeType: 0.000, sulkyType: 0.500,
  driverPerformance: 2.200, driverForm: 0.000, driverEmpirical: 0.000,
  trackFamiliarity: 0.000, form: 5.000, distanceAdjustment: 1.000,
  raceDistanceAdjustment: 1.500, volteStartDistancePenalty: 2.250,
  startPoints: 2.500, placePercentage: 0.400, horseWinPercentage: 1.000,
  earningsPerStart: 1.600, gallopRisk: 0.000, layoffPenalty: 1.900,
  ageFactor: 0.000, genderAdjustment: 0.900, consistencyFactor: 2.000,
  trainerPerformance: 1.500, oddsHistorical: 0.000, oddsLive: 0.000,
};

// V25 — historical candidate from Run 74 (2026-04-28)
// SA+CD from V24, weight cap 8.0, 7 starts. CV-Win 34.2%, Full-Win 34.3%, MRR 0.5215.
const V25: NormalizationWeights = {
  postPosition: 1.374, shoeType: 0.000, sulkyType: 0.277,
  driverPerformance: 2.705, driverForm: 1.590, driverEmpirical: 3.703,
  trackFamiliarity: 0.001, form: 5.868, distanceAdjustment: 1.033,
  raceDistanceAdjustment: 1.547, volteStartDistancePenalty: 0.501,
  startPoints: 2.535, placePercentage: 2.015, horseWinPercentage: 1.917,
  earningsPerStart: 6.113, gallopRisk: 1.312, layoffPenalty: 1.243,
  ageFactor: 1.692, genderAdjustment: 0.137, consistencyFactor: 4.234,
  trainerPerformance: 2.324, oddsHistorical: 2.988, oddsLive: 3.965,
};

// V26 — W2 verification (Run 75, 2026-04-28)
// V25-NoEmp optimized via kfold-v24.ts. driverEmpirical confirmed SA noise.
// CV-Win 34.2%, CV-MRR 0.5226, Full 34.3%, Top3 45.2%.
const V26: NormalizationWeights = {
  postPosition: 1.374, shoeType: 0.000, sulkyType: 0.277,
  driverPerformance: 2.755, driverForm: 1.590, driverEmpirical: 0.000,
  trackFamiliarity: 0.001, form: 5.868, distanceAdjustment: 1.033,
  raceDistanceAdjustment: 1.547, volteStartDistancePenalty: 0.801,
  startPoints: 2.535, placePercentage: 2.015, horseWinPercentage: 1.917,
  earningsPerStart: 6.113, gallopRisk: 1.312, layoffPenalty: 1.243,
  ageFactor: 1.692, genderAdjustment: 0.137, consistencyFactor: 4.234,
  trainerPerformance: 2.324, oddsHistorical: 2.988, oddsLive: 3.965,
};

// V26-NoLiveOdds — control: liveOdds zeroed to test whether lastOdds carries signal
const V26_NoLiveOdds: NormalizationWeights = { ...V26, oddsLive: 0.000 };

// V27 — W4 result (Run 80, 2026-04-28): lastOdds wired, confirmed no positive signal → oddsLive zeroed
// V26-NoLiveOdds won (MRR 0.5226, Win 34.2%) vs V26-with-lastOdds (0.5213, 33.8%)
const V27: NormalizationWeights = { ...V26, oddsLive: 0.000 };

// V28 — W7 result (Run 86, 2026-04-29): V27-NoTrainer optimized via kfold-v24.ts
// V27-NoTrainer won (MRR 0.5231, Win 34.2%) vs V27 (0.5226, 34.2%). trainerPerformance confirmed SA noise.
// trainerPerformance 2.324→0, raceDistanceAdjustment 1.547→1.047, earningsPerStart 6.113→5.000,
// genderAdjustment 0.137→0, sulkyType 0.277→0.227, trackFamiliarity 0.001→0.101,
// startPoints 2.535→2.685, placePercentage 2.015→2.215.
const V28: NormalizationWeights = {
  postPosition: 1.374, shoeType: 0.000, sulkyType: 0.227,
  driverPerformance: 2.755, driverForm: 1.590, driverEmpirical: 0.000,
  trackFamiliarity: 0.101, form: 5.868, distanceAdjustment: 1.033,
  raceDistanceAdjustment: 1.047, volteStartDistancePenalty: 0.801,
  startPoints: 2.685, placePercentage: 2.215, horseWinPercentage: 1.917,
  earningsPerStart: 5.000, gallopRisk: 1.312, layoffPenalty: 1.243,
  ageFactor: 1.692, genderAdjustment: 0.000, consistencyFactor: 4.234,
  trainerPerformance: 0.000, oddsHistorical: 2.988, oddsLive: 0.000,
};

// V28-NoTrackFam — W10 H2: trackFamiliarity 0.101→0
// Pre-analysis: homeTrack win rate 6.2% vs away 8.8% (signal direction WRONG)
// H2: V28-NoTrackFam beats V28 (high confidence — signal hurts)
const V28_NoTrackFam: NormalizationWeights = { ...V28, trackFamiliarity: 0 };

// V28-NoSulky — W10 H1: sulkyType 0.227→0
// Pre-analysis: AM-sulky 9.5% win vs VA 7.8% (1.22× ratio, correct direction)
// H1: V28 beats V28-NoSulky (moderate confidence — signal helps)
const V28_NoSulky: NormalizationWeights = { ...V28, sulkyType: 0 };

// V29 — W10 result (Run 91, 2026-04-29): V28-NoTrackFam ties V28 (both MRR=0.5233, Win=34.2%).
// trackFamiliarity:0.101 zero marginal benefit + wrong signal direction → zeroed.
// sulkyType:0.227 confirmed real signal (V28-NoSulky trails: MRR 0.5231, Top3 45.0).
// Changes from V28: trackFamiliarity 0.101→0. CV-Win=34.2%, CV-MRR=0.5233, Full=34.3%, Top3=45.2%.
// W11 (Run 93): postPosition:1.374 CONFIRMED REAL SIGNAL.
//   V29 (MRR=0.5233, Win=34.2%) vs V29-NoPostPos optimized (MRR=0.5089, Win=33.2%).
//   Delta: +0.0144 MRR, +1.0pp Win — decisive. postPosition unchanged.
const V29: NormalizationWeights = { ...V28, trackFamiliarity: 0 };

// V30 — W13 result (Run 95, 2026-04-29): V29-NoEarnings optimized via kfold-v24.ts.
// earningsPerStart:5.000 confirmed SA noise — zeroing it achieves identical CV-MRR (0.5233).
// consistencyFactor:4.234 CONFIRMED REAL SIGNAL — V29-NoConsistency trails: MRR 0.5166 vs 0.5233, Full 33.6% vs 34.3%.
// Changes from V29: earningsPerStart 5.000→0, distanceAdjustment 1.033→0.533, genderAdjustment 0→0.1.
// CV-Win=34.2%, CV-MRR=0.5233, Full=34.3%, Top3=45.2%.
const V30: NormalizationWeights = {
  postPosition: 1.374, shoeType: 0.000, sulkyType: 0.227,
  driverPerformance: 2.755, driverForm: 1.590, driverEmpirical: 0.000,
  trackFamiliarity: 0.000, form: 5.868, distanceAdjustment: 0.533,
  raceDistanceAdjustment: 1.047, volteStartDistancePenalty: 0.801,
  startPoints: 2.685, placePercentage: 2.215, horseWinPercentage: 1.917,
  earningsPerStart: 0.000, gallopRisk: 1.312, layoffPenalty: 1.243,
  ageFactor: 1.692, genderAdjustment: 0.100, consistencyFactor: 4.234,
  trainerPerformance: 0.000, oddsHistorical: 2.988, oddsLive: 0.000,
};

// V31 — W15 result (Run 102, 2026-04-30): gallopRisk:1.312 and ageFactor:1.692 both confirmed SA noise.
// V30-NoGallop and V30-NoAge both tie V30 exactly (MRR=0.5233, Win=34.2%, Full=34.3%, Top3=45.2%).
// layoffPenalty:1.243 CONFIRMED REAL SIGNAL (NoLayoff trails: MRR 0.5191, −0.0042).
// driverPerformance:2.755 CONFIRMED REAL SIGNAL (NoDriverPerf trails: MRR 0.5144, −0.0089, independent from driverForm).
// Changes from V30: gallopRisk 1.312→0, ageFactor 1.692→0. Same metrics: CV-Win=34.2%, CV-MRR=0.5233, Full=34.3%, Top3=45.2%.
const V31: NormalizationWeights = { ...V30, gallopRisk: 0.000, ageFactor: 0.000 };

// V32 — W17 result (Run 104, 2026-04-30): genderAdjustment:0.100 and distanceAdjustment:0.533 both confirmed SA noise.
// V31-NoGender and V31-NoDistAdj both tie V31 exactly (MRR=0.5233, Win=34.2%, Full=34.3%, Top3=45.2%).
// placePercentage:2.215 CONFIRMED REAL SIGNAL — V31-NoPlacePct trails: MRR 0.5198 (−0.0035).
// horseWinPercentage:1.917 CONFIRMED REAL SIGNAL — V31-NoWinPct trails: MRR 0.5159 (−0.0074).
// Changes from V31: genderAdjustment 0.100→0, distanceAdjustment 0.533→0. Same CV-Win=34.2%, CV-MRR=0.5233, Full=34.3%, Top3=45.2%.
const V32: NormalizationWeights = { ...V31, genderAdjustment: 0.000, distanceAdjustment: 0.000 };

const STARTS: Record<string, NormalizationWeights> = {
  // V32 experimental candidate — reported neighbourhood optimum after W17
  'V32': V32,
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
