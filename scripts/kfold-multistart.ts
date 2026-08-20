/**
 * Multi-start honest K-fold CV optimizer.
 *
 * Protocol (see docs/superpowers/specs/2026-07-03-honest-kfold-calibration-design.md):
 *   1. Chronological holdout: the most recent ~20% of dates are reserved and never
 *      touched during optimization or start selection.
 *   2. Date-level K-fold CV on the training window: each start is optimized on
 *      fold.train (SA + coordinate descent, L2-regularized) and scored on fold.test.
 *      Starts are ranked by mean OUT-OF-FOLD MRR — data the optimizer never saw.
 *   3. The winning start is refit on the full training window.
 *   4. Refit weights and reference baselines are evaluated on the holdout — the
 *      honest number for "how will this do next Saturday".
 *
 * The previous version optimized the average of test-fold scores directly (fold.train
 * was unused), which is equivalent to in-sample optimization on the whole dataset.
 *
 * Usage:
 *   npx tsx scripts/kfold-multistart.ts [dataset.json] [options]
 *     --k <n>          folds (default 4)
 *     --sa <n>         SA steps per fold-optimization (default 300; refit uses 2x)
 *     --passes <n>     max CD passes per fold-optimization (default 8; refit uses 12)
 *     --curves         also tune post-position curves (default off — slower)
 *     --holdout <f>    holdout fraction of dates (default 0.2, min 6 dates)
 *     --baseline <f>   JSON file with a NormalizationWeights object to evaluate on
 *                      the holdout for comparison (e.g. current production weights)
 *     --list-starts    print start names and exit
 */

import * as fs from 'fs';
import { DEFAULT_WEIGHTS, NormalizationWeights } from '../src/services/modernKm/types';
import { WEIGHT_PRESETS } from '../src/services/modernKm/presetWeights';
import { evaluateWeights } from '../src/services/calibration/historicalCalibrationService';
import { chronologicalHoldout, createDateFolds } from '../src/services/calibration/datasetSplits';
import { optimizeWeights } from '../src/services/calibration/weightOptimizer';
import { loadDataset, primeDriverRatings } from './cli-common';

const WEIGHT_KEYS: (keyof NormalizationWeights)[] = [
  'postPosition', 'shoeType', 'sulkyType',
  'driverPerformance', 'driverForm', 'driverEmpirical',
  'trackFamiliarity', 'form', 'distanceAdjustment',
  'raceDistanceAdjustment', 'volteStartDistancePenalty',
  'startPoints', 'placePercentage', 'horseWinPercentage',
  'earningsPerStart', 'gallopRisk', 'layoffPenalty',
  'ageFactor', 'genderAdjustment', 'consistencyFactor',
  'trainerPerformance', 'oddsHistorical', 'oddsLive',
  'betDistribution', 'shoeChange',
];

function clamp01to5(v: number): number { return Math.max(0, Math.min(5, v)); }

/** Randomize weights around a base with given jitter */
function jitter(base: NormalizationWeights, amount: number, rng: () => number): NormalizationWeights {
  const w = { ...base };
  for (const key of WEIGHT_KEYS) {
    w[key] = clamp01to5((w[key] ?? 0) + (rng() * 2 - 1) * amount);
  }
  return w;
}

function makeRng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

const MULTISTART_PRESET_NAMES = [
  'V37 Experimental — V36 refined (2026-05-08)',
  'V36 Experimental — V32 source-tuned (2026-05-08)',
  'V20 — Clean Baseline (2026-04-27)',
] as const;

// Keep multistart focused: fold-level optimization multiplies cost by K, so the
// start list is shorter than the old (in-sample) version's.
function buildStarts(): Record<string, NormalizationWeights> {
  const starts: Record<string, NormalizationWeights> = {
    DEFAULT: DEFAULT_WEIGHTS,
  };

  for (const name of MULTISTART_PRESET_NAMES) {
    const preset = WEIGHT_PRESETS.find(p => p.name === name);
    if (preset) starts[preset.name] = preset.weights;
  }

  const v37 = WEIGHT_PRESETS.find(p => p.name.toLowerCase().includes('v37'))?.weights;
  if (v37) {
    starts['V37 jitter 0.5 seed 111'] = jitter(v37, 0.5, makeRng(111));
    starts['V37 jitter 1.0 seed 333'] = jitter(v37, 1.0, makeRng(333));
  }

  return starts;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function mean(xs: number[]): number { return xs.reduce((s, x) => s + x, 0) / xs.length; }
function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: npx tsx scripts/kfold-multistart.ts [dataset.json] [--k 4] [--sa 300] [--passes 8] [--curves] [--holdout 0.2] [--baseline weights.json]');
    return;
  }
  if (process.argv.includes('--list-starts')) {
    console.log(Object.keys(buildStarts()).join('\n'));
    return;
  }

  const positional = process.argv.slice(2).filter((a, i, arr) =>
    !a.startsWith('--') && !(arr[i - 1]?.startsWith('--') && !['--curves', '--list-starts'].includes(arr[i - 1])));
  const datasetPath = positional[0] || 'calibration-dataset-6mo.json';

  const K = Number(argValue('--k') ?? 4);
  const SA_STEPS = Number(argValue('--sa') ?? 300);
  const PASSES = Number(argValue('--passes') ?? 8);
  const CURVES = process.argv.includes('--curves');
  const HOLDOUT_FRAC = Number(argValue('--holdout') ?? 0.2);
  const baselinePath = argValue('--baseline');
  const OBJECTIVE = (argValue('--objective') ?? 'mrr') as 'mrr' | 'pl';

  const dataset = loadDataset(datasetPath, { primeDriverRatings: false });

  const { train: trainWindow, holdout } = chronologicalHoldout(dataset, HOLDOUT_FRAC, 6);
  const holdoutRaces = holdout.reduce((s, d) => s + d.races.length, 0);
  const trainRaces = trainWindow.reduce((s, d) => s + d.races.length, 0);
  console.log(`Training window: ${trainWindow.length} dates / ${trainRaces} races (${trainWindow[0].date} … ${trainWindow[trainWindow.length - 1].date})`);
  console.log(`Holdout (untouched): ${holdout.length} dates / ${holdoutRaces} races (${holdout[0].date} … ${holdout[holdout.length - 1].date})`);
  console.log(`Config: K=${K} sa=${SA_STEPS} passes=${PASSES} curves=${CURVES} objective=${OBJECTIVE}\n`);

  const folds = createDateFolds(trainWindow, K, 42);
  const starts = buildStarts();
  const foldOpts = { saSteps: SA_STEPS, maxPasses: PASSES, optimizeCurves: CURVES, objective: OBJECTIVE };

  interface StartResult { name: string; oofMRRs: number[]; oofWins: number[]; }
  const results: StartResult[] = [];

  let startIdx = 0;
  for (const [name, startW] of Object.entries(starts)) {
    console.log(`── ${name} ──`);
    const oofMRRs: number[] = [];
    const oofWins: number[] = [];
    startIdx++;

    for (let f = 0; f < folds.length; f++) {
      const t0 = Date.now();
      primeDriverRatings(folds[f].train);
      // Deterministic per-(start, fold) seed — identical runs reproduce exactly
      const opt = await optimizeWeights(folds[f].train, startW, undefined, undefined, undefined,
        { ...foldOpts, seed: startIdx * 1000 + f });
      const oof = await evaluateWeights(folds[f].test, opt.optimizedWeights, opt.optimizedCurves);
      oofMRRs.push(oof.winnerMRR);
      oofWins.push(oof.winAccuracy);
      console.log(`  fold ${f + 1}/${K}: OOF-MRR=${oof.winnerMRR.toFixed(4)} OOF-Win=${(oof.winAccuracy * 100).toFixed(1)}% (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }

    results.push({ name, oofMRRs, oofWins });
    console.log(`  → mean OOF-MRR=${mean(oofMRRs).toFixed(4)} ±${std(oofMRRs).toFixed(4)}  mean OOF-Win=${(mean(oofWins) * 100).toFixed(1)}%\n`);
  }

  results.sort((a, b) => mean(b.oofMRRs) - mean(a.oofMRRs));

  console.log('═══════════════════════════════════════════════════════');
  console.log('START RANKINGS (by mean out-of-fold MRR):');
  for (const r of results) {
    console.log(`  ${mean(r.oofMRRs).toFixed(4)} ±${std(r.oofMRRs).toFixed(4)}  win=${(mean(r.oofWins) * 100).toFixed(1)}%  ${r.name}`);
  }

  // Refit the winning start on the full training window with a bigger budget
  const bestStart = results[0];
  console.log(`\nRefitting "${bestStart.name}" on full training window…`);
  primeDriverRatings(trainWindow);
  const refit = await optimizeWeights(
    trainWindow, starts[bestStart.name], undefined, undefined, undefined,
    { saSteps: SA_STEPS * 2, maxPasses: Math.max(PASSES, 12), optimizeCurves: CURVES, seed: 7, objective: OBJECTIVE }
  );

  // ── Honest final evaluation on the untouched holdout ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`HOLDOUT EVALUATION (${holdout.length} dates / ${holdoutRaces} races the optimizer never saw):`);

  const report: Record<string, unknown> = {};
  const holdoutEval = async (label: string, w: NormalizationWeights, curves?: typeof refit.optimizedCurves) => {
    const e = await evaluateWeights(holdout, w, curves);
    console.log(`  ${label.padEnd(24)} MRR=${e.winnerMRR.toFixed(4)}  win=${(e.winAccuracy * 100).toFixed(1)}%  top3=${(e.winnerTop3Accuracy * 100).toFixed(1)}%  rankMAE=${e.rankMAE.toFixed(2)}`);
    report[label] = e;
    return e;
  };

  await holdoutEval('DEFAULT', DEFAULT_WEIGHTS);
  await holdoutEval(`start: ${bestStart.name}`, starts[bestStart.name]);
  let baselineE;
  if (baselinePath) {
    const baselineW = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as NormalizationWeights;
    baselineE = await holdoutEval('baseline (production)', baselineW);
  }
  const refitE = await holdoutEval('REFIT (new weights)', refit.optimizedWeights, refit.optimizedCurves);

  const cleanWeights: Record<string, number> = {};
  for (const key of WEIGHT_KEYS) cleanWeights[key] = Math.round(refit.optimizedWeights[key] * 1000) / 1000;

  console.log('\nREFIT WEIGHTS:');
  console.log(JSON.stringify(cleanWeights, null, 2));
  if (CURVES) {
    console.log('\nREFIT CURVES:');
    console.log(JSON.stringify(refit.optimizedCurves, null, 2));
  }

  if (baselineE && refitE.winnerMRR <= baselineE.winnerMRR) {
    console.log('\n⚠ Refit does NOT beat the production baseline on the holdout — keep the baseline weights.');
  }

  const outPath = `reports/kfold-honest-${new Date().toISOString().split('T')[0]}${OBJECTIVE === 'pl' ? '-pl' : ''}.json`;
  fs.writeFileSync(outPath, JSON.stringify({
    datasetPath, config: { K, SA_STEPS, PASSES, CURVES, HOLDOUT_FRAC, OBJECTIVE },
    trainWindow: { dates: trainWindow.length, races: trainRaces, from: trainWindow[0].date, to: trainWindow[trainWindow.length - 1].date },
    holdout: { dates: holdout.length, races: holdoutRaces, from: holdout[0].date, to: holdout[holdout.length - 1].date },
    startRankings: results.map(r => ({ name: r.name, meanOofMRR: mean(r.oofMRRs), stdOofMRR: std(r.oofMRRs), meanOofWin: mean(r.oofWins) })),
    holdoutEvaluations: report,
    refitWeights: cleanWeights,
    refitCurves: CURVES ? refit.optimizedCurves : undefined,
  }, null, 2));
  console.log(`\nReport written to ${outPath}`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
